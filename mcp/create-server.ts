import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import { generateGenogramProject, type GenogramGenerationSpec } from '../app/lib/genogram/generation-spec';
import {
  CHILD_RELATIONSHIP_TYPES,
  CURRENT_SCHEMA_VERSION,
  GENDERS,
  PARTNER_RELATIONSHIP_TYPES,
  RELATIONSHIP_DEFINITIONS,
  RELATIONSHIP_TYPES,
  validateProject,
} from '../app/lib/genogram/model';
import { getProjectFileName, serializeProject } from '../app/lib/genogram/project-file';

const yearSchema = z.number().int().min(0).max(9999).nullable();
const personKeySchema = z.string().trim().min(1).max(80);
const childRelationshipSchema = z.enum(CHILD_RELATIONSHIP_TYPES);
const partnerRelationshipSchema = z.enum(PARTNER_RELATIONSHIP_TYPES);
const relationshipSchema = z.enum(RELATIONSHIP_TYPES);

const generationSpecSchema = z.object({
  name: z.string().trim().min(1).max(120).describe('Project title.'),
  people: z.array(z.object({
    key: personKeySchema.describe('Unique short key used by relationships, such as alex or maternal_grandmother.'),
    name: z.string().trim().min(1).max(120),
    gender: z.enum(GENDERS).optional().describe('Defaults to unspecified when omitted.'),
    birthYear: yearSchema.optional(),
    deathYear: yearSchema.optional(),
    deceased: z.boolean().optional(),
    notes: z.string().max(20_000).optional(),
    isIndexPerson: z.boolean().optional().describe('Marks the primary person whose family is being mapped.'),
  }).strict()).min(1).max(200),
  families: z.array(z.object({
    parents: z.array(personKeySchema).min(1).max(2),
    children: z.array(z.union([
      personKeySchema,
      z.object({
        key: personKeySchema,
        relationship: childRelationshipSchema.optional().describe('Defaults to biological-child.'),
      }).strict(),
    ])).min(1).max(100),
    partnerRelationship: partnerRelationshipSchema.optional().describe('Defaults to unknown-partner, not marriage, when two parents are supplied.'),
  }).strict()).max(200).optional(),
  relationships: z.array(z.object({
    type: relationshipSchema,
    source: personKeySchema,
    target: personKeySchema,
    label: z.string().max(200).optional(),
  }).strict()).max(500).optional().describe('Additional partner, child, twin, sibling, or emotional relationships.'),
  households: z.array(z.object({
    label: z.string().trim().min(1).max(120),
    members: z.array(personKeySchema).min(1).max(200),
  }).strict()).max(100).optional(),
  annotations: z.array(z.object({
    kind: z.enum(['note', 'secret', 'text']),
    text: z.string().min(1).max(10_000),
    linkedTo: z.array(personKeySchema).max(200).optional(),
  }).strict()).max(100).optional(),
}).strict();

const projectRecordSchema = z.record(z.string(), z.unknown());
const generationOutputSchema = z.object({
  fileName: z.string(),
  peopleCount: z.number().int().nonnegative(),
  relationshipCount: z.number().int().nonnegative(),
  warnings: z.array(z.string()),
  project: projectRecordSchema,
});
const validationOutputSchema = z.object({
  valid: z.boolean(),
  fileName: z.string().optional(),
  error: z.string().optional(),
  project: projectRecordSchema.optional(),
});
const notationOutputSchema = z.object({
  schemaVersion: z.number().int(),
  genders: z.array(z.string()),
  relationships: z.array(z.object({
    type: z.string(),
    label: z.string(),
    category: z.string(),
    directed: z.boolean(),
  })),
});

function jsonRecord(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

export function createGenogramMcpServer(): McpServer {
  const server = new McpServer({
    name: 'opengenogram',
    version: '1.0.0',
    description: 'Generate and validate OpenGenogram projects without calling an external model or API.',
  });

  server.registerTool(
    'generate_genogram',
    {
      title: 'Generate a genogram project',
      description: 'Create a validated OpenGenogram v3 project from people, families, and relationships. Use families for parent-child groups and relationships for twins, siblings, partner details, or emotional connections. Returns importable JSON and does not save or upload data.',
      inputSchema: generationSpecSchema,
      outputSchema: generationOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (input) => {
      const { project, warnings } = generateGenogramProject(input as GenogramGenerationSpec);
      const output = {
        fileName: getProjectFileName(project),
        peopleCount: project.people.length,
        relationshipCount: project.relationships.length,
        warnings,
        project: jsonRecord(project),
      };
      return {
        content: [{ type: 'text', text: serializeProject(project) }],
        structuredContent: output,
      };
    },
  );

  server.registerTool(
    'validate_genogram',
    {
      title: 'Validate a genogram project',
      description: 'Validate an existing OpenGenogram project before it is saved or imported.',
      inputSchema: z.object({ project: z.unknown() }).strict(),
      outputSchema: validationOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ project: inputProject }) => {
      try {
        const project = validateProject(inputProject);
        const output = { valid: true, fileName: getProjectFileName(project), project: jsonRecord(project) };
        return {
          content: [{ type: 'text', text: serializeProject(project) }],
          structuredContent: output,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Project validation failed.';
        const output = { valid: false, error: message };
        return {
          content: [{ type: 'text', text: message }],
          structuredContent: output,
        };
      }
    },
  );

  server.registerTool(
    'get_genogram_notation',
    {
      title: 'List supported genogram notation',
      description: 'List the exact gender and relationship values accepted by generate_genogram.',
      inputSchema: z.object({}).strict(),
      outputSchema: notationOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      const output = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        genders: [...GENDERS],
        relationships: RELATIONSHIP_TYPES.map((type) => ({ type, ...RELATIONSHIP_DEFINITIONS[type] }))
          .map(({ type, label, category, directed }) => ({ type, label, category, directed })),
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  );

  return server;
}
