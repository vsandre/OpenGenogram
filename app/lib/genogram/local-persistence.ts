import { openDB, type DBSchema } from 'idb';

import { createId, validateProject, type Project } from './model';

export const LOCAL_PROJECT_DB_NAME = 'genogram-canvas-local-project';
export const LOCAL_PROJECT_STORE_NAME = 'projects';
export const LEGACY_LOCAL_PROJECT_KEY = 'current';
const LOCAL_PROJECT_DB_VERSION = 2;

export interface LocalProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  peopleCount: number;
  relationshipCount: number;
}

interface LocalProjectDatabase extends DBSchema {
  projects: {
    key: string;
    value: Project;
  };
}

let databasePromise: ReturnType<typeof openDatabase> | null = null;
let operationQueue: Promise<unknown> = Promise.resolve();

function projectSummary(project: Project): LocalProjectSummary {
  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    peopleCount: project.people.length,
    relationshipCount: project.relationships.length,
  };
}

async function openDatabase() {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is not available in this browser.');
  }

  const database = await openDB<LocalProjectDatabase>(LOCAL_PROJECT_DB_NAME, LOCAL_PROJECT_DB_VERSION, {
    upgrade(upgradeDatabase) {
      if (!upgradeDatabase.objectStoreNames.contains(LOCAL_PROJECT_STORE_NAME)) {
        upgradeDatabase.createObjectStore(LOCAL_PROJECT_STORE_NAME);
      }
    },
  });

  const legacyProject = await database.get(LOCAL_PROJECT_STORE_NAME, LEGACY_LOCAL_PROJECT_KEY);
  if (legacyProject) {
    const project = validateProject(legacyProject);
    const transaction = database.transaction(LOCAL_PROJECT_STORE_NAME, 'readwrite');
    await Promise.all([
      transaction.store.put(structuredClone(project), project.id),
      transaction.store.delete(LEGACY_LOCAL_PROJECT_KEY),
    ]);
    await transaction.done;
  }

  return database;
}

function getDatabase() {
  databasePromise ??= openDatabase();
  return databasePromise;
}

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const next = operationQueue.then(operation, operation);
  operationQueue = next.then(() => undefined, () => undefined);
  return next;
}

export function listLocalProjects(): Promise<LocalProjectSummary[]> {
  return enqueue(async () => {
    const projects = await (await getDatabase()).getAll(LOCAL_PROJECT_STORE_NAME);
    return projects
      .map((project) => projectSummary(validateProject(project)))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  });
}

export function loadLocalProject(projectId: string): Promise<Project | null> {
  return enqueue(async () => {
    const project = await (await getDatabase()).get(LOCAL_PROJECT_STORE_NAME, projectId);
    return project ? validateProject(project) : null;
  });
}

export function saveLocalProject(project: Project): Promise<void> {
  const validatedProject = validateProject(project);
  return enqueue(async () => {
    await (await getDatabase()).put(
      LOCAL_PROJECT_STORE_NAME,
      structuredClone(validatedProject),
      validatedProject.id,
    );
  });
}

export function importLocalProject(project: Project): Promise<Project> {
  const importedAt = new Date().toISOString();
  const importedProject = validateProject({
    ...structuredClone(project),
    id: createId('project'),
    createdAt: importedAt,
    updatedAt: importedAt,
  });
  return enqueue(async () => {
    await (await getDatabase()).put(
      LOCAL_PROJECT_STORE_NAME,
      structuredClone(importedProject),
      importedProject.id,
    );
    return importedProject;
  });
}

export function renameLocalProject(projectId: string, name: string): Promise<LocalProjectSummary> {
  const normalizedName = name.trim();
  if (!normalizedName) return Promise.reject(new Error('Project name cannot be empty.'));

  return enqueue(async () => {
    const database = await getDatabase();
    const savedProject = await database.get(LOCAL_PROJECT_STORE_NAME, projectId);
    if (!savedProject) throw new Error('Local project was not found.');
    const project = validateProject({
      ...savedProject,
      name: normalizedName.slice(0, 120),
      updatedAt: new Date().toISOString(),
    });
    await database.put(LOCAL_PROJECT_STORE_NAME, structuredClone(project), project.id);
    return projectSummary(project);
  });
}

export function deleteLocalProject(projectId: string): Promise<void> {
  return enqueue(async () => {
    await (await getDatabase()).delete(LOCAL_PROJECT_STORE_NAME, projectId);
  });
}
