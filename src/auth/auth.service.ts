import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma/prisma.service';
import { Role } from '@prisma/client';

export type SessionClaims = {
  sub: string;
  email: string;
  role: 'user' | 'admin';
  region?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async issueToken(email: string, role: 'user' | 'admin', region?: string) {
    // Internal DB enum mapping:
    // user -> Role.student (legacy label), admin -> Role.admin
    const dbRole = role === 'admin' ? Role.admin : Role.student;

    const user = await this.prisma.user.upsert({
      where: { email },
      update: { role: dbRole },
      create: { email, role: dbRole },
    });

    const claims: SessionClaims = { sub: user.id, email: user.email, role, region };
    const accessToken = await this.jwt.signAsync(claims);

    return { accessToken, claims };
  }
}
