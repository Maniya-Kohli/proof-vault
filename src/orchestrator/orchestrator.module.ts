import { Module } from '@nestjs/common';
import { OrchestratorController } from './orchestrator.controller';
import { OrchestratorService } from './orchestrator.service';

import { PolicyModule } from '../policy/policy.module';
import { PlannerModule } from '../planner/planner.module';
import { SqlLinterModule } from '../sql-linter/sql-linter.module';
import { ScrubModule } from '../scrub/scrub.module';
import { AuditModule } from '../audit/audit.module';
import { ExecutionModule } from '../execution/execution.module';

@Module({
  imports: [
    PolicyModule,
    PlannerModule,
    SqlLinterModule,
    ExecutionModule, // <-- provides ExecutionService
    ScrubModule,
    AuditModule,
  ],
  controllers: [OrchestratorController],
  providers: [OrchestratorService],
  exports: [OrchestratorService],
})
export class OrchestratorModule {}
