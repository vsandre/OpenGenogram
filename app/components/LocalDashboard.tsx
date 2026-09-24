'use client';

import { Download, FileUp, FolderOpen, GitBranch, Pencil, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';

import {
  deleteLocalProject,
  importLocalProject,
  listLocalProjects,
  loadLocalProject,
  renameLocalProject,
  saveLocalProject,
  type LocalProjectSummary,
} from '../lib/genogram/local-persistence';
import { createEmptyProject } from '../lib/genogram/model';
import { getProjectFileName, MAX_PROJECT_FILE_BYTES, parseProjectFile, serializeProject } from '../lib/genogram/project-file';
import styles from './LocalDashboard.module.css';

function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function LocalDashboard() {
  const router = useRouter();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [projects, setProjects] = useState<LocalProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listLocalProjects().then((savedProjects) => {
      if (!active) return;
      setProjects(savedProjects);
      setError(null);
    }).catch((caught: unknown) => {
      if (active) setError(errorMessage(caught, 'Local projects could not be loaded.'));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function createProject() {
    setBusyId('create');
    setError(null);
    try {
      const project = createEmptyProject();
      await saveLocalProject(project);
      router.push(`/edit?project=${encodeURIComponent(project.id)}`);
    } catch (caught) {
      setError(errorMessage(caught, 'A local project could not be created.'));
      setBusyId(null);
    }
  }

  async function importProject(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > MAX_PROJECT_FILE_BYTES) {
      setError(`Project file is larger than ${MAX_PROJECT_FILE_BYTES / (1024 * 1024)} MB.`);
      return;
    }

    setBusyId('import');
    setError(null);
    try {
      const project = await importLocalProject(parseProjectFile(await file.text()));
      router.push(`/edit?project=${encodeURIComponent(project.id)}`);
    } catch (caught) {
      setError(errorMessage(caught, 'The project file could not be imported.'));
      setBusyId(null);
    }
  }

  async function renameProject(project: LocalProjectSummary) {
    const nextName = window.prompt('Rename project', project.name);
    if (nextName === null || nextName.trim() === project.name) return;
    setBusyId(project.id);
    setError(null);
    try {
      const renamed = await renameLocalProject(project.id, nextName);
      setProjects((current) => current
        .map((item) => item.id === renamed.id ? renamed : item)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
    } catch (caught) {
      setError(errorMessage(caught, 'The project could not be renamed.'));
    } finally {
      setBusyId(null);
    }
  }

  async function deleteProject(project: LocalProjectSummary) {
    if (!window.confirm(`Delete “${project.name}” from this browser? Download a JSON backup first if you need one.`)) return;
    setBusyId(project.id);
    setError(null);
    try {
      await deleteLocalProject(project.id);
      setProjects((current) => current.filter((item) => item.id !== project.id));
    } catch (caught) {
      setError(errorMessage(caught, 'The project could not be deleted.'));
    } finally {
      setBusyId(null);
    }
  }

  async function downloadProject(project: LocalProjectSummary) {
    setBusyId(project.id);
    setError(null);
    try {
      const savedProject = await loadLocalProject(project.id);
      if (!savedProject) throw new Error('Local project was not found.');
      const url = URL.createObjectURL(new Blob([serializeProject(savedProject)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = getProjectFileName(savedProject);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (caught) {
      setError(errorMessage(caught, 'The project could not be downloaded.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className={styles.dashboardPage}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandIcon} aria-hidden="true"><GitBranch size={22} /></span>
          <div><strong>OpenGenogram</strong><span>Local workspace</span></div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.secondaryButton} type="button" onClick={() => importInputRef.current?.click()} disabled={busyId !== null}>
            <FileUp size={17} aria-hidden="true" /> Import JSON
          </button>
          <button className={styles.primaryButton} type="button" onClick={() => { void createProject(); }} disabled={busyId !== null}>
            <Plus size={17} aria-hidden="true" /> {busyId === 'create' ? 'Creating…' : 'New project'}
          </button>
          <input ref={importInputRef} className={styles.hiddenInput} type="file" accept=".json,application/json" onChange={importProject} aria-label="Import project JSON" />
        </div>
      </header>

      <section className={styles.hero} aria-labelledby="dashboard-title">
        <div>
          <p className={styles.eyebrow}>YOUR LOCAL WORKSPACE</p>
          <h1 id="dashboard-title">Your genograms</h1>
          <p>Create and manage as many projects as your browser storage allows. Nothing is uploaded.</p>
        </div>
        <div className={styles.projectCount} aria-label={`${projects.length} local projects`}>
          <strong>{projects.length}</strong>
          <span>{projects.length === 1 ? 'local project' : 'local projects'}</span>
        </div>
      </section>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}

      <section className={styles.projectsSection} aria-labelledby="projects-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>PROJECTS</p>
            <h2 id="projects-title">Saved in this browser</h2>
          </div>
          {!loading && projects.length > 0 ? <span>Recently updated first</span> : null}
        </div>

        {loading ? (
          <div className={styles.emptyState} role="status">Loading local projects…</div>
        ) : projects.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon} aria-hidden="true"><FolderOpen size={28} /></span>
            <h3>Create your first genogram</h3>
            <p>Start a blank project or import a versioned JSON backup.</p>
            <div className={styles.emptyActions}>
              <button className={styles.primaryButton} type="button" onClick={() => { void createProject(); }} disabled={busyId !== null}><Plus size={17} /> New project</button>
              <button className={styles.secondaryButton} type="button" onClick={() => importInputRef.current?.click()} disabled={busyId !== null}><FileUp size={17} /> Import JSON</button>
            </div>
          </div>
        ) : (
          <div className={styles.projectGrid}>
            {projects.map((project) => (
              <article className={styles.projectCard} key={project.id}>
                <div className={styles.projectPreview} aria-hidden="true">
                  <span className={styles.previewSquare} />
                  <span className={styles.previewCircle} />
                  <i />
                </div>
                <div className={styles.projectCopy}>
                  <p className={styles.eyebrow}>LOCAL PROJECT</p>
                  <h3>{project.name}</h3>
                  <p><Users size={14} aria-hidden="true" /> {project.peopleCount} {project.peopleCount === 1 ? 'person' : 'people'} · {project.relationshipCount} lines</p>
                  <time dateTime={project.updatedAt}>Updated {formatUpdatedAt(project.updatedAt)}</time>
                </div>
                <div className={styles.cardActions}>
                  <Link className={styles.openButton} href={`/edit?project=${encodeURIComponent(project.id)}`}>Open project</Link>
                  <button type="button" onClick={() => { void renameProject(project); }} disabled={busyId !== null} aria-label={`Rename ${project.name}`} title="Rename"><Pencil size={16} /></button>
                  <button type="button" onClick={() => { void downloadProject(project); }} disabled={busyId !== null} aria-label={`Download ${project.name}`} title="Download JSON"><Download size={16} /></button>
                  <button className={styles.deleteButton} type="button" onClick={() => { void deleteProject(project); }} disabled={busyId !== null} aria-label={`Delete ${project.name}`} title="Delete"><Trash2 size={16} /></button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <aside className={styles.privacyNote}>
        <ShieldCheck size={22} aria-hidden="true" />
        <div><strong>Stored only on this device</strong><p>Projects stay in this browser&apos;s IndexedDB. Download JSON backups before clearing browser data or moving to another device.</p></div>
      </aside>
    </main>
  );
}
