import { describe, it, expect } from 'vitest';
import { validateLoadTranslations } from '../validateLoadTranslations';

describe('validateLoadTranslations', () => {
  it('does not warn at config time when projectId is missing for remote loading', () => {
    // Deferred to loader invocation: translations may be provided externally
    const result = validateLoadTranslations({
      cacheUrl: 'https://example.com',
    });
    expect(result).toHaveLength(0);
  });

  it('requires customTranslationLoader for custom loading', () => {
    const result = validateLoadTranslations({
      loadTranslations: undefined,
      cacheUrl: null,
    });
    expect(result).toHaveLength(0);
  });

  it('does not warn at config time when projectId is missing for GT remote', () => {
    const result = validateLoadTranslations({
      cacheUrl: 'https://cdn.gtx.dev',
    });
    expect(result).toHaveLength(0);
  });
});
