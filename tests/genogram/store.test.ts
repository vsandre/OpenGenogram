import assert from 'node:assert/strict';
import test from 'node:test';

import { createEmptyProject, createPerson, createPreviewProject, createStarterProject, isChildRelationship, PARTNER_RELATIONSHIP_TYPES, type Project } from '../../app/lib/genogram/model';
import { projectToFlowEdges, selectedFamilyChildIds, type FamilyFlowEdge } from '../../app/lib/genogram/flow-adapter';
import { useGenogramStore } from '../../app/lib/genogram/store';

test('replacing a project clears selection and history', () => {
  const store = useGenogramStore.getState();
  const starterPersonId = store.project.people[0]?.id;
  assert.ok(starterPersonId);

  store.addPerson({ name: 'Temporary person' });
  store.setSelection([starterPersonId]);
  assert.equal(useGenogramStore.getState().history.past.length, 1);

  const replacement = createEmptyProject('Opened project');
  const person = createPerson('imported-person', 'Imported person', 'female');
  replacement.people = [person];
  replacement.canvas.positions[person.id] = { x: 100, y: 100 };

  store.replaceProject(replacement);

  const next = useGenogramStore.getState();
  assert.deepEqual(next.project, replacement);
  assert.deepEqual(next.ui.selectedPersonIds, []);
  assert.deepEqual(next.ui.selectedRelationshipIds, []);
  assert.deepEqual(next.ui.selectedHouseholdIds, []);
  assert.deepEqual(next.ui.selectedAnnotationIds, []);
  assert.deepEqual(next.history, { past: [], future: [] });
});

test('an invalid replacement leaves the current project unchanged', () => {
  const store = useGenogramStore.getState();
  const before = structuredClone(store.project);
  const invalidProject = { ...before, schemaVersion: 2 } as unknown as Project;

  assert.throws(() => store.replaceProject(invalidProject), /schemaVersion must be 3/);
  assert.deepEqual(useGenogramStore.getState().project, before);
});

test('annotation links are saved once and cleaned up with their target', () => {
  const store = useGenogramStore.getState();
  const project = createEmptyProject('Annotation links');
  const person = createPerson('linked-person', 'Linked person', 'female');
  project.people = [person];
  project.annotations = [{ id: 'note-a', kind: 'note', text: 'Context note', linkedIds: [] }];
  project.canvas.positions = { 'linked-person': { x: 100, y: 100 }, 'note-a': { x: 300, y: 300 } };
  store.replaceProject(project);

  assert.equal(store.addAnnotationLink('note-a', 'linked-person'), true);
  assert.equal(useGenogramStore.getState().addAnnotationLink('note-a', 'linked-person'), false);
  assert.deepEqual(useGenogramStore.getState().project.annotations[0].linkedIds, ['linked-person']);

  useGenogramStore.getState().updateAnnotationLink('note-a', 'linked-person', { label: 'Mentor', color: '#dc2626', hidden: true });
  assert.deepEqual(useGenogramStore.getState().project.annotations[0].linkAttributes, {
    'linked-person': { label: 'Mentor', color: '#dc2626', hidden: true },
  });

  useGenogramStore.getState().deleteAnnotationLink('note-a', 'linked-person');
  assert.deepEqual(useGenogramStore.getState().project.annotations[0].linkedIds, []);
  assert.equal(useGenogramStore.getState().project.annotations[0].linkAttributes, undefined);

  assert.equal(useGenogramStore.getState().addAnnotationLink('note-a', 'linked-person'), true);
  useGenogramStore.getState().updateAnnotationLink('note-a', 'linked-person', { label: 'Caregiver' });

  useGenogramStore.getState().deletePeople(['linked-person']);
  assert.deepEqual(useGenogramStore.getState().project.annotations[0].linkedIds, []);
  assert.equal(useGenogramStore.getState().project.annotations[0].linkAttributes, undefined);
});

test('moving a child line to another family replaces its parents and saves the new origin', () => {
  const store = useGenogramStore.getState();
  store.replaceProject(createPreviewProject());

  const createdIds = store.moveChildToFamily(
    'preview-liam',
    ['preview-robert', 'preview-helen'],
    { familyOriginOffset: 44 },
  );

  const incoming = useGenogramStore.getState().project.relationships.filter(
    (relationship) => isChildRelationship(relationship.type) && relationship.target === 'preview-liam',
  );
  assert.equal(createdIds.length, 2);
  assert.deepEqual(incoming.map((relationship) => relationship.source).sort(), ['preview-helen', 'preview-robert']);
  assert.deepEqual(incoming.map((relationship) => relationship.attributes.familyOriginOffset), [44, 44]);
});

test('moving either twin branch moves the twin pair but leaves singleton siblings in the original family', () => {
  const store = useGenogramStore.getState();
  store.replaceProject(createPreviewProject());
  const familyEdge = projectToFlowEdges(useGenogramStore.getState().project, ['rel-dm'])
    .find((edge): edge is FamilyFlowEdge => edge.type === 'family' && Boolean(edge.data?.unionId.includes('preview-david')));
  assert.ok(familyEdge?.data);

  const twinIds = selectedFamilyChildIds(familyEdge.data);
  for (const childId of twinIds) {
    useGenogramStore.getState().moveChildToFamily(
      childId,
      ['preview-robert', 'preview-helen'],
      { familyOriginOffset: 22, preserveTwinRelationships: true },
    );
  }

  const relationships = useGenogramStore.getState().project.relationships;
  const parentsOf = (childId: string) => relationships
    .filter((relationship) => isChildRelationship(relationship.type) && relationship.target === childId)
    .map((relationship) => relationship.source)
    .sort();
  assert.deepEqual(twinIds.sort(), ['preview-ava', 'preview-mia']);
  assert.deepEqual(parentsOf('preview-mia'), ['preview-helen', 'preview-robert']);
  assert.deepEqual(parentsOf('preview-ava'), ['preview-helen', 'preview-robert']);
  assert.deepEqual(parentsOf('preview-liam'), ['preview-david', 'preview-sarah']);
  assert.ok(relationships.some((relationship) => relationship.type === 'identical-twins' && relationship.source === 'preview-mia' && relationship.target === 'preview-ava'));
});

