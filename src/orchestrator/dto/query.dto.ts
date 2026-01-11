import { IsString, MaxLength } from 'class-validator';

export class AgentQueryDto {
  @IsString()
  @MaxLength(5000)
  prompt!: string;
}
