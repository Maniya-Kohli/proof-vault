import { Module } from '@nestjs/common';
import { ScrubService } from './scrub.service';

@Module({
  providers: [ScrubService],
  exports: [ScrubService],
})
export class ScrubModule {}
