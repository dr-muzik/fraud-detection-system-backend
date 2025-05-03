import { unlink } from 'fs/promises';
import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FraudService } from './fraud.service';
import { PrismaService } from '../prisma/prisma.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { jsonUploadOptions } from '../middleware/upload.middleware';
import { createReadStream } from 'fs';
import { streamArray } from 'stream-json/streamers/StreamArray';
import * as path from 'path';
import { chain } from 'stream-chain';
import { parser } from 'stream-json';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { UploadTransactionDTO } from './transaction.dto';

@Controller()
export class FraudController {
  constructor(
    private fraudService: FraudService,
    private prisma: PrismaService,
  ) {}

  @Post('/stream-process')
  @UseInterceptors(FileInterceptor('tx', jsonUploadOptions))
  @ApiOperation({ summary: 'Process transactions from uploaded JSON file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadTransactionDTO })
  @ApiResponse({ status: 201, description: 'Streaming process complete' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async streamProcess(@UploadedFile() file: Express.Multer.File) {
    let result: number = 0;
    const filePath = path.resolve(file.path);

    const pipeline = chain([
      createReadStream(filePath),
      parser(),
      streamArray(),
    ]);

    const promises: Promise<void>[] = [];
    for await (const { value } of pipeline) {
      promises.push(this.fraudService.processTransaction(value));
      if (promises.length >= 100) {
        await Promise.allSettled(promises);
        promises.length = 0;
      }
    }
    if (promises.length) {
      await Promise.allSettled(promises); // Process remaining
    }
    const length = await this.prisma.transactions.count({
      where: {
        is_fraud: true,
      },
    });

    // Cleanup: delete file after processing
    try {
      await unlink(filePath);
      console.log(`Deleted file: ${filePath}`);
    } catch (err) {
      console.error(`Error deleting file: ${filePath}`, err);
    }

    return { status: 'Streaming process complete (streamed)', length };
  }

  @Get('/fraud-check')
  @ApiOperation({ summary: 'Get flagged fraudulent transactions for a user' })
  @ApiQuery({
    name: 'userId',
    required: true,
    description: 'The ID of the user to check for fraudulent transactions',
  })
  @ApiResponse({
    status: 200,
    description: 'List of flagged fraudulent transactions',
    schema: {
      type: 'object',
      properties: {
        length: { type: 'number' },
        transactions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              user_id: { type: 'string' },
              is_fraud: { type: 'boolean' },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  })
  async getFlagged(@Query('userId') userId: string) {
    const result = await this.prisma.transactions.findMany({
      where: {
        user_id: userId,
        is_fraud: true,
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    return { length: result.length, transactions: result };
  }

  @Get('/test-db')
  testDb() {
    return this.fraudService.testConnection();
  }
}
