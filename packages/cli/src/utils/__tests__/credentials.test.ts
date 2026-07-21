import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { setCredentials } from '../credentials.js';

describe('setCredentials for Next.js Pages Router', () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('keeps credentials server-only and replaces them on rerun', async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gt-pages-credentials-')
    );
    temporaryDirectories.push(directory);
    fs.writeFileSync(
      path.join(directory, '.env.local'),
      'CUSTOM_VALUE=preserved\nNEXT_PUBLIC_GT_PROJECT_ID=legacy\n'
    );

    await setCredentials(
      {
        projectId: 'first-project',
        apiKeys: [{ type: 'development', key: 'first-key' }],
      },
      'next-pages',
      directory
    );
    await setCredentials(
      {
        projectId: 'final-project',
        apiKeys: [{ type: 'development', key: 'final-key' }],
      },
      'next-pages',
      directory
    );

    const env = fs.readFileSync(path.join(directory, '.env.local'), 'utf8');
    expect(env).toContain('CUSTOM_VALUE=preserved');
    expect(env).toContain('GT_PROJECT_ID=final-project');
    expect(env).toContain('GT_DEV_API_KEY=final-key');
    expect(env).not.toContain('NEXT_PUBLIC_');
    expect(env.match(/^GT_PROJECT_ID=/gm)).toHaveLength(1);
    expect(env.match(/^GT_DEV_API_KEY=/gm)).toHaveLength(1);
  });
});
