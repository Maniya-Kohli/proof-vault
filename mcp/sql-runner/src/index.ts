import 'dotenv/config';

import { z } from 'zod';
import { Pool } from 'pg';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// MCP SDK in your version wants a "raw shape", not z.object(...)
const ExecuteSqlParams = {
  sql: z.string().min(1),

  // LLD pass-through (Phase 1: accepted, not validated yet)
  sessionToken: z.string().optional(),

  // scope + clearance (RLS + SET LOCAL ROLE)
  orgId: z.string().min(1),
  allowedAccountIds: z.array(z.string()).default([]),
  clearance: z.string().min(1),

  // app role (chooses DB login)
  role: z.enum(['user', 'admin']),
};

function isObviouslyWrite(sql: string) {
  return /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke)\b/i.test(sql);
}

// Prevent SQL identifier injection when interpolating ROLE.
// In Phase 1, clearance comes from PolicyService (trusted server-side), but still validate.
function safeIdent(ident: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(ident)) {
    throw new Error('invalid_clearance_identifier');
  }
  return ident;
}

// These env vars must exist in repo root .env (passed through by Nest)
const userPool = new Pool({ connectionString: process.env.DATA_DB_USER_URL });
const adminPool = new Pool({ connectionString: process.env.DATA_DB_ADMIN_URL });

const server = new McpServer({
  name: 'proofvault-sql-runner',
  version: '0.1.0',
});

server.tool(
  'execute_sql',
  'Execute a read-only SQL query in the data DB under RLS scope and clearance role.',
  ExecuteSqlParams,
  async ({ sql, role, orgId, allowedAccountIds, clearance }) => {
    if (isObviouslyWrite(sql)) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'write_or_ddl_blocked' }) }],
      };
    }

    const pool = role === 'admin' ? adminPool : userPool;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL statement_timeout = '3000ms';`);
      await client.query(`SET LOCAL idle_in_transaction_session_timeout = '3000ms';`);

      // Scope variables used by your RLS policies
      await client.query(`SELECT set_config('app.org_id', $1, true)`, [orgId]);
      await client.query(`SELECT set_config('app.allowed_account_ids', $1, true)`, [
        allowedAccountIds.join(','),
      ]);

      // Clearance role enforced in DB
      const roleIdent = safeIdent(clearance);
      await client.query(`SET LOCAL ROLE ${roleIdent};`);

      const res = await client.query(sql);
      await client.query('COMMIT');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ ok: true, rowCount: res.rowCount, rows: res.rows, dbRole: roleIdent }),
          },
        ],
      };
    } catch (e: any) {
      try {
        await client.query('ROLLBACK');
      } catch {}
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ok: false,
              error: 'execution_error',
              message: e?.message ?? String(e),
            }),
          },
        ],
      };
    } finally {
      client.release();
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
