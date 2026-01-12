import { Injectable } from '@nestjs/common';
import { join } from 'node:path';

function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === 'string') env[k] = v;
  }
  return env;
}

@Injectable()
export class McpClientService {
  /**
   * Phase 2: spawn a fresh MCP server inside Docker per request.
   * Transport is still stdio (JSON-RPC over stdin/stdout), just routed through `docker run`.
   */
  async callToolEphemeral<T = any>(name: string, args: Record<string, any>): Promise<T> {
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');

    const mode = process.env.MCP_MODE ?? 'docker';

    let command = 'node';
    let commandArgs: string[] = [];

    if (mode === 'docker') {
      const image = process.env.MCP_SQL_RUNNER_IMAGE ?? 'proofvault-sql-runner:0.2.0';
      const network = process.env.MCP_DOCKER_NETWORK ?? 'proof-vault_default';

      const userUrl = process.env.DATA_DB_USER_URL_DOCKER ?? '';
      const adminUrl = process.env.DATA_DB_ADMIN_URL_DOCKER ?? '';

      if (!userUrl || !adminUrl) throw new Error('Missing DATA_DB_*_URL_DOCKER env vars');

      command = 'docker';
      commandArgs = [
        'run',
        '--rm',
        '-i',
        '--network',
        network,
        '-e',
        `DATA_DB_USER_URL=${userUrl}`,
        '-e',
        `DATA_DB_ADMIN_URL=${adminUrl}`,
        image,
      ];
    } else {
      // fallback: Phase 1 local process (still ephemeral)
      const serverPath = join(process.cwd(), 'mcp', 'sql-runner', 'dist', 'index.js');
      command = 'node';
      commandArgs = [serverPath];
    }

    const transport = new StdioClientTransport({
      command,
      args: commandArgs,
      env: cleanEnv(),
    });

    const client = new Client(
      { name: 'proofvault-orchestrator', version: '0.2.0' },
      { capabilities: {} },
    );

    await client.connect(transport);

    try {
      const res = await client.callTool({ name, arguments: args });
      const text = res?.content?.[0]?.text ?? '{}';
      return JSON.parse(text) as T;
    } finally {
      try {
        await client.close();
      } catch {}
    }
  }
}
