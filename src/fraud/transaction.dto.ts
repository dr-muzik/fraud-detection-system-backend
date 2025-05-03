import { ApiProperty } from '@nestjs/swagger';

export class TransactionDTO {
  transactionId: string;
  userId: string;
  amount: number;
  timestamp: string;
  merchant?: string;
  location: {
    lat: number;
    lon: number;
  };
}

export class UploadTransactionDTO {
  @ApiProperty({ type: 'string', format: 'binary' })
  tx: string;
}
