import { Module } from '@nestjs/common';
import { FraudController } from './fraud.controller';
import { FraudService } from './fraud.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [FraudController],
  providers: [FraudService, PrismaService],
})
export class FraudModule {}
