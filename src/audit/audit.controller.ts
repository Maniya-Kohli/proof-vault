import { Controller, ForbiddenException, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma/prisma.service';

@Controller('audit')
@UseGuards(AuthGuard('jwt'))
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /api/v1/audit?eventType=DENIED&limit=20
   * RBAC:
   * - admin: can see all
   * - user: only their own rows (userId = req.user.sub)
   */
  @Get()
  async list(
    @Req() req: any,
    @Query('eventType') eventType?: 'DENIED' | 'EXECUTED',
    @Query('limit') limitStr?: string,
    @Query('userId') userIdQuery?: string,
  ) {
    const role: 'user' | 'admin' = req.user?.role;
    const requesterId: string = req.user?.sub;

    const limit = Math.min(Math.max(parseInt(limitStr ?? '20', 10) || 20, 1), 100);

    // If non-admin tries to query someone else's logs, block.
    if (role !== 'admin') {
      if (userIdQuery && userIdQuery !== requesterId) {
        throw new ForbiddenException('Users can only view their own audit logs.');
      }
    }

    const where: any = {};
    if (eventType) where.eventType = eventType;

    // Admin can filter by userId if provided, else see all.
    // User always restricted to self.
    if (role === 'admin') {
      if (userIdQuery) where.userId = userIdQuery;
    } else {
      where.userId = requesterId;
    }

    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        eventType: true,
        receiptId: true,
        workflowId: true,
        userId: true,
        prompt: true,
        sql: true,
        resultHash: true,
        createdAt: true,
      },
    });

    return { count: rows.length, rows };
  }
}
