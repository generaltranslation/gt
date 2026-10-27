#!/usr/bin/env node

// Runs the publint and attw checks that tsdown runs for packages built with
// packageChecks in tsdown.preset.mts, for packages whose declarations are
// written after tsdown (emit-types) or that are not built with tsdown.
// Run it from a package directory after the package is built.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Resolution kinds each attw profile ignores (same as attw and tsdown).
export const ignoredResolutionKinds = {
  node16: ['node10'],
  'esm-only': ['node10', 'node16-cjs'],
};

// Packages not listed use the node16 profile with no exceptions.
// ignoreProblems lists attw problem kinds and needs a reason per package.
export const packageCheckOptions = {
  gt: { profile: 'esm-only' },
  'gtx-cli': { profile: 'esm-only' },
  locadex: { profile: 'esm-only' },
  'gt-payload': { profile: 'esm-only' },
  '@generaltranslation/python-extractor': {
    profile: 'esm-only',
    // A WebAssembly asset, not a module with types.
    excludeEntrypoints: ['./tree-sitter-python.wasm'],
  },
  '@generaltranslation/react-core-linter': { profile: 'esm-only' },
  'gt-remark': { profile: 'esm-only' },
  'gt-sanity': { profile: 'esm-only' },
  '@generaltranslation/vue-extractor': { profile: 'esm-only' },
  'gt-next': {
    profile: 'node16',
    // Pre-existing: tsc emits CJS-scoped .d.ts that also serve the .mjs build,
    // so node16/nodenext ESM consumers get CJS types. For default exports
    // (gt-next/link) that means CJS-namespace interop types. Next apps
    // resolve with bundler, so the practical impact is low. attw cannot
    // ignore a problem per entrypoint and every gt-next export has it, so
    // this stays package-wide until the ESM build emits .d.mts (follow-up).
    ignoreProblems: ['FalseCJS'],
  },
  'gt-react-native': {
    profile: 'node16',
    // dist/module holds ESM syntax in .js files without "type": "module".
    // Metro and other bundlers read it as ESM; Node does not load it.
    ignoreProblems: ['UnexpectedModuleSyntax'],
  },
};

export function getCheckOptions(packageName) {
  return { profile: 'node16', ...packageCheckOptions[packageName] };
}

export function filterAttwProblems(problems, { profile, ignoreProblems = [] }) {
  const ignoredKinds = ignoredResolutionKinds[profile];
  return problems.filter(
    (problem) =>
      !ignoreProblems.includes(problem.kind) &&
      !ignoredKinds.includes(problem.resolutionKind)
  );
}

export function formatAttwProblem(problem) {
  const {
    kind,
    resolutionKind,
    entrypoint,
    fileName,
    moduleSpecifier,
    typesFileName,
    implementationFileName,
  } = problem;
  return [
    kind,
    resolutionKind && `(${resolutionKind})`,
    entrypoint && `at ${entrypoint}`,
    fileName && `in ${fileName}`,
    moduleSpecifier && `importing ${moduleSpecifier}`,
    typesFileName && `types ${typesFileName}`,
    implementationFileName && `implementation ${implementationFileName}`,
  ]
    .filter(Boolean)
    .join(' ');
}

function packTarball(packageDir) {
  const destination = mkdtempSync(path.join(tmpdir(), 'gt-check-package-'));
  try {
    // pnpm is a .cmd shim on Windows, which needs a shell. Windows paths
    // cannot contain double quotes, so quoting the path is safe there.
    const shell = process.platform === 'win32';
    execFileSync(
      'pnpm',
      [
        'pack',
        '--pack-destination',
        shell ? `"${destination}"` : destination,
        '--config.ignore-scripts=true',
      ],
      { cwd: packageDir, shell, stdio: ['ignore', 'ignore', 'inherit'] }
    );
    const tarball = readdirSync(destination).find((file) =>
      file.endsWith('.tgz')
    );
    return readFileSync(path.join(destination, tarball));
  } finally {
    rmSync(destination, { recursive: true, force: true });
  }
}

export async function run(packageDir = process.cwd()) {
  const { publint } = await import('publint');
  const { formatMessage } = await import('publint/utils');
  const attw = await import('@arethetypeswrong/core');
  const pkg = JSON.parse(
    readFileSync(path.join(packageDir, 'package.json'), 'utf8')
  );
  const options = getCheckOptions(pkg.name);
  const tarball = packTarball(packageDir);
  let failed = false;

  const { messages } = await publint({
    pack: {
      tarball: tarball.buffer.slice(
        tarball.byteOffset,
        tarball.byteOffset + tarball.byteLength
      ),
    },
  });
  for (const message of messages) {
    const log = message.type === 'error' ? console.error : console.warn;
    log(
      `[publint] ${pkg.name} ${message.type}: ${formatMessage(message, pkg)}`
    );
    if (message.type === 'error') failed = true;
  }
  if (messages.length === 0) {
    process.stdout.write(`[publint] ${pkg.name}: no issues\n`);
  }

  const result = await attw.checkPackage(
    attw.createPackageFromTarballData(new Uint8Array(tarball)),
    { excludeEntrypoints: options.excludeEntrypoints }
  );
  if (!result.types) {
    console.error(`[attw] ${pkg.name}: package has no types`);
    failed = true;
  } else {
    const problems = filterAttwProblems(result.problems, options);
    for (const problem of problems) {
      console.error(`[attw] ${pkg.name}: ${formatAttwProblem(problem)}`);
    }
    if (problems.length > 0) failed = true;
    else {
      process.stdout.write(
        `[attw] ${pkg.name}: no problems (profile ${options.profile})\n`
      );
    }
  }
  return failed ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await run();
}
