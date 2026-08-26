import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultPersonVisualSettings, createEmptyProject, createPerson, createPreviewProject, createStarterProject, getRelationshipDefinition, isChildRelationship } from '../../app/lib/genogram/model';
import { inferAutomaticRelationship, leftmostFamilyBranchSelection, personSymbolAnchorOffsets, projectToFlowEdges, selectedFamilyChildIds, type FamilyFlowEdge } from '../../app/lib/genogram/flow-adapter';

test('the starter project is one connected family with two parents and one child', () => {
  const project = createStarterProject();
  const childRelationships = project.relationships.filter((relationship) => isChildRelationship(relationship.type));
  const edges = projectToFlowEdges(project);

  assert.deepEqual(project.people.map((person) => person.id), ['person-alex', 'person-jordan', 'person-sam']);
  assert.deepEqual(childRelationships.map((relationship) => relationship.source).sort(), ['person-alex', 'person-jordan']);
  assert.deepEqual(childRelationships.map((relationship) => relationship.target), ['person-sam', 'person-sam']);
  assert.ok(edges.some((edge) => edge.id === 'relationship-couple' && edge.type === 'relationship'));
  assert.ok(edges.some((edge) => edge.type === 'family' && edge.target === 'person-sam'));
});

test('automatic connections infer partner, child, and parent from vertical position', () => {
  assert.deepEqual(inferAutomaticRelationship('source', 'target', 100, 180), {
    type: 'marriage', source: 'source', target: 'target', targetRole: 'Partner',
  });
  assert.deepEqual(inferAutomaticRelationship('source', 'target', 100, 240), {
    type: 'biological-child', source: 'source', target: 'target', targetRole: 'Child',
  });
  assert.deepEqual(inferAutomaticRelationship('source', 'target', 240, 100), {
    type: 'biological-child', source: 'target', target: 'source', targetRole: 'Parent',
  });
});

test('a direct sibling relationship connects the top handles', () => {
  const project = createEmptyProject('Direct siblings');
  project.people = [createPerson('person-a', 'A', 'male'), createPerson('person-b', 'B', 'female')];
  project.relationships = [{ id: 'sibling-link', type: 'sibling', source: 'person-a', target: 'person-b', attributes: {} }];
  project.canvas.positions = { 'person-a': { x: 100, y: 200 }, 'person-b': { x: 360, y: 200 } };

  const edge = projectToFlowEdges(project).find((item) => item.id === 'sibling-link');

  assert.equal(edge?.sourceHandle, 'top-source');
  assert.equal(edge?.targetHandle, 'top-target');
});

test('changing person display size does not move relationship anchors', () => {
  const person = createPerson('person-a', 'A', 'male');
  const anchors = ['small', 'medium', 'large'].map((size) => personSymbolAnchorOffsets({
    ...person,
    visualSettings: { ...createDefaultPersonVisualSettings(), ...person.visualSettings, size: size as 'small' | 'medium' | 'large' },
  }));

  assert.deepEqual(anchors[0], anchors[1]);
  assert.deepEqual(anchors[2], anchors[1]);
});

test('selecting a child family edge does not visually select the parents partner line', () => {
  const project = createPreviewProject();
  const childRelationship = project.relationships.find((relationship) => isChildRelationship(relationship.type));
  assert.ok(childRelationship);

  const edges = projectToFlowEdges(project, [childRelationship.id]);
  const familyEdge = edges.find((edge) => edge.type === 'family');
  const partnerEdge = edges.find((edge) => {
    if (edge.type !== 'relationship' || !edge.data) return false;
    return getRelationshipDefinition(edge.data.relationship.type).category === 'partner';
  });

  assert.equal(familyEdge?.selected, true);
  assert.equal(partnerEdge?.selected, false);
});

test('a mixed family edge preserves the specifically selected child branch', () => {
  const project = createPreviewProject();
  const familyEdge = projectToFlowEdges(project, ['rel-dm']).find((edge): edge is FamilyFlowEdge => edge.type === 'family' && Boolean(edge.data?.unionId.includes('preview-david')));
  const data = familyEdge?.data;
  assert.ok(data);

  assert.deepEqual(data.selectedRelationshipIds, ['rel-dm']);
  assert.equal(familyEdge.selectable, false);
  assert.equal(data.singles.some((branch) => branch.childId === 'preview-liam'), true);
  assert.equal(data.twins.some((twin) => twin.first.childId === 'preview-mia' && twin.second.childId === 'preview-ava'), true);
  assert.ok(data.twins[0].first.y - data.siblingY >= 68);
});

