import { Injectable } from '@nestjs/common';
import type { AuthorizedSchemas } from '../policy/policy.service';

export type Decision = 'SAFE' | 'NEEDS_APPROVAL' | 'BLOCKED';

export type LintResult = {
  ok: boolean;
  decision: Decision;
  risk: 'safe' | 'needs_review' | 'blocked';
  sanitizedSql?: string;
  tablesUsed: string[];
  reasons: string[];
};

@Injectable()
export class SqlLinterService {
  lintAndSanitize(sql: string, authorized: AuthorizedSchemas): LintResult {
    const base = (overrides: Partial<LintResult>): LintResult => ({
      ok: false,
      decision: 'BLOCKED',
      risk: 'blocked',
      tablesUsed: [],
      reasons: [],
      ...overrides,
    });

    const normalized = sql.trim().replace(/;+/g, ';');
    const statements = normalized
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);

    if (statements.length !== 1) {
      return base({ reasons: ['multi_statement_not_allowed'] });
    }

    const stmt = statements[0];
    const lower = stmt.toLowerCase();

    // ✅ Use whole-word matching so "created_at" doesn't trigger "create"
    const forbidden = ['insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate', 'grant', 'revoke'];
    for (const k of forbidden) {
      const re = new RegExp(`\\b${k}\\b`, 'i');
      if (re.test(stmt)) {
        return base({ reasons: ['write_or_ddl_blocked'], tablesUsed: extractTables(stmt) });
      }
    }

    if (!lower.startsWith('select')) {
      return base({ reasons: ['only_select_allowed'], tablesUsed: extractTables(stmt) });
    }

    const allowedTables = new Set(
      authorized.databases.flatMap((db) => db.tables.map((t) => normalizeIdent(t.name))),
    );

    const referencedRaw = extractTables(stmt);
    const referenced = referencedRaw.map(normalizeIdent);

    const unqualified = referenced.filter((t) => !t.includes('.'));
    if (unqualified.length) {
      return base({
        tablesUsed: referencedRaw,
        reasons: [`unqualified_tables:${unqualified.join(',')}`],
      });
    }

    const violations = referenced.filter((t) => !allowedTables.has(t));
    if (violations.length) {
      return base({
        tablesUsed: referencedRaw,
        reasons: [`out_of_scope_tables:${violations.join(',')}`],
      });
    }

    const reasons: string[] = [];
    const touchesSensitive = referenced.some(
      (t) => t.startsWith('kyc_private.') || t.startsWith('risk_private.'),
    );
    if (touchesSensitive) reasons.push('touches_sensitive_schema');

    let sanitized = stmt;
    if (!/\blimit\b/i.test(stmt)) {
      sanitized = stmt + ' LIMIT 100';
      reasons.push('limit_added');
    }

    const needsApproval = touchesSensitive || reasons.includes('limit_added');

    return {
      ok: true,
      decision: needsApproval ? 'NEEDS_APPROVAL' : 'SAFE',
      risk: needsApproval ? 'needs_review' : 'safe',
      sanitizedSql: sanitized,
      tablesUsed: referencedRaw,
      reasons,
    };
  }
}

function extractTables(sql: string): string[] {
  const out: string[] = [];
  const re =
    /\b(from|join)\s+((?:"?[a-zA-Z_][\w]*"?\.)?"?[a-zA-Z_][\w]*"?)(?:\s+as\s+\w+|\s+\w+)?/gi;

  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) out.push(m[2]);
  return Array.from(new Set(out));
}

function normalizeIdent(ident: string): string {
  return ident.replace(/"/g, '').toLowerCase();
}
