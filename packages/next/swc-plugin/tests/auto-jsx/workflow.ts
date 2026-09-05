import { readdir, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile, spawn } from 'node:child_process';
import { setImmediate } from 'node:timers/promises';
import type { Example } from './types';
import { canonical, oracle, readableOutput } from './oracle';
import { createFixtureError } from './diagnostics.mjs';
import { cliResult } from './cli-oracle';
import { classifyCliDivergences } from './cli-divergences';
import { readCorpus, writeCorpus, type Corpus, type Snapshot } from './corpus';

export { readCorpus } from './corpus';

export const directory = path.dirname(fileURLToPath(import.meta.url));
export const pluginDirectory = path.resolve(directory, '../..');
export const fixtureDirectory = path.join(directory, 'fixtures');

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
  const sources = new Map<string, string>();
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
    const source = example.input.trim();
    const duplicate = sources.get(source);
    if (duplicate)
      throw createFixtureError({
        whatHappened: 'Two examples contain the same source',
        details: [duplicate, example.name],
        fix: 'Keep one example or change the syntax to cover a distinct behavior',
      });
    sources.set(source, example.name);
  }
  return examples;
}

/** Cargo can take minutes on a cold CI runner; keep Vitest's IPC responsive. */
export async function runCargo(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('cargo', args, {
      stdio: 'inherit',
      cwd: pluginDirectory,
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else
        reject(
          createFixtureError({
            whatHappened: 'The Rust fixture build failed',
            details: signal ? `Signal: ${signal}` : `Exit code: ${code}`,
            fix: 'Check the Cargo output above',
          })
        );
    });
  });
}

/** Let worker RPC messages drain during thousands of CPU-bound comparisons. */
export async function yieldToRunner(index: number): Promise<void> {
  if (index % 32 === 0) await setImmediate();
}

export async function buildNativeDriver(): Promise<void> {
  await runCargo([
    'build',
    '--quiet',
    '--manifest-path',
    path.join(pluginDirectory, 'Cargo.toml'),
    '--example',
    'auto_jsx_fixture',
  ]);
}

export async function runNative(
  inputs: string[],
  config?: Record<string, unknown>
): Promise<string[]> {
  const executable = path.join(
    pluginDirectory,
    'target/debug/examples',
    process.platform === 'win32' ? 'auto_jsx_fixture.exe' : 'auto_jsx_fixture'
  );
  // A complete corpus can also take longer than Vitest's RPC timeout on a
  // loaded runner. Stream input asynchronously, just like the Cargo build.
  const output = await new Promise<string>((resolve, reject) => {
    const child = execFile(
      executable,
      [],
      { maxBuffer: 128 * 1024 * 1024, encoding: 'utf8' },
      (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout);
      }
    );
    child.stdin?.once('error', reject);
    child.stdin?.end(
      JSON.stringify(inputs.map((input) => ({ input, config })))
    );
  });
  return JSON.parse(output);
}

export async function updateExamples(
  examples: Example[],
  replace = false,
  onProgress?: (completed: number) => void
): Promise<void> {
  const snapshots: Corpus = replace ? {} : { ...(await readCorpus()) };
  const unclassified: string[] = [];
  for (const [index, example] of examples.entries()) {
    const folder = path.join(fixtureDirectory, example.name);
    const compiler = oracle(example.input);
    const output = readableOutput(compiler, example.input);
    const cli = cliResult(example.input);
    const agrees = canonical(compiler) === cli.canonical;
    const cliDivergences = agrees ? [] : classifyCliDivergences(example.input);
    if (!agrees && cliDivergences.length === 0) unclassified.push(example.name);
    // Preserve BOMs and intentional whitespace so materialized examples replay
    // the same source that the live oracles and native/WASM drivers receive.
    const input = example.input.endsWith('\n')
      ? example.input
      : `${example.input}\n`;
    snapshots[example.name] = {
      input,
      output,
      cliOutput: cli.output,
      cliDivergences,
    };
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, 'input.tsx'), input);
    await writeFile(path.join(folder, 'output.tsx'), output);
    await writeFile(path.join(folder, 'cli-output.tsx'), cli.output);
    onProgress?.(index + 1);
  }
  if (unclassified.length)
    throw createFixtureError({
      whatHappened: 'The compiler and CLI disagree on unreviewed examples',
      details: unclassified,
      fix: 'Investigate the generated compiler and CLI outputs before recording a divergence reason',
    });
  await writeCorpus(snapshots);
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
}

export async function readExample(example: Example): Promise<Snapshot> {
  const snapshot = (await readCorpus())[example.name];
  if (!snapshot)
    throw createFixtureError({
      whatHappened: 'The compiler snapshot is missing',
      details: example.name,
      fix: 'Run pnpm --filter gt-next examples:auto-jsx',
    });
  return snapshot;
}
