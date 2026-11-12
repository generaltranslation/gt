import { afterEach, describe, expect, it, vi } from 'vitest';
import { getI18nConfig } from 'gt-i18n/internal';
import { initializeGT } from '../initializeGT';

describe.sequential('initializeGT credentials', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    Reflect.deleteProperty(globalThis, '__generaltranslation');
  });

  it('reads GT_PROJECT_ID and GT_API_KEY when a param is not set', () => {
    vi.stubEnv('GT_PROJECT_ID', 'env-project-id');
    vi.stubEnv('GT_API_KEY', 'env-api-key');

    initializeGT({ projectId: 'explicit-project-id' });

    expect(getI18nConfig().getTranslationRuntime()).toMatchObject({
      projectId: 'explicit-project-id',
      apiKey: 'env-api-key',
    });
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
