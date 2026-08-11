import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setCredentials } from '../credentials.js';

describe('setCredentials', () => {
  let appDirectory: string;

  beforeEach(() => {
    appDirectory = fs.mkdtempSync(path.join(tmpdir(), 'gt-credentials-'));
  });

  afterEach(() => {
    fs.rmSync(appDirectory, { recursive: true, force: true });
  });

  it('only exposes browser-safe Vite credentials', async () => {
    await setCredentials(
      {
        projectId: 'project-id',
        apiKeys: [
          { type: 'development', key: 'gtx-dev-key' },
          { type: 'production', key: 'gtx-api-key' },
        ],
      },
      'vite',
      appDirectory
    );

    const env = fs.readFileSync(path.join(appDirectory, '.env.local'), 'utf8');
    expect(env).toContain('VITE_GT_PROJECT_ID=project-id');
    expect(env).toContain('VITE_GT_DEV_API_KEY=gtx-dev-key');
    expect(env).toContain('GT_API_KEY=gtx-api-key');
    expect(env).not.toContain('VITE_GT_API_KEY');
  });
});
