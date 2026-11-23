import { afterEach, describe, expect, it, vi } from 'vitest';
import { getI18nConfig } from 'gt-i18n/internal';
import { initializeGT } from '../initializeGT';

describe.sequential('initializeGT credentials', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(globalThis, '__generaltranslation');
  });

  it('reads GT_PROJECT_ID and GT_API_KEY when a param is not set', async () => {
    vi.stubEnv('GT_PROJECT_ID', 'env-project-id');
    vi.stubEnv('GT_API_KEY', 'env-api-key');
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ results: [] })
    );
    vi.stubGlobal('fetch', fetchMock);

    initializeGT({ projectId: 'explicit-project-id' });
    const runtime = getI18nConfig().getTranslationRuntime();
    await runtime.translateMany([], 'es');

    expect(runtime.projectId).toBe('explicit-project-id');
    expect(
      new Request(...fetchMock.mock.calls[0]).headers.get('authorization')
    ).toBe('Bearer env-api-key');
  });

  it('does not use a variable set after initialization', () => {
    vi.stubEnv('GT_API_KEY', undefined);
    initializeGT({ projectId: 'project-id' });
    vi.stubEnv('GT_API_KEY', 'late-api-key');

    expect(() => getI18nConfig().getTranslationRuntime()).toThrow(
      'Runtime translation needs an API key'
    );
  });
});
