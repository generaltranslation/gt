#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { formatDiagnosticErrorDetails } from 'generaltranslation/internal';
import {
  isChannelVersion,
  releaseError,
  releasePackages,
  requireCondition,
} from './shared.mjs';

const exec = promisify(execFile);
const resultMarker = '__GT_AUTO_JSX_CONSUMER_RESULT__';
const supportedSwcVersion = '1.15.3';
const source = `import { T } from 'gt-next';
export function ReleaseProbe({ name = 'Ada' } = {}) {
  return <main><T>Hello world</T><T $context="button">Continue</T><p>Ordinary {name}</p></main>;
}
`;

export function parseConsumerArguments(args) {
  const options = { host: 'swc' };
  const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    requireCondition(
      ['--consumer', '--plan', '--report', '--host'].includes(key) &&
        !seen.has(key) &&
        args[index + 1] &&
        !args[index + 1].startsWith('--'),
      'Pass unique --consumer, --plan, --report, and --host arguments',
      key
    );
    seen.add(key);
    options[key.slice(2)] = args[++index];
  }
  requireCondition(
    options.consumer && options.plan,
    'Pass --consumer with the installed project and --plan with expected versions'
  );
  requireCondition(
    ['swc', 'next'].includes(options.host),
    'The consumer smoke host must be swc or next'
  );
  return options;
}

// Accept the release packer's existing report or an explicit name/version map.
export function expectedVersionsFromPlan(plan) {
  const entries = Array.isArray(plan?.candidates)
    ? plan.candidates.map((candidate) => [candidate?.name, candidate?.version])
    : plan && typeof plan === 'object' && !Array.isArray(plan)
      ? Object.entries(plan)
      : [];
  requireCondition(
    entries.length === Object.keys(releasePackages).length &&
      new Set(entries.map(([name]) => name)).size === entries.length &&
      entries.every(
        ([name, version]) =>
          Object.hasOwn(releasePackages, name) && isChannelVersion(version)
      ),
    'The smoke plan must name all nine auto-jsx packages and their exact prerelease versions'
  );
  return Object.fromEntries(entries);
}

async function readManifest(packageRoot, expectedName) {
  const manifest = JSON.parse(
    await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8')
  );
  requireCondition(
    manifest.name === expectedName,
    'A consumer package resolved to an unexpected package identity',
    expectedName
  );
  return { root: await fs.realpath(packageRoot), manifest };
}

// Read the consumer's direct installation, including packages whose export map
// deliberately does not expose package.json or a CommonJS root entrypoint.
async function directPackage(consumer, name) {
  try {
    return await readManifest(path.join(consumer, 'node_modules', name), name);
  } catch (error) {
    throw releaseError(
      'A required package is missing from the consumer installation',
      [name, formatDiagnosticErrorDetails(error)]
    );
  }
}

async function resolvedDependency(packageRoot, name) {
  const require = createRequire(path.join(packageRoot, 'package.json'));
  for (const directory of require.resolve.paths(name) ?? []) {
    try {
      return await readManifest(path.join(directory, name), name);
    } catch (error) {
      if (['ENOENT', 'ENOTDIR'].includes(error.code)) continue;
      throw error;
    }
  }
  throw releaseError(
    'An installed prerelease dependency cannot be resolved',
    name
  );
}

export async function inspectConsumer(consumer, expectedVersions) {
  const packages = {};
  for (const [name, expectedVersion] of Object.entries(expectedVersions)) {
    const { root, manifest } = await directPackage(consumer, name);
    requireCondition(
      manifest.version === expectedVersion,
      'An installed package does not match the release plan',
      `${name}: expected ${expectedVersion}, found ${manifest.version}`
    );
    const dependencies = {};
    for (const field of [
      'dependencies',
      'optionalDependencies',
      'peerDependencies',
    ]) {
      for (const dependency of Object.keys(manifest[field] ?? {})) {
        if (!Object.hasOwn(expectedVersions, dependency)) continue;
        const resolved = await resolvedDependency(root, dependency);
        requireCondition(
          resolved.manifest.version === expectedVersions[dependency],
          'A package resolves a different prerelease dependency than the consumer',
          `${name}: ${dependency}@${resolved.manifest.version}`
        );
        dependencies[dependency] = resolved.manifest.version;
      }
    }
    packages[name] = { version: manifest.version, root, dependencies };
  }
  return packages;
}

