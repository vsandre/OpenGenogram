import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDirectory = await mkdtemp(join(tmpdir(), 'genogram-canvas-tests-'));
const outputFiles = [
  join(tempDirectory, 'project-file.test.mjs'),
  join(tempDirectory, 'store.test.mjs'),
  join(tempDirectory, 'export-png.test.mjs'),
  join(tempDirectory, 'family-edge-geometry.test.mjs'),
  join(tempDirectory, 'flow-adapter.test.mjs'),
  join(tempDirectory, 'relationship-color.test.mjs'),
  join(tempDirectory, 'local-persistence.test.mjs'),
];

try {
  await Promise.all([
    build({
      bundle: true,
      entryPoints: ['tests/genogram/project-file.test.ts'],
      format: 'esm',
      outfile: outputFiles[0],
      platform: 'node',
    }),
    build({
      bundle: true,
      entryPoints: ['tests/genogram/store.test.ts'],
      format: 'esm',
      outfile: outputFiles[1],
      platform: 'node',
    }),
    build({
      bundle: true,
      entryPoints: ['tests/genogram/export-png.test.ts'],
      format: 'esm',
      outfile: outputFiles[2],
      platform: 'node',
    }),
    build({
      bundle: true,
      entryPoints: ['tests/genogram/family-edge-geometry.test.ts'],
      format: 'esm',
      outfile: outputFiles[3],
      platform: 'node',
    }),
    build({
      bundle: true,
      entryPoints: ['tests/genogram/flow-adapter.test.ts'],
      format: 'esm',
      outfile: outputFiles[4],
      platform: 'node',
    }),
    build({
      bundle: true,
      entryPoints: ['tests/genogram/relationship-color.test.ts'],
      format: 'esm',
      outfile: outputFiles[5],
      platform: 'node',
    }),
    build({
      bundle: true,
      entryPoints: ['tests/genogram/local-persistence.test.ts'],
      format: 'esm',
      outfile: outputFiles[6],
      platform: 'node',
    }),
  ]);

  const child = spawn(process.execPath, ['--test', ...outputFiles], { stdio: 'inherit' });
  const exitCode = await new Promise((resolve) => child.once('exit', (code) => resolve(code ?? 1)));
  process.exitCode = exitCode;
} finally {
  await rm(tempDirectory, { force: true, recursive: true });
}
