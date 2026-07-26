import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach } from 'vitest';

/** Directories makeTree created in this test file, removed by the afterEach. */
const created: string[] = [];

export type MakeTreeOptions = {
  /** tmpdir name prefix, so a leaked dir names the suite that made it. */
  prefix?: string;
  /** parent directory for the tmpdir; defaults to os.tmpdir(). */
  root?: string;
};

/** Writes `files` (relative path -> content), creating parent dirs as needed. */
export function writeFiles(dir: string, files: Record<string, string>): void {
  for (const [relative, content] of Object.entries(files)) {
    const absolute = path.join(dir, relative);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content);
  }
}

/**
 * A fresh tmpdir holding `files`, registered for removal by
 * registerTreeCleanup. Most suites here drive the real pipeline over a real
 * project rather than a hand-populated MigrationContext, so this scaffold is
 * the shared setup for nearly every one of them (round-10 finding A10).
 */
export function makeTree(
  files: Record<string, string>,
  options: MakeTreeOptions = {}
): string {
  const root = options.root ?? os.tmpdir();
  fs.mkdirSync(root, { recursive: true });
  const dir = fs.mkdtempSync(path.join(root, options.prefix ?? 'gt-migrate-'));
  created.push(dir);
  writeFiles(dir, files);
  return dir;
}

/**
 * Registers the afterEach that removes every tree this file made. Call it once
 * at module scope in any suite that uses makeTree; a suite with its own
 * afterEach keeps it (hook order does not matter for the removal).
 */
export function registerTreeCleanup(): void {
  afterEach(() => {
    while (created.length) {
      fs.rmSync(created.pop()!, { recursive: true, force: true });
    }
  });
}