function canonical(node, hashes, removeHashes) {
  if (Array.isArray(node)) {
    return node
      .filter((item) => {
        const hashProperty =
          item?.type === 'ObjectProperty' &&
          !item.computed &&
          (item.key?.name ?? item.key?.value) === '_hash';
        if (hashProperty) {
          requireCondition(
            item.value?.type === 'StringLiteral' &&
              /^[a-f0-9]{16}$/.test(item.value.value),
            'A manual translation hash is not a valid literal'
          );
          hashes.push(item.value.value);
        }
        return !(removeHashes && hashProperty);
      })
      .map((item) => canonical(item, hashes, removeHashes));
  }
  if (!node || typeof node !== 'object') return node;
  return Object.fromEntries(
    Object.entries(node)
      .filter(
        ([key]) =>
          ![
            'start',
            'end',
            'loc',
            'extra',
            'tokens',
            'comments',
            'errors',
          ].includes(key)
      )
      .map(([key, value]) => [key, canonical(value, hashes, removeHashes)])
  );
}

export function verifyHashOutput(parse, original, transformed, expectedHashes) {
  const options = { sourceType: 'module', plugins: ['typescript', 'jsx'] };
  const originalHashes = [];
  const actualHashes = [];
  const before = canonical(parse(original, options), originalHashes, false);
  const after = canonical(parse(transformed, options), actualHashes, true);
  requireCondition(
    originalHashes.length === 0,
    'The unmodified smoke input already contains hashes'
  );
  requireCondition(
    JSON.stringify(actualHashes) === JSON.stringify(expectedHashes),
    'Manual translation hashes do not match the installed runtime hasher',
    [
      `expected: ${JSON.stringify(expectedHashes)}`,
      `actual: ${JSON.stringify(actualHashes)}`,
    ]
  );
  requireCondition(
    JSON.stringify(before) === JSON.stringify(after),
    'The disabled auto-JSX transform changed more than the manual hash properties'
  );
  return {
    hashes: actualHashes,
    originalAstSha256: createHash('sha256')
      .update(JSON.stringify(before))
      .digest('hex'),
  };
}

async function loadHost(consumer, host, cacheRoot) {
  const require = createRequire(path.join(consumer, 'package.json'));
  const name = host === 'next' ? 'next' : '@swc/core';
  const { root, manifest } = await directPackage(consumer, name);
  const entry = require.resolve(host === 'next' ? 'next/dist/build/swc' : name);
  requireCondition(
    entry.startsWith(`${root}${path.sep}`),
    'The transform host resolved outside the consumer installation',
    name
  );
  requireCondition(
    host === 'next' || manifest.version === supportedSwcVersion,
    'Use the verified SWC host version for the packaged plugin ABI',
    `@swc/core@${supportedSwcVersion}`
  );
  const swc = require(entry);
  const getNextOptions =
    host === 'next'
      ? require('next/dist/build/swc/options').getLoaderSWCOptions
      : undefined;
  return {
    name,
    version: manifest.version,
    transform(input, filename, development, plugin) {
      const options = getNextOptions
        ? {
            ...getNextOptions({
              filename,
              relativeFilePathFromRoot: path.basename(filename),
              development,
              isServer: true,
              isPageFile: false,
              serverComponents: false,
              esm: true,
              compilerOptions: {},
              jsConfig: {},
            }),
            filename,
          }
        : {
            filename,
            swcrc: false,
            configFile: false,
            jsc: {
              target: 'esnext',
              parser: { syntax: 'typescript', tsx: true },
              transform: { react: { runtime: 'automatic', development } },
            },
          };
      if (plugin) {
        options.jsc.experimental = {
          ...options.jsc.experimental,
          cacheRoot,
          plugins: [plugin],
        };
      }
      // The synchronous Next entrypoint only loads an already-installed native
      // binding. Do not call its asynchronous binding downloader in a smoke.
      return swc.transformSync(input, options).code;
    },
  };
}

