import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const configurations = [
  {
    name: 'routing without a default-locale prefix',
    environment: {
      GT_PREFIX_DEFAULT_LOCALE: 'false',
    },
  },
  {
    name: 'routing with a default-locale prefix',
    environment: {
      GT_PREFIX_DEFAULT_LOCALE: 'true',
    },
  },
];
const failures = [];

writeLine(`Testing ${getNextVersion()} in production mode.`);

for (const configuration of configurations) {
  writeLine(`\n=== ${configuration.name}: build ===`);
  const build = run(['build'], configuration.environment);
  if (build.status !== 0) {
    failures.push(`${configuration.name}: build failed`);
    continue;
  }

  writeLine(`\n=== ${configuration.name}: Playwright ===`);
  const browserTest = run(['test:e2e'], configuration.environment);
  if (browserTest.status !== 0) {
    failures.push(`${configuration.name}: Playwright failed`);
  }
}

if (failures.length > 0) {
  writeLine(`\nFailed latest Next.js checks:\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else {
  writeLine('\nAll latest Next.js locale-switch checks passed.');
}

function getNextVersion() {
  const result = spawnSync('pnpm', ['exec', 'next', '--version'], {
    cwd: packageDir,
    encoding: 'utf8',
  });
  return result.stdout.trim() || 'an unknown Next.js version';
}

function run(args, extraEnvironment) {
  return spawnSync('pnpm', args, {
    cwd: packageDir,
    env: { ...process.env, ...extraEnvironment },
    stdio: 'inherit',
  });
}

function writeLine(message) {
  process.stdout.write(`${message}\n`);
}
