import { Module } from '@nestjs/common';
import { McpModule } from '../mcp/mcp.module';
import { ExecutionService } from './execution.service';

@Module({
  imports: [McpModule],
  providers: [ExecutionService],
  exports: [ExecutionService],
})
export class ExecutionModule {}
