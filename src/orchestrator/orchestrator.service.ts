import { Injectable, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { PolicyService } from '../policy/policy.service';
import { SqlLinterService } from '../sql-linter/sql-linter.service';
import { RunnerService } from '../runner/runner.service';
import { ScrubService } from '../scrub/scrub.service';
import { AuditService } from '../audit/audit.service';
import { PlannerService } from '../planner/planner.service';

type HandleQueryInput = {
  session: { sub: string; role: 'user' | 'admin'; email: string; region?: string };
  prompt: string;
};

@Injectable()
export class OrchestratorService {
  constructor(
    private readonly policy: PolicyService,
    private readonly planner: PlannerService,
    private readonly linter: SqlLinterService,
    private readonly runner: RunnerService,
    private readonly scrubber: ScrubService,
    private readonly audit: AuditService,
  ) {}

  async handleQuery(input: HandleQueryInput) {
    const workflowId = randomUUID();

    // 1) Resource discovery BEFORE generation (blindfolding)
    const authorized = await this.policy.getAuthorizedSchemasForRole(input.session.role);
    const db0 = authorized.databases?.[0];

    if (!db0) throw new BadRequestException('No authorized database configured for this role');
    if (!db0.scope?.org_id) throw new BadRequestException('Missing org_id scope in policy');
    if (!Array.isArray(db0.scope?.allowed_account_ids)) {
      throw new BadRequestException('Missing allowed_account_ids scope in policy');
    }
    if (!db0.clearance) throw new BadRequestException('Missing clearance in policy');

    // 2) Prompt -> SQL (Planner: stub now, LLM later)
    const sql = this.planner.planSql(input.prompt);

    // 3) Deterministic gate (policy-aware)
    const lint = this.linter.lintAndSanitize(sql, authorized);
    if (!lint.ok || !lint.sanitizedSql) {
      throw new BadRequestException(lint.reason || 'SQL blocked');
    }

    // 4) Execute under DB-enforced scope + clearance (RLS + SET LOCAL ROLE)
    const rawRows = await this.runner.executeSql(lint.sanitizedSql, {
      role: input.session.role,
      orgId: db0.scope.org_id,
      allowedAccountIds: db0.scope.allowed_account_ids,
      clearance: db0.clearance,
    } as any);

    // 5) Scrub PII before returning
    const scrubbed = this.scrubber.scrubRows(rawRows);

    // 6) Audit receipt
    const { receiptId, resultHash } = await this.audit.writeReceipt({
      workflowId,
      userId: input.session.sub,
      prompt: input.prompt,
      sql: lint.sanitizedSql,
      scrubbedResult: scrubbed,
    });

    return {
      workflowId,
      risk: lint.risk,
      sql: lint.sanitizedSql,
      result: scrubbed,
      receiptId,
      resultHash,
    };
  }
}
