import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadEnv } from '../loadEnv.js';

describe('loadEnv', () => {
  let appDirectory: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    appDirectory = fs.mkdtempSync(path.join(tmpdir(), 'gt-load-env-'));
    process.chdir(appDirectory);
    vi.stubEnv('GT_LOAD_ENV_TEST', undefined);
    vi.stubEnv('NEXT_PUBLIC_GT_PROJECT_ID', undefined);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    vi.unstubAllEnvs();
    fs.rmSync(appDirectory, { recursive: true, force: true });
  });

  it('reads the Next.js development credentials init saves', () => {
    fs.writeFileSync(
      path.join(appDirectory, '.env.development.local'),
      'NEXT_PUBLIC_GT_PROJECT_ID=dev-project\n'
    );

    loadEnv();

    expect(process.env.NEXT_PUBLIC_GT_PROJECT_ID).toBe('dev-project');
  });

  it('lets .env.development.local override .env.local, and .env.production override both', () => {
    const write = (file: string, value: string) =>
      fs.writeFileSync(
        path.join(appDirectory, file),
        `GT_LOAD_ENV_TEST=${value}\n`
      );
    write('.env.local', 'local');
    write('.env.development.local', 'development');
    loadEnv();
    expect(process.env.GT_LOAD_ENV_TEST).toBe('development');

    write('.env.production', 'production');
    loadEnv();
    expect(process.env.GT_LOAD_ENV_TEST).toBe('production');
  });
});
