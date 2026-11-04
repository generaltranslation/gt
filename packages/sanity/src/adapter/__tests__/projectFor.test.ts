// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProjectHandle } from 'generaltranslation';
import { configureGt, projectFor } from '../core';

describe('projectFor', () => {
  const fetchMock = vi.fn<typeof fetch>();
  let api: ProjectHandle;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    configureGt({
      customMapping: {
        source: { code: 'en-US' },
        target: { code: 'es-ES' },
      },
    });
    api = projectFor({
      organization: 'org-id',
      project: 'project-id',
      secret: 'api-key',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requires the API key from the Studio secrets', () => {
    for (const secrets of [
      null,
      { organization: 'org-id', project: 'project-id' },
    ]) {
      expect(() => projectFor(secrets)).toThrow(
        'gt-sanity Error: Translation needs a General Translation API key. Add the API key to the plugin secrets in the Studio.'
      );
    }
  });

  it('applies the plugin locale configuration to requests', async () => {
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await new Request(request).text()) as {
        sourceLocale?: string;
        targetLocales: string[];
      };
      expect(body.sourceLocale).toBe('en-US');
      expect(body.targetLocales).toEqual(['es-ES']);
      return Response.json({ jobs: [] }, { status: 202 });
    });

    await api.translateFiles([{ fileId: 'file-id', versionId: 'version-id' }], {
      sourceLocale: 'source',
      targetLocales: ['target'],
    });

    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
