import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma/prisma.service';

type ReceiptInput = {
  workflowId: string;
  userId: string;
  prompt: string;
  sql: string;
  scrubbedResult: any;
  eventType?: 'EXECUTED' | 'DENIED';
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async writeReceipt(input: ReceiptInput): Promise<{ receiptId: string; resultHash: string }> {
    const resultHash = sha256(JSON.stringify(input.scrubbedResult));
    const receiptId = `QG-${nowCompact()}-${randomHex(5)}`;

    await this.prisma.auditLog.create({
      data: {
        receiptId,
        workflowId: input.workflowId,
        userId: input.userId,
        prompt: input.prompt,
        sql: input.sql,
        resultHash,
        eventType: input.eventType ?? 'EXECUTED',
      },
    });

    return { receiptId, resultHash };
  }
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function nowCompact(): string {
  const d = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds()) +
    pad(d.getMilliseconds(), 3)
  );
}

function randomHex(bytes: number): string {
  return createHash('sha256')
    .update(String(Math.random()) + String(Date.now()))
    .digest('hex')
    .slice(0, bytes * 2);
}
