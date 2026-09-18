import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  exchangeCliWizardCredentials,
  generateCredentialsSession,
  setCredentials,
} from '../credentials.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('generateCredentialsSession', () => {
  it('registers the loopback callback and new flow version', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        sessionId: 'cli_synthetic',
        verifier: 'V'.repeat(43),
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      generateCredentialsSession(
        'https://api.example',
        'production',
        'http://127.0.0.1:49152/cli/callback'
      )
    ).resolves.toEqual({
      sessionId: 'cli_synthetic',
      verifier: 'V'.repeat(43),
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example/cli/wizard/session',
      expect.objectContaining({
        body: JSON.stringify({
          callbackUrl: 'http://127.0.0.1:49152/cli/callback',
          flowVersion: 2,
          keyType: 'production',
        }),
      })
    );
  });
});

describe('exchangeCliWizardCredentials', () => {
  it('sends the verifier and authorization code to the session exchange', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        apiKeys: [{ key: 'gtx-api-synthetic', type: 'production' }],
        projectId: 'project_1',
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      exchangeCliWizardCredentials(
        'https://api.example',
        'cli_synthetic',
        'V'.repeat(43),
        'A'.repeat(43)
      )
    ).resolves.toEqual({
      apiKeys: [{ key: 'gtx-api-synthetic', type: 'production' }],
      projectId: 'project_1',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example/cli/wizard/cli_synthetic/exchange',
      expect.objectContaining({
        body: JSON.stringify({ authorizationCode: 'A'.repeat(43) }),
        headers: expect.objectContaining({
          'x-gt-cli-verifier': 'V'.repeat(43),
        }),
      })
    );
  });

  it('rejects an unsuccessful exchange response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 404 }))
    );

    await expect(
      exchangeCliWizardCredentials(
        'https://api.example',
        'cli_synthetic',
        'V'.repeat(43),
        'A'.repeat(43)
      )
    ).rejects.toThrow('Credential exchange returned HTTP 404');
  });

  it('rejects credentials with an invalid response shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ apiKeys: [] }))
    );

    await expect(
      exchangeCliWizardCredentials(
        'https://api.example',
        'cli_synthetic',
        'V'.repeat(43),
        'A'.repeat(43)
      )
    ).rejects.toThrow('Credential exchange returned an invalid response');
  });
});

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
