import { IsEmail, IsIn, IsOptional } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  // Public-facing roles for fintech demo
  @IsIn(['user', 'admin'])
  role!: 'user' | 'admin';

  // Example scope claim for later
  @IsOptional()
  region?: string;
}
