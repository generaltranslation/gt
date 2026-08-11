#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { captureRuntimeSeeds } from './capture';
import { createSeederError, createUnexpectedSeederError } from './diagnostics';
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
  const { values } = parseArgs({
    args:
      process.argv[2] === '--' ? process.argv.slice(3) : process.argv.slice(2),
    options: {
      file: { type: 'string', short: 'f' },
      code: { type: 'string', short: 'c' },
      stdin: { type: 'boolean' },
      out: { type: 'string', short: 'o' },
      stdout: { type: 'boolean' },
      locale: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: false,
  });
  if (values.help) {
    process.stdout.write(help);
    return;
  }
  if (values.out && values.stdout) {
    throw createSeederError({
      whatHappened: '--out and --stdout cannot be used together',
      fix: 'Choose a candidate file or stdout as the output destination.',
    });
  }
  const stdinCode = values.stdin ? await readStdin() : undefined;
  const inputs = [values.file, values.code, stdinCode].filter(
    (value) => value != null
  );
  if (inputs.length !== 1) {
    throw createSeederError({
      whatHappened: 'Exactly one input mode is required',
      fix: 'Pass one of --file, --code, or --stdin.',
    });
  }

  const candidate = await captureRuntimeSeeds({
    file: values.file,
    code: values.code ?? stdinCode,
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
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, json, 'utf8');
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
