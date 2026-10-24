import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../../console/logger.js';
import {
  clearWarnings,
  getWarnings,
} from '../../../state/translateWarnings.js';
import type { Settings } from '../../../types/index.js';
import { syncFonts } from '../syncFonts.js';

vi.mock('../../../formats/files/collectFonts.js', () => ({
  collectFonts: vi.fn(async () => [{ fileName: 'Inter.ttf' }]),
}));

describe('syncFonts', () => {
  const settings = {
    apiKey: 'org-key',
    baseUrl: 'https://api.example.com',
    projectId: 'project-id',
  } as Settings;

  beforeEach(() => {
    clearWarnings();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('explains a denied font upload and records it in the warnings summary', async () => {
    const message = 'Target not found or access denied';
    const requests: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        requests.push(`${request.method} ${new URL(request.url).pathname}`);
        return request.method === 'GET'
          ? Response.json({
              id: 'project-id',
              name: 'Project',
              orgId: 'org-id',
              defaultLocale: 'en',
              currentLocales: [],
              autoApprove: false,
              cdnEnabled: false,
            })
          : Response.json({ error: message }, { status: 403 });
      })
    );
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    await syncFonts(settings);

    expect(requests).toEqual([
      'GET /v2/projects/project-id',
      'POST /v2/orgs/org-id/assets',
    ]);
    const printed = String(warn.mock.calls[0][0]);
    expect(printed).toContain(message);
    expect(printed).toContain('org:assets:write');
    expect(printed).toContain('fallback fonts');
    expect(getWarnings()).toEqual([
      { category: 'failed_upload', fileName: 'Fonts', reason: message },
    ]);
  });

  it('skips the font request for a project API key with the denied-sync warning', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    await syncFonts({ ...settings, apiKey: 'gtx-api-project-key' });

    expect(fetch).not.toHaveBeenCalled();
    const printed = String(warn.mock.calls[0][0]);
    expect(printed).toContain('Font sync was denied');
    expect(printed).toContain('org:assets:write');
    expect(printed).toContain('fallback fonts');
    expect(getWarnings()).toEqual([
      {
        category: 'failed_upload',
        fileName: 'Fonts',
        reason: 'A project API key cannot upload organization fonts',
      },
    ]);
  });
});