test('moving one twin branch keeps the twin pair together without moving singleton siblings', () => {
  const project = createPreviewProject();
  const twinEdge = projectToFlowEdges(project, ['rel-dm']).find((edge): edge is FamilyFlowEdge => edge.type === 'family' && Boolean(edge.data?.unionId.includes('preview-david')));
  const singleEdge = projectToFlowEdges(project, ['rel-dl']).find((edge): edge is FamilyFlowEdge => edge.type === 'family' && Boolean(edge.data?.unionId.includes('preview-david')));

  assert.ok(twinEdge?.data);
  assert.ok(singleEdge?.data);
  assert.deepEqual(selectedFamilyChildIds(twinEdge.data), ['preview-mia', 'preview-ava']);
  assert.deepEqual(selectedFamilyChildIds(singleEdge.data), ['preview-liam']);
});

test('the shared family trunk defaults to the leftmost child branch', () => {
  const project = createPreviewProject();
  const familyEdge = projectToFlowEdges(project, []).find((edge): edge is FamilyFlowEdge => edge.type === 'family' && Boolean(edge.data?.unionId.includes('preview-david')));
  assert.ok(familyEdge?.data);

  assert.deepEqual(leftmostFamilyBranchSelection(familyEdge.data), {
    childId: 'preview-liam',
    relationshipIds: ['rel-dl', 'rel-sl'],
  });
});

test('selecting another child branch does not move the shared family trunk', () => {
  const project = createPreviewProject();
  project.relationships.find((relationship) => relationship.id === 'rel-dl')!.attributes = { familyOriginOffset: -38, siblingOffset: 116 };
  project.relationships.find((relationship) => relationship.id === 'rel-dp')!.attributes = { familyOriginOffset: 54, siblingOffset: 74 };

  const getFamilyData = (selectedRelationshipId: string) => projectToFlowEdges(project, [selectedRelationshipId])
    .find((edge): edge is FamilyFlowEdge => edge.type === 'family' && Boolean(edge.data?.unionId.includes('preview-david')))!.data!;
  const leftSelected = getFamilyData('rel-dl');
  const rightSelected = getFamilyData('rel-dp');

  assert.equal(leftSelected.originOffset, -38);
  assert.equal(leftSelected.siblingOffset, 116);
  assert.equal(rightSelected.originOffset, leftSelected.originOffset);
  assert.equal(rightSelected.siblingOffset, leftSelected.siblingOffset);
});

test('a directed emotional relationship arrow uses its fixed color until manually overridden', () => {
  const project = createPreviewProject();
  project.relationships.push({
    id: 'rel-emotional-abuse',
    type: 'emotional-abuse',
    source: 'preview-david',
    target: 'preview-sarah',
    attributes: {},
  });

  let edge = projectToFlowEdges(project, []).find((item) => item.id === 'rel-emotional-abuse');
  assert.equal(typeof edge?.markerEnd === 'object' ? edge.markerEnd.color : undefined, '#dc2626');

  project.relationships.at(-1)!.attributes.color = '#9333ea';
  edge = projectToFlowEdges(project, []).find((item) => item.id === 'rel-emotional-abuse');
  assert.equal(typeof edge?.markerEnd === 'object' ? edge.markerEnd.color : undefined, '#9333ea');
});

test('an annotation link is rendered as a selectable straight gray dashed edge', () => {
  const project = createEmptyProject('Annotation link');
  project.people = [createPerson('person-a', 'A', 'male')];
  project.annotations = [{ id: 'note-a', kind: 'note', text: 'Note', linkedIds: ['person-a'] }];
  project.canvas.positions = { 'person-a': { x: 100, y: 100 }, 'note-a': { x: 300, y: 300 } };

  const edgeId = 'annotation-link-note-a-person-a';
  const edge = projectToFlowEdges(project, [], edgeId).find((item) => item.data?.kind === 'annotation-link');

  assert.equal(edge?.source, 'note-a');
  assert.equal(edge?.target, 'person-a');
  assert.equal(edge?.sourceHandle, 'center-source');
  assert.equal(edge?.targetHandle, 'center-target');
  assert.equal(edge?.type, 'straight');
  assert.equal(edge?.selectable, true);
  assert.equal(edge?.selected, true);
  assert.equal(edge?.style?.strokeWidth, 3);
  assert.equal(edge?.style?.stroke, '#64748b');
  assert.equal(edge?.style?.strokeDasharray, '6 5');
  assert.equal(edge?.zIndex, 0);
});
