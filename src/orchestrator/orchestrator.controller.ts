import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OrchestratorService } from './orchestrator.service';
import { QueryDto } from './dto/query.dto';

@Controller('agent')
export class OrchestratorController {
  constructor(private readonly orchestrator: OrchestratorService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('query')
  async query(@Req() req: any, @Body() body: QueryDto) {
    const authHeader: string = req.headers?.authorization ?? '';
    const sessionToken = authHeader.replace(/^Bearer\s+/i, '');

    return this.orchestrator.handleQuery({
      sessionToken,
      session: req.user,
      prompt: body.prompt,
      approved: body.approved === true,
    });
  }
}
