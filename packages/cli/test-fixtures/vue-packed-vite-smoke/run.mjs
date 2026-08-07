import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const fixtureRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(fixtureRoot, '../../../..');
const expectedCatalogPath = join(fixtureRoot, 'expected-catalog.json');
const packageRoots = [
  'generaltranslation',
  'gt-i18n',
  'gt-vue',
  '@generaltranslation/vue-extractor',
  'gt',
];

const options = parseArguments(process.argv.slice(2));
const temporaryRoot = await mkdtemp(join(tmpdir(), 'gt-vue-packed-smoke-'));
const artifactRoot = join(temporaryRoot, 'artifacts');
const stagingRoot = join(temporaryRoot, 'staging');
const appRoot = join(temporaryRoot, 'app');
let succeeded = false;

try {
  await mkdir(artifactRoot, { recursive: true });
  await mkdir(stagingRoot, { recursive: true });
  await cp(join(fixtureRoot, 'app'), appRoot, { recursive: true });

  const revision = (
    await runChecked('git', ['rev-parse', '--short=12', 'HEAD'], {
      cwd: repositoryRoot,
    })
  ).stdout.trim();
  const packageVersion = `0.0.0-ci.${revision}`;

  writeStatus(`Packing a coherent local package graph as ${packageVersion}`);
  const artifacts = await packWorkspacePackages(packageVersion);
  await writeConsumerPackageJson(artifacts);

  writeStatus(
    `Installing Vue ${options.vue}, Vite ${options.vite}, and @vitejs/plugin-vue ${options.pluginVue}`
  );
  await runChecked(
    'pnpm',
    [
      'install',
      '--no-frozen-lockfile',
      '--config.manage-package-manager-versions=false',
    ],
    { cwd: appRoot, printOutput: true }
  );
  await assertPackedDependencyGraph(packageVersion, artifacts);

  writeStatus('Running same-process extractor cache and performance probes');
  await runChecked('node', ['--expose-gc', 'state-probe.mjs'], {
    cwd: appRoot,
    printOutput: true,
  });

  writeStatus('Typechecking the packed extractor public API');
  await runChecked('pnpm', ['exec', 'tsc', '-p', 'tsconfig.json'], {
    cwd: appRoot,
    printOutput: true,
  });

  writeStatus('Validating and generating the packed app catalog');
  await runChecked('pnpm', ['exec', 'gt', 'validate'], {
    cwd: appRoot,
    printOutput: true,
  });
  await runChecked('pnpm', ['exec', 'gt', 'generate'], {
    cwd: appRoot,
    printOutput: true,
  });

  const catalogPath = join(appRoot, 'src/_gt/en.json');
  const catalogBytes = await readFile(catalogPath);
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const expectedCatalog = JSON.parse(
    await readFile(expectedCatalogPath, 'utf8')
  );
  const versionSpecificCatalog = JSON.parse(
    await readFile(
      join(
        fixtureRoot,
        Number(options.vue.split('.')[1]) >= 5
          ? 'expected-catalog.vue-modern.json'
          : 'expected-catalog.vue-legacy.json'
      ),
      'utf8'
    )
  );
  assert.deepEqual(
    catalog,
    { ...expectedCatalog, ...versionSpecificCatalog },
    'generated source catalog changed from the cross-version fixture'
  );
  assert.ok(
    Object.keys(catalog).length >= 10,
    'packed smoke must exercise at least ten independent catalog lookups'
  );

  const frenchCatalog = translateCatalog(catalog);
  await writeFile(
    join(appRoot, 'src/_gt/fr.json'),
    `${JSON.stringify(frenchCatalog, null, 2)}\n`
  );

  writeStatus('Building the standalone Vite consumer');
  await runChecked('pnpm', ['exec', 'vite', 'build'], {
    cwd: appRoot,
    printOutput: true,
  });

  if (!options.skipBrowser) {
    const chromium = await loadChromium();
    await verifyBrowserBuild(chromium, 'development');
    await verifyBrowserBuild(chromium, 'production');
  }

  writeStatus('Confirming failed extraction cannot overwrite a catalog');
  const unsafePath = join(appRoot, 'src/Unsafe.vue');
  await writeFile(
    unsafePath,
    `<script setup>
import { T } from 'gt-vue';
const registry = [T];
const key = getIndex();
</script>
<template><component :is="registry[key]">Unsafe</component></template>
`
  );
  const validateFailure = await runCommand('pnpm', ['exec', 'gt', 'validate'], {
    cwd: appRoot,
  });
  assert.notEqual(
    validateFailure.code,
    0,
    'validate unexpectedly accepted an unresolved possible T alias'
  );
  assert.match(
    `${validateFailure.stdout}\n${validateFailure.stderr}`,
    /possible gt-vue component alias/
  );
  assert.deepEqual(await readFile(catalogPath), catalogBytes);

  const generateFailure = await runCommand('pnpm', ['exec', 'gt', 'generate'], {
    cwd: appRoot,
  });
  assert.notEqual(
    generateFailure.code,
    0,
    'generate unexpectedly accepted an unresolved possible T alias'
  );
  assert.match(
    `${generateFailure.stdout}\n${generateFailure.stderr}`,
    /possible gt-vue component alias/
  );
  assert.deepEqual(await readFile(catalogPath), catalogBytes);

  await rm(unsafePath);
  succeeded = true;
  writeStatus(
    JSON.stringify({
      catalogKeys: Object.keys(catalog).sort(),
      packageVersion,
      pluginVue: options.pluginVue,
      status: 'passed',
      vite: options.vite,
      vue: options.vue,
    })
  );
} finally {
  if (succeeded && !options.keepTemp) {
    await rm(temporaryRoot, { force: true, recursive: true });
  } else {
    console.error(`Packed Vue smoke files retained at ${temporaryRoot}`);
  }
}

