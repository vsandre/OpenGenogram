import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EMOTIONAL_RELATIONSHIP_TYPES,
  getRelationshipDefinition,
} from '../../app/lib/genogram/model';

test('every emotional relationship has a fixed semantic color', () => {
  for (const type of EMOTIONAL_RELATIONSHIP_TYPES) {
    const color = getRelationshipDefinition(type).color;
    assert.ok(color, type);
    assert.match(color, /^#[0-9a-f]{6}$/i, type);
  }
});

test('emotional relationship colors distinguish the main relationship meanings', () => {
  assert.equal(getRelationshipDefinition('connection').color, '#2563eb');
  assert.equal(getRelationshipDefinition('harmonious').color, '#16a34a');
  assert.equal(getRelationshipDefinition('hostile').color, '#dc2626');
  assert.equal(getRelationshipDefinition('violence').color, '#b91c1c');
  assert.equal(getRelationshipDefinition('indifferent').color, '#9ca3af');
  assert.equal(getRelationshipDefinition('distrust').color, '#0f172a');
});

test('partner and child relationships keep the standard ink color', () => {
  assert.equal(getRelationshipDefinition('marriage').color, undefined);
  assert.equal(getRelationshipDefinition('biological-child').color, undefined);
});
