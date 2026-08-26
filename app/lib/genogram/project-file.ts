import {
  CURRENT_SCHEMA_VERSION,
  ProjectValidationError,
  validateProject,
  type Project,
} from './model';

export const MAX_PROJECT_FILE_BYTES = 5 * 1024 * 1024;

export class ProjectFileError extends Error {
  readonly code = 'INVALID_PROJECT_FILE';

  constructor(message: string) {
    super(message);
    this.name = 'ProjectFileError';
  }
}

export function serializeProject(project: Project): string {
  const validated = validateProject(project);
  return JSON.stringify(validated, null, 2);
}

export function parseProjectFile(contents: string): Project {
  if (typeof contents !== 'string') {
    throw new ProjectFileError('Project file contents must be text.');
  }

  if (new TextEncoder().encode(contents).byteLength > MAX_PROJECT_FILE_BYTES) {
    throw new ProjectFileError(`Project file is larger than ${MAX_PROJECT_FILE_BYTES / (1024 * 1024)} MB.`);
  }

  let value: unknown;
  try {
    value = JSON.parse(contents) as unknown;
  } catch {
    throw new ProjectFileError('Project file is not valid JSON.');
  }

  try {
    return validateProject(value);
  } catch (error) {
    if (error instanceof ProjectValidationError) {
      throw new ProjectFileError(`Invalid project file: ${error.message}`);
    }
    throw new ProjectFileError('Project file could not be validated.');
  }
}

export function getProjectFileName(project: Project, extension: 'json' | 'png' = 'json'): string {
  const safeName = project.name
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+|\.+$/g, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/^-+|-+$/g, '');

  return `${safeName || 'genogram'}-v${CURRENT_SCHEMA_VERSION}.${extension}`;
}