/** Parses exact framework versions supplied by the workflow matrix. */
function parseArguments(arguments_) {
  const parsed = {
    keepTemp: false,
    pluginVue: undefined,
    skipBrowser: false,
    vite: undefined,
    vue: undefined,
  };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--keep-temp') {
      parsed.keepTemp = true;
      continue;
    }
    if (argument === '--skip-browser') {
      parsed.skipBrowser = true;
      continue;
    }
    const value = arguments_[index + 1];
    assert.ok(value, `Missing value for ${argument}`);
    index += 1;
    if (argument === '--vue') parsed.vue = value;
    else if (argument === '--vite') parsed.vite = value;
    else if (argument === '--plugin-vue') parsed.pluginVue = value;
    else assert.fail(`Unknown argument: ${argument}`);
  }
  assert.ok(parsed.vue, '--vue is required');
  assert.ok(parsed.vite, '--vite is required');
  assert.ok(parsed.pluginVue, '--plugin-vue is required');
  return parsed;
}

/** Reads every workspace package manifest by its published package name. */
async function readWorkspacePackages() {
  const packages = new Map();
  const packagesRoot = join(repositoryRoot, 'packages');
  for (const entry of await readdir(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = join(packagesRoot, entry.name);
    const manifestPath = join(directory, 'package.json');
    try {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      packages.set(manifest.name, { directory, manifest });
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  return packages;
}

/**
 * Packs all local production dependencies in topological order.
 *
 * Internal dependency specs point to already-created absolute tarballs. This
 * prevents pnpm from silently substituting a same-version registry package,
 * which is especially important while gt-vue and its extractor are
 * unpublished.
 */
async function packWorkspacePackages(packageVersion) {
  const workspacePackages = await readWorkspacePackages();
  const orderedNames = [];
  const visited = new Set();

  function visit(name) {
    if (visited.has(name)) return;
    visited.add(name);
    const workspacePackage = workspacePackages.get(name);
    assert.ok(workspacePackage, `Missing workspace package ${name}`);
    for (const section of ['dependencies', 'optionalDependencies']) {
      for (const [dependency, specification] of Object.entries(
        workspacePackage.manifest[section] ?? {}
      )) {
        if (
          String(specification).startsWith('workspace:') &&
          workspacePackages.has(dependency)
        ) {
          visit(dependency);
        }
      }
    }
    orderedNames.push(name);
  }

  for (const name of packageRoots) visit(name);

  const artifacts = new Map();
  for (const name of orderedNames) {
    const { directory, manifest: sourceManifest } = workspacePackages.get(name);
    const packageStagingRoot = join(
      stagingRoot,
      name.replaceAll('@', '').replaceAll('/', '__')
    );
    await mkdir(packageStagingRoot, { recursive: true });

    for (const entry of sourceManifest.files ?? []) {
      assert.ok(
        !String(entry).includes('*'),
        `Packed smoke does not support globbed package files: ${name}/${entry}`
      );
      await copyIfPresent(
        join(directory, entry),
        join(packageStagingRoot, entry)
      );
    }
    for (const binPath of Object.values(
      typeof sourceManifest.bin === 'string'
        ? { [name]: sourceManifest.bin }
        : (sourceManifest.bin ?? {})
    )) {
      await copyIfPresent(
        join(directory, binPath),
        join(packageStagingRoot, binPath)
      );
    }

    const manifest = structuredClone(sourceManifest);
    manifest.version = packageVersion;
    for (const section of [
      'dependencies',
      'optionalDependencies',
      'devDependencies',
    ]) {
      for (const dependency of Object.keys(manifest[section] ?? {})) {
        if (!workspacePackages.has(dependency)) continue;
        const artifact = artifacts.get(dependency);
        if (section !== 'devDependencies') {
          assert.ok(
            artifact,
            `${name} was packed before local dependency ${dependency}`
          );
        }
        manifest[section][dependency] = artifact
          ? `file:${artifact}`
          : packageVersion;
      }
    }
    for (const dependency of Object.keys(manifest.peerDependencies ?? {})) {
      if (workspacePackages.has(dependency)) {
        manifest.peerDependencies[dependency] = packageVersion;
      }
    }
    await writeFile(
      join(packageStagingRoot, 'package.json'),
      `${JSON.stringify(manifest, null, 2)}\n`
    );

    const result = await runChecked(
      'npm',
      [
        'pack',
        '--json',
        '--ignore-scripts',
        '--pack-destination',
        artifactRoot,
      ],
      { cwd: packageStagingRoot }
    );
    const packResult = JSON.parse(result.stdout);
    assert.equal(packResult.length, 1, `npm packed ${name} more than once`);
    const artifactPath = join(artifactRoot, packResult[0].filename);
    await stat(artifactPath);
    artifacts.set(name, artifactPath);
  }
  return artifacts;
}

/** Copies a package file or directory when it exists. */
async function copyIfPresent(source, target) {
  try {
    await stat(source);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  await mkdir(dirname(target), { recursive: true });
  await cp(source, target, { recursive: true });
}

/** Writes the standalone consumer manifest with exact matrix versions. */
async function writeConsumerPackageJson(artifacts) {
  const localDependency = (name) => {
    const artifact = artifacts.get(name);
    assert.ok(artifact, `Missing packed artifact for ${name}`);
    return `file:${artifact}`;
  };
  const manifest = {
    name: 'gt-vue-packed-vite-smoke',
    private: true,
    version: '0.0.0',
    type: 'module',
    dependencies: {
      '@generaltranslation/vue-extractor': localDependency(
        '@generaltranslation/vue-extractor'
      ),
      '@vitejs/plugin-vue': options.pluginVue,
      generaltranslation: localDependency('generaltranslation'),
      'gt-i18n': localDependency('gt-i18n'),
      'gt-vue': localDependency('gt-vue'),
      gt: localDependency('gt'),
      playwright: '1.57.0',
      typescript: '5.9.3',
      vite: options.vite,
      vue: options.vue,
    },
    pnpm: {
      onlyBuiltDependencies: ['esbuild'],
    },
  };
  await writeFile(
    join(appRoot, 'package.json'),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
}

/**
 * Proves that the installed runtime and CLI resolve the freshly packed local
 * dependencies rather than registry packages with matching stable versions.
 */
async function assertPackedDependencyGraph(packageVersion, artifacts) {
  for (const name of packageRoots) {
    await assertPackageVersion(
      await realpath(join(appRoot, 'node_modules', ...name.split('/'))),
      name,
      packageVersion
    );
  }

  const gtVueRoot = await realpath(join(appRoot, 'node_modules/gt-vue'));
  await assertLocalDependency(
    gtVueRoot,
    'gt-i18n',
    packageVersion,
    artifacts.get('gt-i18n')
  );
  await assertLocalDependency(
    gtVueRoot,
    'generaltranslation',
    packageVersion,
    artifacts.get('generaltranslation')
  );

  const cliRoot = await realpath(join(appRoot, 'node_modules/gt'));
  await assertLocalDependency(
    cliRoot,
    '@generaltranslation/vue-extractor',
    packageVersion,
    artifacts.get('@generaltranslation/vue-extractor')
  );
}

/** Asserts a package directory has the expected name and CI-only version. */
async function assertPackageVersion(packageRoot, name, packageVersion) {
  const manifest = JSON.parse(
    await readFile(join(packageRoot, 'package.json'), 'utf8')
  );
  assert.equal(manifest.name, name);
  assert.equal(
    manifest.version,
    packageVersion,
    `${name} resolved to a non-local package version`
  );
}

/** Asserts one owner's dependency resolves beside it in pnpm's virtual store. */
async function assertLocalDependency(
  ownerRoot,
  dependency,
  packageVersion,
  artifact
) {
  const ownerManifest = JSON.parse(
    await readFile(join(ownerRoot, 'package.json'), 'utf8')
  );
  assert.equal(ownerManifest.dependencies[dependency], `file:${artifact}`);
  const dependencyRoot = await realpath(
    join(dirname(ownerRoot), ...dependency.split('/'))
  );
  await assertPackageVersion(dependencyRoot, dependency, packageVersion);
}

/** Converts a source catalog into visibly different, shape-preserving values. */
function translateCatalog(catalog) {
  return Object.fromEntries(
    Object.entries(catalog).map(([key, value]) => [
      key,
      translateCatalogValue(value),
    ])
  );
}

/** Recursively translates text while preserving rich element and variable IDs. */
function translateCatalogValue(value) {
  if (typeof value === 'string') return `[fr] ${value}`;
  if (Array.isArray(value)) return value.map(translateCatalogValue);
  if (value == null || typeof value !== 'object') return value;
  const translated = { ...value };
  if (Object.hasOwn(translated, 'c')) {
    translated.c = translateCatalogValue(translated.c);
  }
  if (
    Object.hasOwn(translated, 'd') &&
    translated.d != null &&
    typeof translated.d === 'object'
  ) {
    translated.d = Object.fromEntries(
      Object.entries(translated.d).map(([key, data]) => [
        key,
        key === 't'
          ? data
          : key === 'b' && data != null && typeof data === 'object'
            ? Object.fromEntries(
                Object.entries(data).map(([branch, value]) => [
                  branch,
                  translateCatalogValue(value),
                ])
              )
            : translateCatalogValue(data),
      ])
    );
  }
  if (Object.hasOwn(translated, 'b')) {
    translated.b = Object.fromEntries(
      Object.entries(translated.b).map(([key, branch]) => [
        key,
        translateCatalogValue(branch),
      ])
    );
  }
  return translated;
}

/** Loads Playwright from the isolated consumer's dependency graph. */
async function loadChromium() {
  const requireFromApp = createRequire(join(appRoot, 'package.json'));
  const entry = requireFromApp.resolve('playwright');
  const playwright = await import(pathToFileURL(entry).href);
  const chromium = playwright.chromium ?? playwright.default?.chromium;
  assert.ok(chromium, 'Could not load Playwright Chromium');
  return chromium;
}

/** Runs the same browser assertions through Vite development and preview. */
async function verifyBrowserBuild(chromium, mode) {
  writeStatus(`Testing the ${mode} Vite build in Chromium`);
  const port = await reservePort();
  const viteCli = join(appRoot, 'node_modules/vite/bin/vite.js');
  const arguments_ =
    mode === 'production'
      ? [
          viteCli,
          'preview',
          '--host',
          '127.0.0.1',
          '--port',
          String(port),
          '--strictPort',
        ]
      : [
          viteCli,
          '--host',
          '127.0.0.1',
          '--port',
          String(port),
          '--strictPort',
        ];
  const server = spawn(process.execPath, arguments_, {
    cwd: appRoot,
    env: { ...process.env, NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverOutput = '';
  server.stdout.on('data', (chunk) => {
    serverOutput += chunk;
  });
  server.stderr.on('data', (chunk) => {
    serverOutput += chunk;
  });

  try {
    await waitForServer(`http://127.0.0.1:${port}`, server, () => serverOutput);
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) =>
        errors.push(error.message || String(error))
      );
      await page.goto(`http://127.0.0.1:${port}`, {
        waitUntil: 'networkidle',
      });
      try {
        await page.waitForFunction(() => window.__GT_SMOKE__?.ready === true);
      } catch (error) {
        const state = await page.evaluate(() => ({
          html: document.querySelector('#app')?.innerHTML,
          ready: window.__GT_SMOKE__?.ready,
          slotCalls: window.__GT_SMOKE__?.slotCalls,
        }));
        throw new Error(
          `${mode} app did not mount: ${JSON.stringify({ errors, state })}`,
          { cause: error }
        );
      }
      const result = await page.evaluate(() => ({
        catalogKeys: window.__GT_SMOKE__.catalogKeys,
        lookups: [...window.__GT_SMOKE__.lookups].sort(),
        slotCalls: window.__GT_SMOKE__.slotCalls,
        text: {
          computedMessage: document
            .querySelector('#computed-m')
            ?.textContent?.trim(),
          direct: document.querySelector('#direct-gt')?.textContent?.trim(),
          fragment: document.querySelector('#fragment')?.textContent?.trim(),
          implicitBranch: document
            .querySelector('#implicit-branch')
            ?.textContent?.trim(),
          implicitPlural: document
            .querySelector('#implicit-plural')
            ?.textContent?.trim(),
          nested: document.querySelector('#nested-gt')?.textContent?.trim(),
          nestedMessage: document
            .querySelector('#nested-m')
            ?.textContent?.trim(),
          reference: document.querySelector('#ref-gt')?.textContent?.trim(),
          registered: document
            .querySelector('#registered-message')
            ?.textContent?.trim(),
        },
      }));

      assert.deepEqual(
        result.lookups,
        result.catalogKeys,
        `${mode} hash drift`
      );
      assert.equal(result.slotCalls, 1, `${mode} scoped slot call count`);
      assert.deepEqual(result.text, {
        computedMessage: '[fr] Computed raw message',
        direct: '[fr] Direct GT',
        fragment: '[fr] Fragment child',
        implicitBranch: '[fr] Formal branch',
        implicitPlural: '[fr] One plural',
        nested: '[fr] Nested GT',
        nestedMessage: '[fr] Nested raw message',
        reference: '[fr] Ref GT',
        registered: '[fr] Registered message',
      });
      assert.deepEqual(errors, [], `${mode} browser errors`);
    } finally {
      await browser.close();
    }
  } finally {
    await stopServer(server);
  }
}

/** Reserves an unused local TCP port for one Vite server. */
async function reservePort() {
  const server = createServer();
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolvePromise);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  await new Promise((resolvePromise, reject) =>
    server.close((error) => (error ? reject(error) : resolvePromise()))
  );
  return address.port;
}

/** Waits until Vite responds or exits with captured diagnostics. */
async function waitForServer(url, server, getOutput) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode != null) {
      assert.fail(`Vite exited with ${server.exitCode}:\n${getOutput()}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  assert.fail(`Vite did not start within 30 seconds:\n${getOutput()}`);
}

/** Terminates a Vite process group and waits for it to release resources. */
async function stopServer(server) {
  if (server.exitCode != null) return;
  server.kill('SIGTERM');
  await Promise.race([
    new Promise((resolvePromise) => server.once('exit', resolvePromise)),
    new Promise((resolvePromise) => setTimeout(resolvePromise, 5_000)),
  ]);
  if (server.exitCode == null) {
    server.kill('SIGKILL');
  }
}

/** Runs a command and captures all output without throwing on exit status. */
async function runCommand(command, arguments_, { cwd, printOutput = false }) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, arguments_, {
      cwd,
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (printOutput) process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (printOutput) process.stderr.write(chunk);
    });
    child.once('error', reject);
    child.once('close', (code, signal) =>
      resolvePromise({ code, signal, stderr, stdout })
    );
  });
}

/** Runs a command and throws an evidence-rich error when it fails. */
async function runChecked(command, arguments_, options_) {
  const result = await runCommand(command, arguments_, options_);
  assert.equal(
    result.code,
    0,
    `${command} ${arguments_.join(' ')} failed with ${result.code ?? result.signal}:\n${result.stdout}\n${result.stderr}`
  );
  return result;
}

/** Writes one concise progress or result line for CI logs. */
function writeStatus(message) {
  process.stdout.write(`${message}\n`);
}
