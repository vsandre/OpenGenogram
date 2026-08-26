import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';

import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

test('the bundled MCP server works over stdio', async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve('dist/genogram-mcp.mjs')],
    stderr: 'pipe',
  });
  const client = new Client({ name: 'genogram-canvas-stdio-test', version: '1.0.0' });

  await client.connect(transport);
  try {
    const { tools } = await client.listTools();
    assert.ok(tools.some((tool) => tool.name === 'generate_genogram'));

    const result = await client.callTool({
      name: 'generate_genogram',
      arguments: {
        name: 'Stdio smoke test',
        people: [{ key: 'person', name: 'Person', gender: 'unspecified' }],
      },
    });
    assert.equal(result.isError, undefined);
    assert.equal((result.structuredContent ?? {}).peopleCount, 1);
  } finally {
    await client.close();
  }
});
