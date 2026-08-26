import assert from 'node:assert/strict';
import test from 'node:test';

import { createEmptyProject, createPerson } from '../../app/lib/genogram/model';
import {
  createPngExportPlan,
  getPngExportFileName,
  getProjectExportBounds,
  PNG_MAX_OUTPUT_DIMENSION,
  PNG_MAX_OUTPUT_PIXELS,
} from '../../app/lib/genogram/export-png';

test('export bounds include people, annotations, and household boundaries outside the viewport', () => {
  const project = createEmptyProject('Whole family');
  project.people = [
    createPerson('person-a', 'A', 'female'),
    createPerson('person-b', 'B', 'male'),
  ];
  project.annotations = [{ id: 'annotation-a', kind: 'text', text: 'Family note' }];
  project.households = [{ id: 'household-a', label: 'Home', memberIds: ['person-a', 'person-b'] }];
  project.canvas.positions = {
    'person-a': { x: 100, y: 200 },
    'person-b': { x: 500, y: 400 },
    'annotation-a': { x: -300, y: -120 },
  };
  project.canvas.viewport = { x: 900, y: 700, zoom: 2 };

  assert.deepEqual(getProjectExportBounds(project), {
    x: -300,
    y: -120,
    width: 974,
    height: 742,
  });
});

test('export bounds use a resized note dimensions', () => {
  const project = createEmptyProject('Resized note');
  project.annotations = [{ id: 'note-a', kind: 'note', text: 'Large note', width: 320, height: 240 }];
  project.canvas.positions = { 'note-a': { x: 40, y: 60 } };

  assert.deepEqual(getProjectExportBounds(project), {
    x: 40,
    y: 60,
    width: 320,
    height: 240,
  });
});

test('a normal PNG export uses 2x density with white padding', () => {
  assert.deepEqual(createPngExportPlan({ x: 10, y: 20, width: 1000, height: 600 }), {
    width: 1112,
    height: 712,
    pixelRatio: 2,
    outputWidth: 2224,
    outputHeight: 1424,
    contentScale: 1,
    translateX: 46,
    translateY: 36,
  });
});

test('a large PNG export is scaled down below browser-safe dimension and pixel limits', () => {
  const plan = createPngExportPlan({ x: -5000, y: -2500, width: 20000, height: 10000 });

  assert.equal(plan.pixelRatio, 2);
  assert.ok(plan.contentScale < 1);
  assert.ok(Math.max(plan.outputWidth, plan.outputHeight) <= PNG_MAX_OUTPUT_DIMENSION);
  assert.ok(plan.outputWidth * plan.outputHeight <= PNG_MAX_OUTPUT_PIXELS);
});

test('PNG downloads reuse the safe versioned project filename', () => {
  const project = createEmptyProject('../Family: Notes?*');

  assert.equal(getPngExportFileName(project), 'Family-Notes-v3.png');
});

test('export bounds include saved emotional-line control points outside node rectangles', () => {
  const project = createEmptyProject('Shaped relationship');
  project.people = [
    createPerson('person-a', 'A', 'female'),
    createPerson('person-b', 'B', 'male'),
  ];
  project.relationships = [{
    id: 'relationship-a',
    type: 'connection',
    source: 'person-a',
    target: 'person-b',
    attributes: { controlPoints: [{ t: 0.5, offset: -260 }] },
  }];
  project.canvas.positions = {
    'person-a': { x: 0, y: 0 },
    'person-b': { x: 500, y: 0 },
  };

  const bounds = getProjectExportBounds(project);

  assert.ok(bounds);
  assert.ok(bounds.y <= -218);
  assert.ok(bounds.height >= 398);
});

test('export bounds include a customized partner line below person nodes', () => {
  const project = createEmptyProject('Low partner line');
  project.people = [
    createPerson('person-a', 'A', 'female'),
    createPerson('person-b', 'B', 'male'),
  ];
  project.relationships = [{
    id: 'relationship-a',
    type: 'marriage',
    source: 'person-a',
    target: 'person-b',
    attributes: { lineOffset: 240 },
  }];
  project.canvas.positions = {
    'person-a': { x: 0, y: 0 },
    'person-b': { x: 300, y: 0 },
  };

  const bounds = getProjectExportBounds(project);

  assert.ok(bounds);
  assert.ok(bounds.y + bounds.height >= 300);
});

test('export bounds include a customized direct sibling line above person nodes', () => {
  const project = createEmptyProject('Direct sibling line');
  project.people = [createPerson('person-a', 'A', 'male'), createPerson('person-b', 'B', 'female')];
  project.relationships = [{ id: 'sibling-link', type: 'sibling', source: 'person-a', target: 'person-b', attributes: { lineOffset: 120 } }];
  project.canvas.positions = { 'person-a': { x: 100, y: 100 }, 'person-b': { x: 360, y: 100 } };

  const bounds = getProjectExportBounds(project);

  assert.ok(bounds);
  assert.ok(bounds.y < 10);
});

test('export bounds include visible person details that overflow the flow-node box', () => {
  const project = createEmptyProject('Wide details');
  project.people = [createPerson('person-a', 'A', 'female', {
    medicalMarkers: [{ id: 'marker-a', label: 'A long medical detail', color: '#3f766d', quadrant: 0 }],
  })];
  project.canvas.positions = { 'person-a': { x: 0, y: 0 } };

  assert.deepEqual(getProjectExportBounds(project), {
    x: -84,
    y: 0,
    width: 300,
    height: 180,
  });
});
