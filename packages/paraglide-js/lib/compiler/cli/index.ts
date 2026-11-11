#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { collectContext, watchContext } from '../context.js';

const USAGE = `Usage: paraglide-context [root] [options]

Writes the source context of Paraglide's message usages to a metadata file
next to each message file (messages/en.json → messages/en.metadata.json),
without running the bundler. root defaults to the working directory; paths are
relative to the project root (its nearest package.json).

Import aliases are read from tsconfig.json, package.json and the project's
vite, webpack or rspack config.

Options:
  --include <path>    path or glob to analyze; repeatable (default: the project)
  --exclude <path>    path or glob to skip; repeatable (default: tests, configs)
  --outdir <dir>      Paraglide outdir to use without verification; repeatable
  --project <dir>     inlang project whose messages get metadata; repeatable
                      (default: detected)
  --alias <a=path>    import alias, e.g. ~=./src; repeatable
  --no-bundler-config do not read aliases from a bundler config
  --radius <lines>    lines of context around each usage (default: 10)
  --watch             keep the files up to date
  --verbose           print a summary
  -h, --help          show this help`;

/** Runs the CLI. Returns the exit code; with `--watch`, resolves once watching. */
export async function main(argv: string[]): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        include: { type: 'string', multiple: true },
        exclude: { type: 'string', multiple: true },
        outdir: { type: 'string', multiple: true },
        project: { type: 'string', multiple: true },
        alias: { type: 'string', multiple: true },
        'no-bundler-config': { type: 'boolean' },
        radius: { type: 'string' },
        watch: { type: 'boolean' },
        verbose: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (error) {
    console.error(`${(error as Error).message}\n\n${USAGE}`);
    return 2;
  }
  const { values, positionals } = parsed;
  if (values.help) {
    console.log(USAGE);
    return 0;
  }
  if (
    positionals.length > 1 ||
    (values.radius !== undefined && !/^\d+$/.test(values.radius))
  ) {
    console.error(USAGE);
    return 2;
  }
  const root = positionals[0] ?? process.cwd();
  const options = {
    root,
    include: values.include,
    exclude: values.exclude,
    outdirs: values.outdir,
    inlangProjects: values.project,
    radius: values.radius === undefined ? undefined : Number(values.radius),
    alias: aliases(values.alias ?? [], root),
    bundlerConfigs: values['no-bundler-config'] ? [] : undefined,
    logger: {
      warn: (message: string) => console.warn(message),
      info: (message: string) =>
        values.verbose ? console.log(message) : undefined,
    },
  };
  if (values.watch) {
    const watcher = watchContext(options);
    await watcher.ready;
    process.once('SIGINT', () => {
      watcher.close();
      process.exit(0);
    });
    return 0;
  }
  await collectContext(options);
  return 0;
}

/** `["~=./src"]` → `{ "~": "<root>/src" }`; replacements that are not paths stay as they are. */
function aliases(entries: string[], root: string): Record<string, string> {
  return Object.fromEntries(
    entries.map((entry) => {
      const [find = '', replacement = ''] = entry.split('=', 2);
      return [
        find,
        replacement.startsWith('.')
          ? path.resolve(root, replacement)
          : replacement,
      ];
    })
  );
}

const invoked = process.argv[1] && realpathSync(process.argv[1]);
if (invoked && invoked === realpathSync(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2)).then((code) => {
    if (code !== 0) process.exit(code);
  });
}