test('quick adding a child after twins places the new child beside the twin pair', () => {
  const store = useGenogramStore.getState();
  store.replaceProject(createStarterProject());

  const [firstChildId] = store.quickAddRelative('person-alex', 'child');
  const firstChildRelationship = useGenogramStore.getState().project.relationships.find(
    (relationship) => isChildRelationship(relationship.type) && relationship.target === firstChildId,
  );
  assert.ok(firstChildRelationship);
  useGenogramStore.getState().addTwinSibling(firstChildRelationship.id, 'fraternal-twins');

  const twinRelationship = useGenogramStore.getState().project.relationships.find(
    (relationship) => relationship.type === 'fraternal-twins' && relationship.source === firstChildId,
  );
  assert.ok(twinRelationship);
  const [ordinaryChildId] = useGenogramStore.getState().quickAddRelative('person-alex', 'child');
  const positions = useGenogramStore.getState().project.canvas.positions;

  assert.notDeepEqual(positions[ordinaryChildId], positions[firstChildId]);
  assert.notDeepEqual(positions[ordinaryChildId], positions[twinRelationship.target]);
  assert.ok(positions[ordinaryChildId].x > Math.max(positions[firstChildId].x, positions[twinRelationship.target].x));
});

test('quick adding a sibling defaults to female after male and male after every other gender', () => {
  const cases = [
    { anchorGender: 'male', siblingGender: 'female' },
    { anchorGender: 'female', siblingGender: 'male' },
    { anchorGender: 'nonbinary', siblingGender: 'male' },
  ] as const;

  for (const { anchorGender, siblingGender } of cases) {
    const project = createEmptyProject(`Sibling after ${anchorGender}`);
    const anchor = createPerson('anchor', 'Anchor', anchorGender);
    project.people = [anchor];
    project.canvas.positions[anchor.id] = { x: 230, y: 130 };
    useGenogramStore.getState().replaceProject(project);

    const [siblingId] = useGenogramStore.getState().quickAddRelative(anchor.id, 'sibling');
    const sibling = useGenogramStore.getState().project.people.find((person) => person.id === siblingId);

    assert.equal(sibling?.gender, siblingGender, anchorGender);
  }
});

test('quick adding a sibling without existing parents creates one sibling link without creating parents', () => {
  const project = createEmptyProject('Sibling without parents');
  const anchor = createPerson('anchor', 'Anchor', 'male');
  project.people = [anchor];
  project.canvas.positions[anchor.id] = { x: 230, y: 130 };
  useGenogramStore.getState().replaceProject(project);

  const createdIds = useGenogramStore.getState().quickAddRelative(anchor.id, 'sibling');
  const nextProject = useGenogramStore.getState().project;

  assert.equal(createdIds.length, 1);
  assert.equal(nextProject.people.length, 2);
  assert.equal(nextProject.relationships.length, 1);
  assert.deepEqual(nextProject.relationships.map(({ type, source, target }) => ({ type, source, target })), [
    { type: 'sibling', source: anchor.id, target: createdIds[0] },
  ]);
});

test('canvas label visibility and wrapping are saved as project settings', () => {
  useGenogramStore.getState().replaceProject(createStarterProject());

  useGenogramStore.getState().setPersonLabelVisibility('name', false);
  useGenogramStore.getState().setPersonLabelVisibility('medical', false);
  useGenogramStore.getState().setWrapPersonLabels(true);

  const canvas = useGenogramStore.getState().project.canvas;
  assert.equal(canvas.personLabelVisibility?.name, false);
  assert.equal(canvas.personLabelVisibility?.medical, false);
  assert.equal(canvas.personLabelVisibility?.gender, true);
  assert.equal(canvas.wrapPersonLabels, true);
});

test('canvas attribute view visibility is saved as one global setting', () => {
  useGenogramStore.getState().replaceProject(createStarterProject());

  useGenogramStore.getState().setCanvasViewVisibility('medical', false);
  useGenogramStore.getState().setCanvasViewVisibility('backgrounds', false);

  const views = useGenogramStore.getState().project.canvas.viewVisibility;
  assert.equal(views?.medical, false);
  assert.equal(views?.backgrounds, false);
  assert.equal(views?.cultural, true);
});

test('quick adding a child uses every supported partner relationship as the family union', () => {
  for (const partnerType of PARTNER_RELATIONSHIP_TYPES) {
    const project = createStarterProject();
    project.relationships[0].type = partnerType;
    useGenogramStore.getState().replaceProject(project);

    const [childId] = useGenogramStore.getState().quickAddRelative('person-alex', 'child');
    const nextProject = useGenogramStore.getState().project;
    const incoming = nextProject.relationships.filter(
      (relationship) => isChildRelationship(relationship.type) && relationship.target === childId,
    );

    assert.deepEqual(incoming.map((relationship) => relationship.source).sort(), ['person-alex', 'person-jordan'], partnerType);
    assert.ok(projectToFlowEdges(nextProject).some((edge) => edge.type === 'family' && edge.data?.singles.some((branch) => branch.childId === childId)), partnerType);
  }
});
