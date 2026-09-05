import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CliDivergence } from './cli-divergences';
import { createFixtureError } from './diagnostics.mjs';

export interface Snapshot {
  input: string;
  output: string;
  cliOutput: string;
  cliDivergences: CliDivergence[];
}

export type Corpus = Record<string, Snapshot>;
export const corpusDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'corpus'
);
let corpus: Promise<Corpus> | undefined;

/** Stable name-based shards avoid rewriting every fixture when one is added. */
function shardName(name: string): string {
  const group = name.split('/')[0];
  const bucket = createHash('sha256').update(name).digest('hex')[0];
  return `${group}/${bucket}.json`;
}

export function readCorpus(): Promise<Corpus> {
  return (corpus ??= (async () => {
    const snapshots: Corpus = {};
    for (const group of await readdir(corpusDirectory, {
      withFileTypes: true,
    })) {
      if (!group.isDirectory()) continue;
      for (const file of await readdir(
        path.join(corpusDirectory, group.name)
      )) {
        if (!file.endsWith('.json')) continue;
        const entries = JSON.parse(
          await readFile(path.join(corpusDirectory, group.name, file), 'utf8')
        ) as Corpus;
        for (const [name, snapshot] of Object.entries(entries)) {
          if (
            Object.hasOwn(snapshots, name) ||
            shardName(name) !== `${group.name}/${file}`
          )
            throw createFixtureError({
              whatHappened:
                'A compiler fixture is duplicated or stored in the wrong shard',
              details: [name, `${group.name}/${file}`],
              fix: 'Run pnpm --filter gt-next examples:auto-jsx to rebuild the corpus',
            });
          snapshots[name] = snapshot;
        }
      }
    }
    return snapshots;
  })());
}

export async function writeCorpus(snapshots: Corpus): Promise<void> {
  const shards = new Map<string, Corpus>();
  const families: Record<string, number> = {};
  const divergenceCounts: Record<string, number> = {};
  let cliAgrees = 0;
  for (const [name, snapshot] of Object.entries(snapshots).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0
  )) {
    const shard = shardName(name);
    if (!shards.has(shard)) shards.set(shard, {});
    shards.get(shard)![name] = snapshot;
    const family = name.split('/')[0];
    families[family] = (families[family] ?? 0) + 1;
    if (snapshot.cliDivergences.length === 0) cliAgrees++;
    for (const reason of snapshot.cliDivergences)
      divergenceCounts[reason] = (divergenceCounts[reason] ?? 0) + 1;
  }
  for (const [shard, entries] of shards) {
    const filename = path.join(corpusDirectory, shard);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, `${JSON.stringify(entries, null, 2)}\n`);
  }
  for (const group of await readdir(corpusDirectory, { withFileTypes: true })) {
    if (!group.isDirectory()) continue;
    for (const file of await readdir(path.join(corpusDirectory, group.name))) {
      if (file.endsWith('.json') && !shards.has(`${group.name}/${file}`))
        await rm(path.join(corpusDirectory, group.name, file));
    }
  }
  await writeFile(
    path.join(corpusDirectory, 'coverage.json'),
    `${JSON.stringify(
      {
        examples: Object.keys(snapshots).length,
        uniqueInputs: new Set(
          Object.values(snapshots).map(({ input }) => input)
        ).size,
        families,
        cliAgrees,
        cliDisagrees: Object.keys(snapshots).length - cliAgrees,
        divergenceCounts: Object.fromEntries(
          Object.entries(divergenceCounts).sort()
        ),
      },
      null,
      2
    )}\n`
  );
  corpus = Promise.resolve(snapshots);
}
