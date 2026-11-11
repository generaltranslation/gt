import fs from 'node:fs';
import path from 'node:path';
import { isWithin } from '../utils/paths.js';

/** The nearest directory at or above `directory` with a package.json, else `directory`. */
export function findProjectRoot(directory: string): string {
  for (let current = directory; ; current = path.dirname(current)) {
    if (fs.existsSync(path.join(current, 'package.json'))) return current;
    if (path.dirname(current) === current) return directory;
  }
}

/** The monorepo root above `projectRoot`, if any. */
export function findWorkspaceRoot(projectRoot: string): string | undefined {
  for (
    let current = path.dirname(projectRoot);
    ;
    current = path.dirname(current)
  ) {
    if (isWorkspaceRoot(current)) return current;
    if (path.dirname(current) === current) return undefined;
  }
}

/** `directory` and each directory above it up to `top`, nearest first. */
export function directoriesUpTo(directory: string, top: string): string[] {
  if (!isWithin(top, directory)) return [directory];

  const directories: string[] = [];

  for (let current = directory; current !== top; ) {
    directories.push(current);
    current = path.dirname(current);
  }

  return [...directories, top];
}

function isWorkspaceRoot(directory: string): boolean {
  const markers = [
    'pnpm-workspace.yaml',
    'lerna.json',
    'nx.json',
    'turbo.json',
    'rush.json',
  ];
  if (markers.some((marker) => fs.existsSync(path.join(directory, marker))))
    return true;
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(directory, 'package.json'), 'utf8')
    );
    return manifest.workspaces !== undefined;
  } catch {
    return false;
  }
}
