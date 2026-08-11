#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseCliArgs } from './args';
import { captureRuntimeSeeds } from './capture';
import { createOutputError, createUnexpectedSeederError } from './diagnostics';
import { resolveCaptureInput } from './input';
import { getDefaultOutputName } from './output';

const help = `Usage:
  pnpm seed:react -- --file path/to/component.tsx [--out candidate.json]
  pnpm seed:react -- --code '<T>Hello</T>' [--stdout]
  echo '<T>Hello</T>' | pnpm seed:react -- --stdin --stdout

Options:
  -f, --file <path>    Render a module whose default export, Seed, or App is a component
  -c, --code <jsx>     Render a JSX expression with GT components pre-imported
      --stdin          Read a JSX expression from standard input
  -o, --out <path>     Write the candidate to this path
      --stdout         Write the candidate JSON to stdout instead of a file
      --locale <tag>   Runtime locale (defaults to the library default)
  -h, --help           Show this help
`;

async function main(): Promise<void> {
  const values = parseCliArgs(process.argv.slice(2));
  if (values.help) {
    process.stdout.write(help);
    return;
  }
  const input = await resolveCaptureInput(values, readStdin);

  const candidate = await captureRuntimeSeeds({
    ...input,
    locale: values.locale,
  });
  const json = `${JSON.stringify(candidate, null, 2)}\n`;
  if (values.stdout) {
    process.stdout.write(json);
    return;
  }
  const output = resolve(
    values.out ?? resolve('.gt/runtime-seeds', getDefaultOutputName(candidate))
  );
  try {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, json, 'utf8');
  } catch (error) {
    throw createOutputError(output, error);
  }
  process.stdout.write(
    `Captured ${candidate.seeds.length} runtime seed${candidate.seeds.length === 1 ? '' : 's'} in ${output}\n`
  );
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

main().catch((error: unknown) => {
  const diagnostic =
    error instanceof Error && error.message.startsWith('gt-react-seed')
      ? error
      : createUnexpectedSeederError(error);
  process.stderr.write(`${diagnostic.message}\n`);
  process.exitCode = 1;
});
