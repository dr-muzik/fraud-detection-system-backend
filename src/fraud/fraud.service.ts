import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionDTO } from './transaction.dto';
import * as Deque from 'double-ended-queue';
const queue = new Deque();

@Injectable()

/**
 * The `FraudService` class provides methods to process and analyze transactions for potential fraud detection.
 * It implements predefined rules to identify suspicious activities such as high transaction frequency,
 * excessive daily transaction amounts, and location anomalies. The service also flags fraudulent transactions
 * and stores them in the database.

 * Key Features:
 * - Tracks user transaction timestamps to detect high-frequency transactions.
 * - Monitors daily transaction amounts to identify unusually high spending.
 * - Checks for location mismatches to detect anomalies in transaction locations.
 * - Flags fraudulent transactions and stores them in the database with reasons for the flag.

 * Dependencies:
 * - `PrismaService`: Used for database interactions.
 */
export class FraudService {
  // private userTxTimestamps = new Map<string, Date[]>();
  // private userDailyAmount = new Map<string, Map<string, number>>();
  // private userLastLocation = new Map<
  //   string,
  //   { timestamp: Date; lat: number; lon: number }
  // >();

  private userTxTimestamps = new Map<string, Deque<Date>>();
  private userDailyAmount = new Map<string, Map<string, number>>();
  private userLastLocation = new Map<
    string,
    { timestamp: Date; lat: number; lon: number }
  >();

  constructor(private prisma: PrismaService) {}

  /**
   * Processes a transaction and checks for potential fraud based on predefined rules.
   *
   * @param tx - The transaction data to be processed.
   *
   * This method checks the following rules:
   * 1. If there are more than 5 transactions in less than 1 minute for the same user.
   * 2. If the total amount of transactions exceeds $10,000 in a single day for the same user.
   * 3. If there is a location mismatch within 2 minutes of the last transaction for the same user.
   */

  async processTransaction(tx: TransactionDTO) {
    const txTime = new Date(tx.timestamp);
    const dateKey = txTime.toISOString().split('T')[0];
    let response = 0;

    // Rule 1: > 5 transactions in 1 minute using Deque sliding window
    let txQueue = this.userTxTimestamps.get(tx.userId);
    if (!txQueue) {
      txQueue = new Deque<Date>();
      this.userTxTimestamps.set(tx.userId, txQueue);
    }

    // Remove timestamps older than 1 minute from front of deque
    while (!txQueue.isEmpty()) {
      const oldest = txQueue.peekFront();
      if (!oldest || txTime.getTime() - oldest.getTime() <= 60_000) break;
      txQueue.shift();
    }

    txQueue.push(txTime);

    if (txQueue.length > 5) {
      // console.log('responeQueue', response);
      response += await this.flag(
        tx,
        'High frequency: > 5 transactions in 1 minute',
      );
    }

    // Rule 2: > $10,000 in a single day
    const dailyMap = this.userDailyAmount.get(tx.userId) || new Map();
    const currentTotal = (dailyMap.get(dateKey) || 0) + tx.amount;
    dailyMap.set(dateKey, currentTotal);
    this.userDailyAmount.set(tx.userId, dailyMap);

    if (currentTotal > 10_000) {
      // console.log('responeDailyMap', response);
      response += await this.flag(tx, 'High volume: > $10,000 in one day');
    }

    // Rule 3: Different locations within 2 minutes
    const lastLoc = this.userLastLocation.get(tx.userId);
    if (lastLoc) {
      const delta = Math.abs(txTime.getTime() - lastLoc.timestamp.getTime());
      // console.log(`Geo delta (ms): ${delta}`);
      if (delta <= 2 * 60_000) {
        const dist = this.haversine(
          tx.location.lat,
          tx.location.lon,
          lastLoc.lat,
          lastLoc.lon,
        );
        if (dist > 100) {
          response += await this.flag(
            tx,
            'Location anomaly: different locations within 2 mins',
          );
          console.log('responeLoc', response);
        }
      }
    }

    this.userLastLocation.set(tx.userId, {
      timestamp: txTime,
      lat: tx.location.lat,
      lon: tx.location.lon,
    });
  }

