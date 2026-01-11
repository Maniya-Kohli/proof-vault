import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma/prisma.service';
import { Role } from '@prisma/client';

export type AuthorizedSchemas = {
  databases: Array<{
    name: string;
    tables: Array<{ name: string; columns?: string[] }>;
    scope?: any;
    clearance?: string;
  }>;
};

@Injectable()
export class PolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async getAuthorizedSchemasForRole(role: 'user' | 'admin'): Promise<AuthorizedSchemas> {
    const dbRole = role === 'admin' ? Role.admin : Role.student;
    const policy = await this.prisma.policy.findUnique({ where: { role: dbRole } });
    return (policy?.allowed as any) ?? { databases: [] };
  }
}