// Each engine runs in its own bounded process; no native bindings or package
// configuration from the release checkout can leak into the consumer probes.
export async function runHashProbe({
  consumer,
  directory,
  engine,
  host: hostName,
}) {
  const require = createRequire(path.join(consumer, 'package.json'));
  const compilerEntry = require.resolve('@generaltranslation/compiler');
  const compilerPackage = await directPackage(
    consumer,
    '@generaltranslation/compiler'
  );
  requireCondition(
    compilerEntry.startsWith(`${compilerPackage.root}${path.sep}`),
    'The compiler resolved outside the consumer installation'
  );
  const compilerRequire = createRequire(compilerEntry);
  const { parse } = compilerRequire('@babel/parser');
  const { hashSource } = compilerRequire('generaltranslation/id');
  const expectedHashes = [
    hashSource({ source: 'Hello world', dataFormat: 'JSX' }),
    hashSource({ source: 'Continue', context: 'button', dataFormat: 'JSX' }),
  ];
  const host = await loadHost(
    consumer,
    hostName,
    path.join(directory, `${engine}-cache`)
  );
  const next = await directPackage(consumer, 'gt-next');
  const wasm = path.join(next.root, 'dist/gt_swc_plugin.wasm');
  const wasmBytes = await fs.readFile(wasm);
  requireCondition(
    wasmBytes.length > 8 &&
      wasmBytes
        .subarray(0, 8)
        .equals(Buffer.from([0, 97, 115, 109, 1, 0, 0, 0])),
    'The installed Next package is missing a valid SWC plugin'
  );
  const compilerModule =
    engine === 'compiler' ? require(compilerEntry) : undefined;
  const compiler = compilerModule?.default ?? compilerModule;
  const cases = [];
  for (const development of [false, true]) {
    const filename = path.join(directory, 'ReleaseProbe.tsx');
    const original = host.transform(source, filename, development);
    for (const auto of ['omitted', 'false']) {
      const common = {
        disableBuildChecks: false,
        ...(auto === 'false' && { enableAutoJsxInjection: false }),
      };
      const outputs = [];
      for (const compileTimeHash of [true, false]) {
        if (engine === 'compiler') {
          requireCondition(
            typeof compiler?.raw === 'function',
            'The compiler public unplugin export is unavailable'
          );
          const plugin = compiler.raw(
            {
              ...common,
              compileTimeHash,
              gtConfig: { defaultLocale: 'en', locales: ['en'] },
              enableMacroTransform: false,
              autoderive: false,
              devHotReload: false,
              logLevel: 'silent',
            },
            { framework: 'vite' }
          );
          const hook =
            typeof plugin.transform === 'function'
              ? plugin.transform
              : plugin.transform?.handler;
          requireCondition(
            typeof hook === 'function',
            'The compiler public transform hook is unavailable'
          );
          const transformed = await hook.call(
            {
              addWatchFile() {},
              emitFile() {},
              getWatchFiles() {
                return [];
              },
              warn(message) {
                throw releaseError(
                  'The compiler smoke emitted a warning',
                  String(message)
                );
              },
              error(message) {
                throw releaseError(
                  'The compiler smoke emitted an error',
                  String(message)
                );
              },
            },
            original,
            filename
          );
          outputs.push(
            typeof transformed === 'string'
              ? transformed
              : (transformed?.code ?? original)
          );
        } else {
          outputs.push(
            host.transform(source, filename, development, [
              wasm,
              {
                ...common,
                compileTimeHash,
                autoderiveJsx: false,
                autoderiveStrings: false,
                logLevel: 'silent',
              },
            ])
          );
        }
      }
      const verification = verifyHashOutput(
        parse,
        original,
        outputs[0],
        expectedHashes
      );
      requireCondition(
        outputs[1] === original,
        'Disabling compile-time hashing changed the unmodified host output',
        `${engine}, development=${development}, auto=${auto}`
      );
      cases.push({
        engine,
        mode: development ? 'development' : 'production',
        auto,
        ...verification,
        hashDisabledUnchanged: true,
        output: outputs[0],
      });
    }
  }
  return {
    host: { name: host.name, version: host.version },
    wasmSha256: createHash('sha256').update(wasmBytes).digest('hex'),
    cases,
  };
}

function childEnvironment() {
  const env = {
    CI: 'true',
    NO_COLOR: '1',
    NEXT_TELEMETRY_DISABLED: '1',
    NODE_ENV: 'test',
  };
  for (const key of [
    'PATH',
    'SystemRoot',
    'SYSTEMROOT',
    'WINDIR',
    'TMP',
    'TEMP',
    'TMPDIR',
  ]) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return env;
}

