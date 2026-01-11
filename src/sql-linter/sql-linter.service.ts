import { Injectable } from '@nestjs/common';
import type { AuthorizedSchemas } from '../policy/policy.service';

export type LintResult = {
  ok: boolean;
  reason?: string;
  sanitizedSql?: string;
  risk: 'safe' | 'needs_review' | 'blocked';
};

@Injectable()
export class SqlLinterService {
  /**
   * MVP linter (fintech-ready):
   * - single statement only
   * - SELECT only
   * - blocks write/DDL keywords
   * - extracts schema-qualified tables from FROM/JOIN
   * - blocks out-of-scope tables (based on PolicyService authorized schemas)
   * - adds LIMIT 100 if missing (marks needs_review)
   */
  lintAndSanitize(sql: string, authorized: AuthorizedSchemas): LintResult {
    const normalized = sql.trim().replace(/;+/g, ';');
    const statements = normalized
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);

    if (statements.length !== 1) {
      return { ok: false, reason: 'Multi-statement SQL is not allowed', risk: 'blocked' };
    }

    const stmt = statements[0];
    const s = stmt.toLowerCase();

    const forbidden = ['insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate', 'grant', 'revoke'];
    if (forbidden.some((k) => s.includes(k))) {
      return { ok: false, reason: 'Write/DDL operations are blocked', risk: 'blocked' };
    }

    if (!s.startsWith('select')) {
      return { ok: false, reason: 'Only SELECT queries are allowed', risk: 'blocked' };
    }

    // Allowed tables come from Policy (prefer schema-qualified names)
    const allowedTables = new Set(
      authorized.databases.flatMap((db) => db.tables.map((t) => normalizeIdent(t.name))),
    );

    // Extract referenced tables (schema.table) from FROM and JOIN
    const referenced = extractTables(stmt).map(normalizeIdent);

    // If user writes unqualified table (e.g. "transactions"), block.
    const unqualified = referenced.filter((t) => !t.includes('.'));
    if (unqualified.length) {
      return {
        ok: false,
        reason: `Use schema-qualified table names. Unqualified: ${unqualified.join(', ')}`,
        risk: 'blocked',
      };
    }

    const violations = referenced.filter((t) => !allowedTables.has(normalizeIdent(t)));
    if (violations.length) {
      return { ok: false, reason: `Out-of-scope table(s): ${violations.join(', ')}`, risk: 'blocked' };
    }

    if (!/\blimit\b/i.test(stmt)) {
      return { ok: true, sanitizedSql: stmt + ' LIMIT 100', risk: 'needs_review' };
    }

    return { ok: true, sanitizedSql: stmt, risk: 'safe' };
  }
}

/**
 * Extracts table references in FROM/JOIN clauses.
 * Supports:
 *   FROM schema.table
 *   JOIN schema.table
 *   FROM "schema"."table"
 *   JOIN "schema".table
 * Ignores aliases.
 */
function extractTables(sql: string): string[] {
  const out: string[] = [];
  const re =
    /\b(from|join)\s+((?:"?[a-zA-Z_][\w]*"?\.)?"?[a-zA-Z_][\w]*"?)(?:\s+as\s+\w+|\s+\w+)?/gi;

  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    out.push(m[2]);
  }
  return Array.from(new Set(out));
}

function normalizeIdent(ident: string): string {
  return ident.replace(/"/g, '').toLowerCase();
}