  // async processTransaction(tx: TransactionDTO): Promise<number> {
  //   const txTime = new Date(tx.timestamp);
  //   const dateKey = txTime.toISOString().split('T')[0];

  //   let response: number = 0;
  //   // Rule 1: > 5 transactions in < 1 minute
  //   const timestamps = this.userTxTimestamps.get(tx.userId) || [];
  //   const newTimestamps = [...timestamps, txTime].filter(
  //     (t) => txTime.getTime() - t.getTime() <= 60_000,
  //   );
  //   this.userTxTimestamps.set(tx.userId, newTimestamps);
  //   if (newTimestamps.length > 5) {
  //     response = await this.flag(
  //       tx,
  //       'High frequency: > 5 transactions in 1 minute',
  //     );
  //   }

  //   // Rule 2: > $10,000 in a day
  //   const dailyMap = this.userDailyAmount.get(tx.userId) || new Map();
  //   const currentTotal = (dailyMap.get(dateKey) || 0) + tx.amount;
  //   dailyMap.set(dateKey, currentTotal);
  //   this.userDailyAmount.set(tx.userId, dailyMap);
  //   if (currentTotal > 10000) {
  //     response = await this.flag(tx, 'High volume: > $10,000 in one day');
  //   }

  //   // Rule 3: Geo mismatch
  //   const lastLoc = this.userLastLocation.get(tx.userId);
  //   if (lastLoc) {
  //     const delta = Math.abs(txTime.getTime() - lastLoc.timestamp.getTime());
  //     if (delta <= 2 * 60_000) {
  //       const dist = this.haversine(
  //         tx.location.lat,
  //         tx.location.lon,
  //         lastLoc.lat,
  //         lastLoc.lon,
  //       );
  //       if (dist > 100) {
  //         response = await this.flag(
  //           tx,
  //           'Location anomaly: different locations within 2 mins',
  //         );
  //       }
  //     }
  //   }

  //   this.userLastLocation.set(tx.userId, {
  //     timestamp: txTime,
  //     lat: tx.location.lat,
  //     lon: tx.location.lon,
  //   });

  //   return response;
  // }

  /**
   * Flags a transaction as fraudulent and inserts it into the database with the provided reason.
   *
   * This method uses a raw SQL query to insert the transaction details into the "Transaction" table.
   * If a transaction with the same `transactionId` already exists, the insertion is ignored.
   * The location is stored as a geographic point using PostGIS functions.
   *
   * @param tx - The transaction data to be flagged as fraudulent.
   * @param reason - The reason why the transaction is flagged as fraudulent.
   */
  private async flag(tx: TransactionDTO, reason: string): Promise<number> {
    // Check if the transaction already exists in the database
    const existingTransaction = await this.prisma.transactions.findUnique({
      where: { transaction_id: tx.transactionId },
    });
    if (existingTransaction) {
      // If the transaction already exists, return early
      return 0;
    }

    const result = await this.prisma.$executeRawUnsafe(
      `
      INSERT INTO "transactions" (
        "transaction_id", "user_id", "amount", "timestamp", "merchant", "location", "is_fraud", "fraud_reason"
      )
      VALUES (
        $1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326), $8, $9
      )
      ON CONFLICT ("transaction_id") DO NOTHING
      `,
      tx.transactionId,
      tx.userId,
      tx.amount,
      new Date(tx.timestamp),
      tx.merchant ?? null,
      tx.location.lon,
      tx.location.lat,
      true,
      reason,
    );

    return result;
  }

  async testConnection() {
    return this.prisma.transactions.findFirst(); // or any model in your schema
  }

  /**
   * Calculates the great-circle distance between two geographic points using the Haversine formula.
   *
   * The Haversine formula determines the shortest distance over the Earth's surface between two points,
   * assuming the Earth is a sphere. This is useful for detecting location anomalies in transactions.
   *
   * @param lat1 - Latitude of the first point in degrees.
   * @param lon1 - Longitude of the first point in degrees.
   * @param lat2 - Latitude of the second point in degrees.
   * @param lon2 - Longitude of the second point in degrees.
   * @returns The distance between the two points in kilometers.
   */
  private haversine(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
