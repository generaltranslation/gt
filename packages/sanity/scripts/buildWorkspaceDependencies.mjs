import { spawnSync } from 'node:child_process';

if (!process.env.TURBO_HASH) {
  const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const result = spawnSync(
    pnpmCommand,
    [
      'exec',
      'turbo',
      'run',
      'build',
      '--filter=gt-sanity^...',
      '--output-logs=errors-only',
    ],
    {
      cwd: new URL('../../../', import.meta.url),
      stdio: 'inherit',
    }
  );

  process.exit(result.status ?? 1);
}
