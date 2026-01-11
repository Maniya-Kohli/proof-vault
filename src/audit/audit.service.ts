import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma/prisma.service';
import { sha256Hex } from '../common/crypto/hash.util';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async writeReceipt(params: {
    workflowId: string;
    userId: string;
    prompt: string;
    sql: string;
    scrubbedResult: any;
  }) {
    const payload = JSON.stringify({
      prompt: params.prompt,
      sql: params.sql,
      result: params.scrubbedResult,
    });

    const resultHash = sha256Hex(payload);
    const receiptId =
      'QG-' + new Date().toISOString().replace(/[-:.TZ]/g, '') + '-' + resultHash.slice(0, 10);

    await this.prisma.auditLog.create({
      data: {
        workflowId: params.workflowId,
        userId: params.userId,
        prompt: params.prompt,
        sql: params.sql,
        resultHash,
        receiptId,
      },
    });

    return { receiptId, resultHash };
  }
}
