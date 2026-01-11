import { Injectable } from '@nestjs/common';

/**
 * Planner = "prompt -> SQL"
 * Today: deterministic stub for demos
 * Later: swap internals with LLM adapter (keep same method signature)
 */
@Injectable()
export class PlannerService {
  planSql(prompt: string): string {
    const p = prompt.toLowerCase();

    // PII demo: admin-only by policy (user role will be blocked by linter)
    if (
      p.includes('customer') &&
      (p.includes('email') || p.includes('phone') || p.includes('ssn') || p.includes('pii'))
    ) {
      return `
        SELECT customer_id, full_name, email, phone, ssn_last4, dob, kyc_status
        FROM kyc_private.customers_pii
        ORDER BY created_at DESC
        LIMIT 25
      `.trim();
    }

    if (p.includes('risk') || p.includes('flag') || p.includes('alert')) {
      return `
        SELECT rf.flag_type, rf.severity, rf.created_at, t.amount_cents, t.category, t.status
        FROM risk_private.risk_flags rf
        JOIN transactions_public.transactions t ON t.tx_id = rf.tx_id
        ORDER BY rf.created_at DESC
        LIMIT 50
      `.trim();
    }

    if (p.includes('kyc') || p.includes('compliance')) {
      return `
        SELECT kyc_status, COUNT(*) AS customers
        FROM kyc_private.customers_pii
        GROUP BY kyc_status
        ORDER BY customers DESC
        LIMIT 50
      `.trim();
    }

    if (p.includes('month') || p.includes('monthly')) {
      return `
        SELECT date_trunc('month', posted_at) AS month,
               SUM(CASE WHEN direction='debit' THEN amount_cents ELSE 0 END)  AS debits_cents,
               SUM(CASE WHEN direction='credit' THEN amount_cents ELSE 0 END) AS credits_cents
        FROM transactions_public.transactions
        GROUP BY 1
        ORDER BY 1
        LIMIT 50
      `.trim();
    }

    if (p.includes('category')) {
      return `
        SELECT category, SUM(amount_cents) AS total_cents
        FROM transactions_public.transactions
        WHERE direction='debit'
        GROUP BY category
        ORDER BY total_cents DESC
        LIMIT 20
      `.trim();
    }

    return `
      SELECT tx_id, posted_at, amount_cents, direction, category, status
      FROM transactions_public.transactions
      ORDER BY posted_at DESC
      LIMIT 25
    `.trim();
  }
}
