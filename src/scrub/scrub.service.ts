import { Injectable } from '@nestjs/common';

@Injectable()
export class ScrubService {
  scrubRows(rows: any[]): any[] {
    return rows.map((row) => scrubValue(row));
  }
}

function scrubValue(value: any, keyPath: string[] = []): any {
  if (value === null || value === undefined) return value;

  const key = keyPath[keyPath.length - 1]?.toLowerCase();

  // Key-based redaction (fintech-friendly)
  if (typeof key === 'string') {
    if (key.includes('email')) return '[REDACTED_EMAIL]';
    if (key.includes('phone')) return '[REDACTED_PHONE]';
    if (key.includes('ssn')) return '[REDACTED_SSN]';
    if (key === 'dob' || key.includes('date_of_birth')) return '[REDACTED_DOB]';
    if (key.includes('address')) return '[REDACTED_ADDRESS]';
  }

  // Value-based redaction (fallback)
  if (typeof value === 'string') return scrubString(value);

  if (Array.isArray(value)) return value.map((v) => scrubValue(v, keyPath));

  if (typeof value === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = scrubValue(v, [...keyPath, k]);
    }
    return out;
  }

  return value;
}

function scrubString(s: string): string {
  // email
  s = s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]');
  // US phone (naive)
  s = s.replace(/(\+?1\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, '[REDACTED_PHONE]');
  // SSN (naive)
  s = s.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]');
  return s;
}
