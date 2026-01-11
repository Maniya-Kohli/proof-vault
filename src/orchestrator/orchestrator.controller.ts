import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrchestratorService } from './orchestrator.service';
import { AgentQueryDto } from './dto/query.dto';

@Controller('agent')
export class OrchestratorController {
  constructor(private readonly orchestrator: OrchestratorService) {}

  @UseGuards(JwtAuthGuard)
  @Post('query')
  async query(@Req() req: any, @Body() dto: AgentQueryDto) {
    return this.orchestrator.handleQuery({
      session: req.user,
      prompt: dto.prompt,
    });
  }
}
