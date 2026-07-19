import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apps, getApp } from './apps.mjs';

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(packageDir, '../../..');
const workspacePackagesRoot = `${realpathSync(
  path.join(repositoryRoot, 'packages')
)}${path.sep}`;
const requestedApps = process.env.GT_TEST_APPS
  ? process.env.GT_TEST_APPS.split(',')
      .map((name) => name.trim())
      .filter(Boolean)
  : Object.keys(apps);
const failures = [];

for (const name of requestedApps) {
  const app = getApp(name);
  writeLine(`\n=== ${name}: resolving ${app.entryPackage} ===`);

  const resolution = runCaptured([
    '--filter',
    app.packageName,
    'exec',
    'node',
    '--input-type=module',
    '--eval',
    [
      "import { realpathSync } from 'node:fs';",
      "import { fileURLToPath } from 'node:url';",
      `console.log(realpathSync(fileURLToPath(import.meta.resolve('${app.entryPackage}'))));`,
    ].join(' '),
  ]);

  if (resolution.status !== 0) {
    failures.push(`${name}: could not resolve ${app.entryPackage}`);
    continue;
  }

  const resolvedPath = resolution.stdout.trim().split('\n').at(-1) ?? '';
  writeLine(resolvedPath);
  if (!resolvedPath.startsWith(workspacePackagesRoot)) {
    failures.push(
      `${name}: ${app.entryPackage} resolved outside the local packages directory: ${resolvedPath}`
    );
    continue;
  }

  writeLine(`=== ${name}: browser test ===`);
  const result = runInteractive(
    ['exec', 'playwright', 'test', '--config', 'playwright.config.ts'],
    {
      GT_TEST_APP: name,
    }
  );
  if (result.status !== 0) {
    failures.push(
      `${name}: Playwright exited with ${result.status ?? 'unknown'}`
    );
  }
}

if (failures.length > 0) {
  writeLine(`\nFailed GT app checks:\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else {
  writeLine(`\nAll ${requestedApps.length} GT app browser checks passed.`);
}

/**
 * @param {string[]} args
 */
function runCaptured(args) {
  return spawnSync('pnpm', args, {
    cwd: packageDir,
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'inherit'],
  });
}

/**
 * @param {string[]} args
 * @param {Record<string, string>} extraEnvironment
 */
function runInteractive(args, extraEnvironment) {
  return spawnSync('pnpm', args, {
    cwd: packageDir,
    env: { ...process.env, ...extraEnvironment },
    stdio: 'inherit',
  });
}

/** @param {string} message */
function writeLine(message) {
  process.stdout.write(`${message}\n`);
}
