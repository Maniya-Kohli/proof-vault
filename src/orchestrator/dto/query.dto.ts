import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class QueryDto {
  @IsString()
  prompt!: string;

  // Simple approval gate: only admin can set this true to execute needs_review queries
  @IsOptional()
  @IsBoolean()
  approved?: boolean;
}
