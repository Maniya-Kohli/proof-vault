import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { PolicyService } from '../policy/policy.service';
import { PlannerService } from '../planner/planner.service';
import { SqlLinterService } from '../sql-linter/sql-linter.service';
import { ExecutionService } from '../execution/execution.service';
import { ScrubService } from '../scrub/scrub.service';
import { AuditService } from '../audit/audit.service';

type HandleQueryInput = {
  sessionToken: string; // pass-through token to MCP tool (LLD)
  session: { sub: string; role: 'user' | 'admin'; email: string; region?: string };
  prompt: string;
  approved?: boolean;
};

@Injectable()
export class OrchestratorService {
  constructor(
    private readonly policy: PolicyService,
    private readonly planner: PlannerService,
    private readonly linter: SqlLinterService,
    private readonly execution: ExecutionService,
    private readonly scrubber: ScrubService,
    private readonly audit: AuditService,
  ) {}

  async handleQuery(input: HandleQueryInput) {
    const workflowId = randomUUID();

    // 1) Load policy (blindfold + scope + clearance)
    const authorized = await this.policy.getAuthorizedSchemasForRole(input.session.role);
    const db0 = authorized.databases?.[0];

    if (!db0) throw new BadRequestException('No authorized database configured for this role');
    if (!db0.scope?.org_id) throw new BadRequestException('Missing org_id scope in policy');
    if (!Array.isArray(db0.scope?.allowed_account_ids)) {
      throw new BadRequestException('Missing allowed_account_ids scope in policy');
    }
    if (!db0.clearance) throw new BadRequestException('Missing clearance in policy');

    // 2) Plan SQL (still stub; later LLM)
    const plannedSql = this.planner.planSql(input.prompt);

    // 3) Lint + decision
    const lint = this.linter.lintAndSanitize(plannedSql, authorized);

    // Helper: write a denial receipt (no data execution happened)
    const writeDenyReceipt = async (denyMessage: string) => {
      const { receiptId, resultHash } = await this.audit.writeReceipt({
        workflowId,
        userId: input.session.sub,
        prompt: input.prompt,
        sql: lint.sanitizedSql ?? plannedSql,
        eventType: 'DENIED',
        scrubbedResult: {
          event: 'DENIED',
          message: denyMessage,
          session: { role: input.session.role, email: input.session.email, sub: input.session.sub },
          decision: lint.decision,
          risk: lint.risk,
          tablesUsed: lint.tablesUsed,
          reasons: lint.reasons,
          approvedFlagProvided: input.approved === true,
        },
      });

      return { receiptId, resultHash };
    };

    // 3a) Hard block
    if (!lint.ok || !lint.sanitizedSql) {
      const denyMessage = 'Query cannot be run under the privileges you have.';
      const { receiptId, resultHash } = await writeDenyReceipt(denyMessage);

      throw new ForbiddenException({
        message: denyMessage,
        workflowId,
        receiptId,
        resultHash,
        decision: lint.decision,
        tablesUsed: lint.tablesUsed,
        reasons: lint.reasons,
      });
    }

    // 4) Approval gate
    if (lint.decision === 'NEEDS_APPROVAL') {
      const isAdmin = input.session.role === 'admin';
      const approved = input.approved === true;

      if (!(isAdmin && approved)) {
        const denyMessage =
          'Query cannot be run under the privileges you have. Admin must re-run with {"approved": true}.';
        const { receiptId, resultHash } = await writeDenyReceipt(denyMessage);

        throw new ForbiddenException({
          message: denyMessage,
          workflowId,
          receiptId,
          resultHash,
          decision: lint.decision,
          tablesUsed: lint.tablesUsed,
          reasons: lint.reasons,
        });
      }
    }

    // 5) Execute via MCP tool (LLD-faithful separation)
    const rawRows = await this.execution.executeSqlViaMcp({
      sql: lint.sanitizedSql,
      sessionToken: input.sessionToken,
      role: input.session.role,
      orgId: db0.scope.org_id,
      allowedAccountIds: db0.scope.allowed_account_ids,
      clearance: db0.clearance,
    });

    // 6) Scrub + audit (success)
    const scrubbed = this.scrubber.scrubRows(rawRows);

    const { receiptId, resultHash } = await this.audit.writeReceipt({
      eventType: 'EXECUTED',
      workflowId,
      userId: input.session.sub,
      prompt: input.prompt,
      sql: lint.sanitizedSql,
      scrubbedResult: scrubbed,
    });

    return {
      workflowId,
      decision: lint.decision,
      risk: lint.risk,
      tablesUsed: lint.tablesUsed,
      reasons: lint.reasons,
      sql: lint.sanitizedSql,
      result: scrubbed,
      receiptId,
      resultHash,
    };
  }
}
