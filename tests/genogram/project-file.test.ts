import assert from 'node:assert/strict';
import test from 'node:test';

import { createEmptyProject, createPerson, CURRENT_SCHEMA_VERSION } from '../../app/lib/genogram/model';
import {
  getProjectFileName,
  MAX_PROJECT_FILE_BYTES,
  parseProjectFile,
  ProjectFileError,
  serializeProject,
} from '../../app/lib/genogram/project-file';

test('a project file round-trips the current project schema', () => {
  const project = createEmptyProject('Round-trip project');
  project.people = [createPerson('person-a', 'A', 'female')];
  project.annotations = [{ id: 'note-a', kind: 'note', text: 'Note', linkedIds: ['person-a'], linkAttributes: { 'person-a': { label: 'Mentor', color: '#dc2626', hidden: false } } }];
  project.canvas.positions = { 'person-a': { x: 100, y: 100 }, 'note-a': { x: 300, y: 300 } };
  project.canvas.personLabelVisibility = { name: false, occupation: false };
  project.canvas.wrapPersonLabels = true;
  project.canvas.viewVisibility = { medical: false, backgrounds: false };

  const contents = serializeProject(project);
  const parsed = parseProjectFile(contents);

  assert.equal(JSON.parse(contents).schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.deepEqual(parsed, project);
});

test('invalid JSON and unsupported schemas are rejected', () => {
  const project = createEmptyProject('Invalid input');

  assert.throws(() => parseProjectFile('{not-json'), (error: unknown) => (
    error instanceof ProjectFileError && error.message === 'Project file is not valid JSON.'
  ));
  assert.throws(() => parseProjectFile(JSON.stringify({ ...project, schemaVersion: 2 })), /schemaVersion must be 3/);
});

test('project files over the size limit are rejected', () => {
  const oversizedContents = `{"padding":"${'x'.repeat(MAX_PROJECT_FILE_BYTES)}"}`;

  assert.throws(() => parseProjectFile(oversizedContents), /larger than 5 MB/);
});

test('download names include the schema version and exclude unsafe filename characters', () => {
  const project = createEmptyProject('../Family: Notes?*');

  assert.equal(getProjectFileName(project), 'Family-Notes-v3.json');
});
