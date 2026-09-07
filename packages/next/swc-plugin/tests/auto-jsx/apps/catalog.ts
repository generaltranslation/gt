import { readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import type { ParityApp } from './types';
import { createFixtureError } from '../diagnostics.mjs';

export async function loadApps(): Promise<ParityApp[]> {
  const directory = fileURLToPath(new URL('./cases/', import.meta.url));
  const apps: ParityApp[] = [];
  for (const name of (await readdir(directory)).sort()) {
    if (!name.endsWith('.ts')) continue;
    const module = await import(pathToFileURL(path.join(directory, name)).href);
    apps.push(...module.apps);
  }
  apps.sort((a, b) => a.name.localeCompare(b.name));
  const names = new Set<string>();
  for (const app of apps) {
    if (names.has(app.name))
      throw createFixtureError({
        whatHappened: `Duplicate parity app: ${app.name}`,
      });
    names.add(app.name);
    if (!app.files['src/Suite.tsx'] || app.cases.length < 16)
      throw createFixtureError({
        whatHappened: `Parity app ${app.name} needs Suite.tsx and sixteen cases`,
      });
    if (new Set(app.cases).size !== app.cases.length)
      throw createFixtureError({
        whatHappened: `Duplicate case identifiers in ${app.name}`,
      });
  }
  return apps;
}