async function runChild(args, directory) {
  try {
    return await exec(process.execPath, args, {
      cwd: directory,
      env: childEnvironment(),
      timeout: 45_000,
      maxBuffer: 2 * 1024 * 1024,
    });
  } catch (error) {
    throw releaseError('A bounded consumer smoke process failed', [
      error.killed ? 'The 45-second timeout expired' : `exit: ${error.code}`,
      String(error.stderr || error.stdout || error.message),
    ]);
  }
}

export async function runConsumerSmoke({
  consumer,
  expectedVersions,
  host = 'swc',
  report: reportPath,
}) {
  consumer = await fs.realpath(consumer);
  expectedVersions = expectedVersionsFromPlan(expectedVersions);
  requireCondition(
    ['swc', 'next'].includes(host),
    'The consumer smoke host must be swc or next'
  );
  await fs.access(path.join(consumer, 'package.json'));
  const directory = await fs.mkdtemp(
    path.join(consumer, 'auto-jsx-consumer-smoke-')
  );
  reportPath = reportPath
    ? path.resolve(reportPath)
    : path.join(directory, 'report.json');
  const report = {
    consumer,
    directory,
    status: 'running',
    packages: {},
    probes: [],
  };
  try {
    report.packages = await inspectConsumer(consumer, expectedVersions);
    const cli = await directPackage(consumer, 'gt');
    const bin =
      typeof cli.manifest.bin === 'string'
        ? cli.manifest.bin
        : cli.manifest.bin?.gt;
    requireCondition(
      typeof bin === 'string' &&
        !path.isAbsolute(bin) &&
        !bin.split(/[\\/]/).includes('..'),
      'The installed CLI has no usable public gt binary'
    );
    const cliResult = await runChild(
      [path.join(cli.root, bin), '--version'],
      directory
    );
    requireCondition(
      cliResult.stdout.trim() === expectedVersions.gt,
      'The public CLI binary does not report its reviewed package version',
      [`expected: ${expectedVersions.gt}`, `actual: ${cliResult.stdout.trim()}`]
    );
    report.cli = { version: cliResult.stdout.trim(), stderr: cliResult.stderr };
    for (const engine of ['compiler', 'swc']) {
      const payload = { consumer, directory, engine, host };
      const worker = `import { runHashProbe } from ${JSON.stringify(import.meta.url)};
const result = await runHashProbe(${JSON.stringify(payload)});
process.stdout.write(${JSON.stringify(resultMarker)} + JSON.stringify(result) + '\\n');`;
      const result = await runChild(
        ['--input-type=module', '--eval', worker],
        directory
      );
      const lines = result.stdout
        .split('\n')
        .filter((line) => line.startsWith(resultMarker));
      requireCondition(
        lines.length === 1,
        'A consumer smoke worker returned no unique result',
        engine
      );
      report.probes.push({
        ...JSON.parse(lines[0].slice(resultMarker.length)),
        stderr: result.stderr,
      });
    }
    requireCondition(
      JSON.stringify(report.probes[0].cases.map(({ hashes }) => hashes)) ===
        JSON.stringify(report.probes[1].cases.map(({ hashes }) => hashes)),
      'The installed compiler and SWC plugin disagree on manual translation hashes'
    );
    report.status = 'passed';
    return { ...report, reportPath };
  } catch (error) {
    report.status = 'failed';
    report.error = formatDiagnosticErrorDetails(error);
    throw error;
  } finally {
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    const { plan, ...options } = parseConsumerArguments(process.argv.slice(2));
    const expectedVersions = JSON.parse(
      await fs.readFile(path.resolve(plan), 'utf8')
    );
    const report = await runConsumerSmoke({ ...options, expectedVersions });
    process.stdout.write(
      `Consumer smoke passed: nine package versions, CLI startup, eight compiler/SWC cases and eight hash-disabled controls. Report: ${report.reportPath}\n`
    );
  } catch (error) {
    console.error(
      releaseError(
        'The installed auto-jsx baseline smoke failed',
        formatDiagnosticErrorDetails(error)
      ).message
    );
    process.exitCode = 1;
  }
}
