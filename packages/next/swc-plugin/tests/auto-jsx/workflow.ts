import { readdir, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import type { Example } from './types';
import { oracle, readableOutput } from './oracle';
import { createFixtureError } from './diagnostics.mjs';

export const directory = path.dirname(fileURLToPath(import.meta.url));
export const pluginDirectory = path.resolve(directory, '../..');
export const fixtureDirectory = path.join(directory, 'fixtures');
const corpusPath = path.join(directory, 'corpus.json');
type Corpus = Record<string, { input: string; output: string }>;
let corpus: Promise<Corpus> | undefined;

export function readCorpus(): Promise<Corpus> {
  return (corpus ??= readFile(corpusPath, 'utf8').then((value) =>
    JSON.parse(value)
  ));
}

export async function loadExamples(): Promise<Example[]> {
  const modules = (await readdir(path.join(directory, 'cases')))
    .filter((name) => name.endsWith('.ts'))
    .sort();
  const examples: Example[] = [];
  for (const module of modules) {
    const imported = await import(
      pathToFileURL(path.join(directory, 'cases', module)).href
    );
    examples.push(...imported.examples);
  }
  const names = new Set<string>();
  for (const example of examples) {
    if (
      !/^[a-z0-9-]+\/[a-z0-9-]+$/.test(example.name) ||
      names.has(example.name)
    )
      throw createFixtureError({
        whatHappened: 'An example has an invalid or duplicate name',
        details: example.name,
        fix: 'Use a unique group/name containing lowercase letters, numbers and hyphens',
      });
    names.add(example.name);
  }
  return examples;
}

export function buildNativeDriver(): void {
  execFileSync(
    'cargo',
    [
      'build',
      '--quiet',
      '--manifest-path',
      path.join(pluginDirectory, 'Cargo.toml'),
      '--example',
      'auto_jsx_fixture',
    ],
    { stdio: 'inherit', cwd: pluginDirectory }
  );
}

export function runNative(
  inputs: string[],
  config?: Record<string, unknown>
): string[] {
  const executable = path.join(
    pluginDirectory,
    'target/debug/examples',
    process.platform === 'win32' ? 'auto_jsx_fixture.exe' : 'auto_jsx_fixture'
  );
  return JSON.parse(
    execFileSync(executable, [], {
      input: JSON.stringify(inputs.map((input) => ({ input, config }))),
      maxBuffer: 128 * 1024 * 1024,
      encoding: 'utf8',
    })
  );
}

export async function updateExamples(
  examples: Example[],
  replace = false
): Promise<void> {
  const snapshots: Corpus = replace ? {} : await readCorpus().catch(() => ({}));
  for (const example of examples) {
    const folder = path.join(fixtureDirectory, example.name);
    const output = readableOutput(oracle(example.input));
    const input = `${example.input.trim()}\n`;
    snapshots[example.name] = { input, output };
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, 'input.tsx'), input);
    await writeFile(path.join(folder, 'output.tsx'), output);
  }
  await writeFile(
    corpusPath,
    `${JSON.stringify(Object.fromEntries(Object.entries(snapshots).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))), null, 2)}\n`
  );
  if (replace) {
    for (const group of await readdir(fixtureDirectory, {
      withFileTypes: true,
    })) {
      if (!group.isDirectory()) continue;
      for (const entry of await readdir(
        path.join(fixtureDirectory, group.name),
        { withFileTypes: true }
      )) {
        if (
          entry.isDirectory() &&
          !Object.hasOwn(snapshots, `${group.name}/${entry.name}`)
        )
          await rm(path.join(fixtureDirectory, group.name, entry.name), {
            recursive: true,
          });
      }
    }
  }
  corpus = Promise.resolve(snapshots);
}

export async function readExample(
  example: Example
): Promise<{ input: string; output: string }> {
  const snapshot = (await readCorpus())[example.name];
  if (!snapshot)
    throw createFixtureError({
      whatHappened: 'The compiler snapshot is missing',
      details: example.name,
      fix: 'Run pnpm --filter gt-next examples:auto-jsx',
    });
  return snapshot;
}
