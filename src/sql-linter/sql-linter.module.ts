import { Module } from '@nestjs/common';
import { SqlLinterService } from './sql-linter.service';

@Module({
  providers: [SqlLinterService],
  exports: [SqlLinterService],
})
export class SqlLinterModule {}
