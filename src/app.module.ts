import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FraudModule } from './fraud/fraud.module';
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [FraudModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
