import assert from 'node:assert/strict';
import test from 'node:test';

import { GenogramGenerationError, generateGenogramProject } from '../../app/lib/genogram/generation-spec';
import { validateProject } from '../../app/lib/genogram/model';

const fixedNow = '2026-08-26T00:00:00.000Z';

test('an AI-friendly family spec becomes a validated and laid-out project', () => {
  const { project, warnings } = generateGenogramProject({
    name: 'Rivera family',
    people: [
      { key: 'alex', name: 'Alex', gender: 'male', birthYear: 1988, isIndexPerson: true },
      { key: 'jordan', name: 'Jordan', gender: 'female', birthYear: 1990 },
      { key: 'sam', name: 'Sam', gender: 'male', birthYear: 2016 },
    ],
    families: [{ parents: ['alex', 'jordan'], children: ['sam'], partnerRelationship: 'marriage' }],
    annotations: [{ kind: 'note', text: 'Generated from a structured family description.', linkedTo: ['sam'] }],
  }, { now: fixedNow });

  assert.equal(warnings.length, 0);
  assert.equal(project.schemaVersion, 3);
  assert.equal(project.people.length, 3);
  assert.equal(project.relationships.length, 3);
  assert.equal(project.annotations.length, 1);
  assert.equal(project.createdAt, fixedNow);
  assert.equal(project.updatedAt, fixedNow);

  const alex = project.people.find((person) => person.name === 'Alex');
  const jordan = project.people.find((person) => person.name === 'Jordan');
  const sam = project.people.find((person) => person.name === 'Sam');
  assert.ok(alex && jordan && sam);
  assert.equal(project.canvas.positions[alex.id].y, project.canvas.positions[jordan.id].y);
  assert.ok(project.canvas.positions[sam.id].y > project.canvas.positions[alex.id].y);
  assert.doesNotThrow(() => validateProject(project));
});

test('two-parent families never infer marriage when the partner relationship is omitted', () => {
  const { project, warnings } = generateGenogramProject({
    name: 'Unknown partnership',
    people: [
      { key: 'parent-a', name: 'Parent A' },
      { key: 'parent-b', name: 'Parent B' },
      { key: 'child', name: 'Child' },
    ],
    families: [{ parents: ['parent-a', 'parent-b'], children: ['child'] }],
  }, { now: fixedNow });

  assert.equal(project.relationships[0].type, 'unknown-partner');
  assert.equal(warnings.length, 1);
});

test('twins share a generation after parent-child relationships are expanded', () => {
  const { project } = generateGenogramProject({
    name: 'Twin family',
    people: [
      { key: 'p1', name: 'Parent 1' },
      { key: 'p2', name: 'Parent 2' },
      { key: 'c1', name: 'Child 1' },
      { key: 'c2', name: 'Child 2' },
    ],
    families: [{ parents: ['p1', 'p2'], children: ['c1', 'c2'], partnerRelationship: 'marriage' }],
    relationships: [{ type: 'identical-twins', source: 'c1', target: 'c2' }],
  }, { now: fixedNow });

  const firstTwin = project.people.find((person) => person.name === 'Child 1');
  const secondTwin = project.people.find((person) => person.name === 'Child 2');
  assert.ok(firstTwin && secondTwin);
  assert.equal(project.canvas.positions[firstTwin.id].y, project.canvas.positions[secondTwin.id].y);
  assert.equal(project.relationships.filter((relationship) => relationship.type === 'identical-twins').length, 1);
});

test('unknown person keys and generation cycles are rejected', () => {
  assert.throws(() => generateGenogramProject({
    name: 'Unknown person',
    people: [{ key: 'a', name: 'A' }],
    relationships: [{ type: 'close', source: 'a', target: 'missing' }],
  }, { now: fixedNow }), GenogramGenerationError);

  assert.throws(() => generateGenogramProject({
    name: 'Cycle',
    people: [{ key: 'a', name: 'A' }, { key: 'b', name: 'B' }],
    relationships: [
      { type: 'biological-child', source: 'a', target: 'b' },
      { type: 'biological-child', source: 'b', target: 'a' },
    ],
  }, { now: fixedNow }), /generation cycle/);
});
