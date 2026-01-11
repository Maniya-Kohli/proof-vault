import { Test, TestingModule } from '@nestjs/testing';
import { ScrubService } from './scrub.service';

describe('ScrubService', () => {
  let service: ScrubService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScrubService],
    }).compile();

    service = module.get<ScrubService>(ScrubService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
