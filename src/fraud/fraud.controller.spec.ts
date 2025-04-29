import { Test, TestingModule } from '@nestjs/testing';
import { FraudController } from './fraud.controller';

describe('FraudController', () => {
  let controller: FraudController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FraudController],
    }).compile();

    controller = module.get<FraudController>(FraudController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
