import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FraudModule } from './fraud/fraud.module';

@Module({
  imports: [FraudModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
