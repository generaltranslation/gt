#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { collectContext, type CollectContextOptions } from '../context.js';
import { findProjectRoot } from '../project/roots.js';

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
  --cache             keep what a run found in gt-lock.json, so that the next
                      run skips the files that did not change
  --verbose          print a summary
  -h, --help          show this help`;

type Arguments = ReturnType<typeof parseArguments>['values'];

/** Runs the CLI. Returns the exit code. */
export async function main(argv: string[]): Promise<number> {
  let parsed;

  try {
    parsed = parseArguments(argv);
  } catch (error) {
    console.error(`${(error as Error).message}\n\n${USAGE}`);
    return 2;
  }

  const { values, positionals } = parsed;

  if (values.help) {
    console.log(USAGE);
    return 0;
  }

  const isRadiusValid =
    values.radius === undefined || /^\d+$/.test(values.radius);
  if (positionals.length > 1 || !isRadiusValid) {
    console.error(USAGE);
    return 2;
  }

  const root = positionals[0] ?? process.cwd();
  await collectContext(contextOptions(values, root));

  return 0;
}

/** Throws on an unknown option or a missing value. */
function parseArguments(argv: string[]) {
  return parseArgs({
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
      cache: { type: 'boolean' },
      verbose: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
}

function contextOptions(
  values: Arguments,
  root: string
): CollectContextOptions {
  // Relative to the project root, like every other path.
  const projectRoot = findProjectRoot(path.resolve(root));

  return {
    root,
    include: values.include,
    exclude: values.exclude,
    outdirs: values.outdir,
    inlangProjects: values.project,
    radius: values.radius === undefined ? undefined : Number(values.radius),
    alias: aliases(values.alias ?? [], projectRoot),
    bundlerConfigs: values['no-bundler-config'] ? [] : undefined,
    cache: values.cache,
    logger: {
      warn: (message) => console.warn(message),
      info: (message) => (values.verbose ? console.log(message) : undefined),
    },
  };
}

/** `["~=./src"]` → `{ "~": "<project root>/src" }`; replacements that are not paths stay as they are. */
function aliases(
  entries: string[],
  projectRoot: string
): Record<string, string> {
  return Object.fromEntries(
    entries.map((entry) => {
      const [find = '', replacement = ''] = entry.split('=', 2);
      const isRelativePath = replacement.startsWith('.');

      return [
        find,
        isRelativePath ? path.resolve(projectRoot, replacement) : replacement,
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
