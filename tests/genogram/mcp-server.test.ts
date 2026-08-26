import assert from 'node:assert/strict';
import test from 'node:test';

import { Client, InMemoryTransport } from '@modelcontextprotocol/client';

import { createGenogramMcpServer } from '../../mcp/create-server';

test('the MCP server lists and executes genogram tools over the protocol', async () => {
  const server = createGenogramMcpServer();
  const client = new Client({ name: 'genogram-canvas-tests', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  try {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((tool) => tool.name).sort(), [
      'generate_genogram',
      'get_genogram_notation',
      'validate_genogram',
    ]);

    const generation = await client.callTool({
      name: 'generate_genogram',
      arguments: {
        name: 'MCP family',
        people: [
          { key: 'parent-1', name: 'Parent 1', gender: 'female' },
          { key: 'parent-2', name: 'Parent 2', gender: 'male' },
          { key: 'child', name: 'Child', gender: 'unspecified' },
        ],
        families: [{
          parents: ['parent-1', 'parent-2'],
          children: ['child'],
          partnerRelationship: 'marriage',
        }],
      },
    });

    assert.equal(generation.isError, undefined);
    const output = generation.structuredContent as Record<string, unknown>;
    assert.equal(output.peopleCount, 3);
    assert.equal(output.relationshipCount, 3);
    assert.match(String(output.fileName), /MCP-family-v3\.json$/);
    const project = output.project as Record<string, unknown>;
    assert.equal(project.schemaVersion, 3);

    const validation = await client.callTool({
      name: 'validate_genogram',
      arguments: { project },
    });
    assert.equal((validation.structuredContent as Record<string, unknown>).valid, true);

    const notation = await client.callTool({ name: 'get_genogram_notation', arguments: {} });
    const notationOutput = notation.structuredContent as Record<string, unknown>;
    assert.equal(notationOutput.schemaVersion, 3);
    assert.ok((notationOutput.relationships as unknown[]).length > 40);
  } finally {
    await client.close();
    await server.close();
  }
});
