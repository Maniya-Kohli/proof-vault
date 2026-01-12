import { Injectable } from '@nestjs/common';
import { McpClientService } from '../mcp/mcp-client.service';

type McpExecuteSqlResponse =
  | { ok: true; rows: any[]; rowCount?: number; dbRole?: string }
  | { ok: false; error: string; message?: string };

@Injectable()
export class ExecutionService {
  constructor(private readonly mcp: McpClientService) {}

  async executeSqlViaMcp(input: {
    sql: string;
    sessionToken: string;
    role: 'user' | 'admin';
    orgId: string;
    allowedAccountIds: string[];
    clearance: string;
  }) {
    const res = await this.mcp.callToolEphemeral<McpExecuteSqlResponse>('execute_sql', {
      sql: input.sql,
      sessionToken: input.sessionToken,
      role: input.role,
      orgId: input.orgId,
      allowedAccountIds: input.allowedAccountIds,
      clearance: input.clearance,
    });

    if (!res.ok) throw new Error(res.message ?? res.error ?? 'mcp_execute_failed');
    return res.rows;
  }
}
