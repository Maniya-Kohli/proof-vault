import { Test, TestingModule } from '@nestjs/testing';
import { SqlLinterService } from './sql-linter.service';

describe('SqlLinterService', () => {
  let service: SqlLinterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SqlLinterService],
    }).compile();

    service = module.get<SqlLinterService>(SqlLinterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
