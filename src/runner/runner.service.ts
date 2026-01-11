import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Pool } from 'pg';

export type AppRole = 'user' | 'admin';

export type ExecutionContext = {
  role: AppRole; // which login pool to use
  orgId: string; // RLS tenant scope
  allowedAccountIds: string[]; // RLS account scope
  clearance: 'qg_analyst' | 'qg_risk_analyst' | 'qg_compliance'; // SET LOCAL ROLE
};

@Injectable()
export class RunnerService {
  private userPool?: Pool;
  private adminPool?: Pool;

  private getPool(role: AppRole): Pool {
    const userUrl = process.env.DATA_DB_USER_URL;
    const adminUrl = process.env.DATA_DB_ADMIN_URL;

    if (!userUrl || !adminUrl) {
      throw new InternalServerErrorException('DATA_DB_USER_URL / DATA_DB_ADMIN_URL not configured');
    }

    if (role === 'user') {
      if (!this.userPool) this.userPool = new Pool({ connectionString: userUrl });
      return this.userPool;
    }

    if (!this.adminPool) this.adminPool = new Pool({ connectionString: adminUrl });
    return this.adminPool;
  }

  /**
   * Executes SQL under:
   * - Read-only transaction
   * - Tight timeouts
   * - Locked-down search_path (encourages schema-qualified tables)
   * - RLS scope via app.org_id + app.allowed_account_ids
   * - Clearance via SET LOCAL ROLE
   */
  async executeSql(sql: string, ctx: ExecutionContext): Promise<any[]> {
    if (!ctx.orgId) throw new InternalServerErrorException('Runner missing orgId scope');
    if (!Array.isArray(ctx.allowedAccountIds)) {
      throw new InternalServerErrorException('Runner missing allowedAccountIds scope');
    }

    const pool = this.getPool(ctx.role);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Tight sandbox controls (demo-friendly defaults)
      await client.query(`SET LOCAL statement_timeout = '2000ms'`);
      await client.query(`SET LOCAL lock_timeout = '500ms'`);
      await client.query(`SET LOCAL idle_in_transaction_session_timeout = '5000ms'`);

      // Force schema-qualified object access (no relying on public search_path)
      await client.query(`SET LOCAL search_path = 'pg_catalog'`);

      // Mark transaction read-only (must be before the main query)
      await client.query('SET TRANSACTION READ ONLY');

      // Scope vars (RLS)
      await client.query(`SELECT set_config('app.org_id', $1, true)`, [ctx.orgId]);
      await client.query(`SELECT set_config('app.allowed_account_ids', $1, true)`, [
        ctx.allowedAccountIds.join(','),
      ]);

      // Clearance (identifier cannot be parameterized; whitelist)
      const clearance = ctx.clearance;
      if (!['qg_analyst', 'qg_risk_analyst', 'qg_compliance'].includes(clearance)) {
        throw new InternalServerErrorException('Invalid clearance role');
      }
      await client.query(`SET LOCAL ROLE ${clearance}`);

      // Execute
      const res = await client.query(sql);

      await client.query('COMMIT');
      return res.rows;
    } catch (e: any) {
      try {
        await client.query('ROLLBACK');
      } catch {}
      throw new InternalServerErrorException(`Runner SQL execution failed: ${e?.message ?? 'unknown error'}`);
    } finally {
      client.release();
    }
  }
}
