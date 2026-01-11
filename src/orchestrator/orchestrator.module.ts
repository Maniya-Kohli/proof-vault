import { Module } from '@nestjs/common';
import { OrchestratorController } from './orchestrator.controller';
import { OrchestratorService } from './orchestrator.service';

import { PolicyModule } from '../policy/policy.module';
import { SqlLinterModule } from '../sql-linter/sql-linter.module';
import { RunnerModule } from '../runner/runner.module';
import { ScrubModule } from '../scrub/scrub.module';
import { AuditModule } from '../audit/audit.module';
import { PlannerModule } from '../planner/planner.module';

@Module({
  imports: [PolicyModule, SqlLinterModule, RunnerModule, ScrubModule, AuditModule, PlannerModule],
  controllers: [OrchestratorController],
  providers: [OrchestratorService],
})
export class OrchestratorModule {}
