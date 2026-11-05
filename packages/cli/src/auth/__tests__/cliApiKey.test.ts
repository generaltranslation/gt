import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../oauth.js', () => ({ hasLogin: vi.fn() }));

import { hasLogin } from '../oauth.js';
import { resolveCliApiKey } from '../cliApiKey.js';
import { loadEnv } from '../../utils/loadEnv.js';

const baseUrl = 'https://api.example.com';

describe('resolveCliApiKey', () => {
  let cwd: string;
  let appDirectory: string;

  beforeEach(() => {
    cwd = process.cwd();
    appDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-cli-api-key-'));
    process.chdir(appDirectory);
    vi.stubEnv('GT_API_KEY', undefined);
    vi.clearAllMocks();
    vi.mocked(hasLogin).mockResolvedValue(true);
  });

  afterEach(() => {
    process.chdir(cwd);
    fs.rmSync(appDirectory, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  // gt init saves a translate-only runtime key there for Next.js.
  it('uses the login over a GT_API_KEY from .env.local', async () => {
    fs.writeFileSync('.env.local', 'GT_API_KEY=gtx-runtime\n');
    loadEnv();

    await expect(resolveCliApiKey(baseUrl)).resolves.toBeUndefined();
    expect(hasLogin).toHaveBeenCalledWith({ baseUrl });
  });

  it('uses a GT_API_KEY from .env.local without a login', async () => {
    vi.mocked(hasLogin).mockResolvedValue(false);
    fs.writeFileSync('.env.local', 'GT_API_KEY=gtx-runtime\n');
    loadEnv();

    await expect(resolveCliApiKey(baseUrl)).resolves.toBe('gtx-runtime');
  });

  it.each([true, false])(
    'keeps a shell GT_API_KEY over the .env.local one (signed in: %s)',
    async (signedIn) => {
      vi.mocked(hasLogin).mockResolvedValue(signedIn);
      vi.stubEnv('GT_API_KEY', 'gtx-ci');
      fs.writeFileSync('.env.local', 'GT_API_KEY=gtx-runtime\n');
      loadEnv();

      await expect(resolveCliApiKey(baseUrl)).resolves.toBe('gtx-ci');
      expect(hasLogin).not.toHaveBeenCalled();
    }
  );
});
