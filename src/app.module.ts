import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PolicyModule } from './policy/policy.module';
import { OrchestratorModule } from './orchestrator/orchestrator.module';
import { SqlLinterModule } from './sql-linter/sql-linter.module';
import { ScrubModule } from './scrub/scrub.module';
import { AuditModule } from './audit/audit.module';
import { RunnerModule } from './runner/runner.module';
import { PlannerModule } from './planner/planner.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    PolicyModule,
    OrchestratorModule,
    SqlLinterModule,
    ScrubModule,
    AuditModule,
    RunnerModule,
    PlannerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
