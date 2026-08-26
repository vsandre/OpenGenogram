import assert from 'node:assert/strict';
import test from 'node:test';

import 'fake-indexeddb/auto';
import { openDB } from 'idb';

import {
  deleteLocalProject,
  importLocalProject,
  LEGACY_LOCAL_PROJECT_KEY,
  listLocalProjects,
  loadLocalProject,
  LOCAL_PROJECT_DB_NAME,
  LOCAL_PROJECT_STORE_NAME,
  renameLocalProject,
  saveLocalProject,
} from '../../app/lib/genogram/local-persistence';
import { createEmptyProject } from '../../app/lib/genogram/model';

test('local persistence migrates the legacy project and manages multiple projects', async () => {
  const legacyProject = createEmptyProject('Legacy project');
  const legacyDatabase = await openDB(LOCAL_PROJECT_DB_NAME, 1, {
    upgrade(database) {
      database.createObjectStore(LOCAL_PROJECT_STORE_NAME);
    },
  });
  await legacyDatabase.put(LOCAL_PROJECT_STORE_NAME, legacyProject, LEGACY_LOCAL_PROJECT_KEY);
  legacyDatabase.close();

  assert.deepEqual((await listLocalProjects()).map((project) => project.id), [legacyProject.id]);

  const secondProject = createEmptyProject('Second project');
  secondProject.updatedAt = new Date(Date.now() + 1000).toISOString();
  await saveLocalProject(secondProject);
  assert.deepEqual((await listLocalProjects()).map((project) => project.id), [secondProject.id, legacyProject.id]);

  const renamed = await renameLocalProject(secondProject.id, 'Renamed project');
  assert.equal(renamed.name, 'Renamed project');
  assert.equal((await loadLocalProject(secondProject.id))?.name, 'Renamed project');

  const imported = await importLocalProject(secondProject);
  assert.notEqual(imported.id, secondProject.id);
  assert.equal((await listLocalProjects()).length, 3);

  await deleteLocalProject(legacyProject.id);
  assert.equal(await loadLocalProject(legacyProject.id), null);
  assert.equal((await listLocalProjects()).length, 2);
});
