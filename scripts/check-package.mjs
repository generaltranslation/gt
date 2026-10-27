#!/usr/bin/env node

// The package check for every published package: publint and
// arethetypeswrong (attw) on the package as npm would publish it.
//
// - Run it from a package directory after the build, as each package's
//   `check:package` script. The turbo `check:package` task depends on `build`
//   so the built JavaScript and declarations exist first.
// - It checks the packed tarball (`pnpm pack`), not the working directory, so
//   `files`, `exports` and missing build outputs are checked as published.
// - publint errors fail the check; warnings and suggestions are printed.
// - attw runs at error level with the node16 profile (bundler, node16 ESM
//   and node16 CJS; node10 is not supported). ESM-only packages use the
//   esm-only profile, which also skips node16 CJS.
// - attw skips wildcard `exports`, so each wildcard is expanded against the
//   packed files and the concrete subpaths are checked. Wildcards that match
//   no file are reported.
// - Profiles and exceptions are set per package in packageCheckOptions below.
//   Every exception needs a comment that gives the reason.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { problemAffectsResolutionKind } from '@arethetypeswrong/core/problems';
import { allResolutionKinds } from '@arethetypeswrong/core/utils';

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
  'gt-tanstack-start': { profile: 'esm-only' },
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

// Keeps problems that affect at least one resolution kind the profile checks.
// Uses attw's own visibility data: not every problem has a resolutionKind
// (InternalResolutionError has a resolutionOption, others have neither).
export function filterAttwProblems(analysis, { profile, ignoreProblems = [] }) {
  const checkedKinds = allResolutionKinds.filter(
    (resolutionKind) =>
      !ignoredResolutionKinds[profile].includes(resolutionKind)
  );
  return analysis.problems.filter(
    (problem) =>
      !ignoreProblems.includes(problem.kind) &&
      checkedKinds.some((resolutionKind) =>
        problemAffectsResolutionKind(problem, resolutionKind, analysis)
      )
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

function collectTargets(target) {
  if (typeof target === 'string') return [target];
  if (target === null || typeof target !== 'object') return [];
  return Object.values(target).flatMap(collectTargets);
}

// attw skips wildcard exports, so expand each one against the packed files
// and check the concrete subpaths. Wildcards that match no file are returned
// separately so the caller can report them.
export function expandWildcardExports(exportsField, files) {
  const entrypoints = new Set();
  const unmatched = [];
  const subpaths =
    exportsField && typeof exportsField === 'object'
      ? Object.entries(exportsField).filter(([key]) => key.includes('*'))
      : [];
  for (const [subpath, target] of subpaths) {
    let matched = false;
    for (const pattern of collectTargets(target)) {
      if (!pattern.includes('*')) continue;
      const [prefix, suffix] = pattern.replace(/^\.\//, '').split('*');
      for (const file of files) {
        if (
          file.length < prefix.length + suffix.length ||
          !file.startsWith(prefix) ||
          !file.endsWith(suffix)
        ) {
          continue;
        }
        const match = file.slice(prefix.length, file.length - suffix.length);
        entrypoints.add(subpath.replaceAll('*', match));
        matched = true;
      }
    }
    if (!matched) unmatched.push(subpath);
  }
  return { entrypoints: [...entrypoints].sort(), unmatched };
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

export async function run(packageDir = process.cwd(), checkOptions) {
  const { publint } = await import('publint');
  const { formatMessage } = await import('publint/utils');
  const attw = await import('@arethetypeswrong/core');
  const pkg = JSON.parse(
    readFileSync(path.join(packageDir, 'package.json'), 'utf8')
  );
  const options = checkOptions ?? getCheckOptions(pkg.name);
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

  const attwPackage = attw.createPackageFromTarballData(
    new Uint8Array(tarball)
  );
  const packageRoot = `/node_modules/${attwPackage.packageName}/`;
  const wildcards = expandWildcardExports(
    pkg.exports,
    attwPackage.listFiles().map((file) => file.slice(packageRoot.length))
  );
  for (const subpath of wildcards.unmatched) {
    console.warn(`[attw] ${pkg.name}: exports["${subpath}"] matches no files`);
  }
  const result = await attw.checkPackage(attwPackage, {
    includeEntrypoints: wildcards.entrypoints,
    excludeEntrypoints: options.excludeEntrypoints,
  });
  if (!result.types) {
    console.error(`[attw] ${pkg.name}: package has no types`);
    failed = true;
  } else {
    const problems = filterAttwProblems(result, options);
    for (const problem of problems) {
      console.error(`[attw] ${pkg.name}: ${formatAttwProblem(problem)}`);
    }
    if (problems.length > 0) failed = true;
    else {
      process.stdout.write(
        `[attw] ${pkg.name}: no problems in ${Object.keys(result.entrypoints).length} entrypoints (profile ${options.profile})\n`
      );
    }
  }
  return failed ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await run();
}
