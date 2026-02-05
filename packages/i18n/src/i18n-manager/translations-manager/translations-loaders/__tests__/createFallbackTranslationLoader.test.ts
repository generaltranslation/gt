import { describe, it, expect } from 'vitest';
import { createFallbackTranslationLoader } from '../createFallbackTranslationLoader';

describe('createFallbackTranslationLoader', () => {
  it('returns loader function', () => {
    const loader = createFallbackTranslationLoader();
    expect(typeof loader).toBe('function');
  });

  it('loader returns empty translations', async () => {
    const loader = createFallbackTranslationLoader();
    const result = await loader('en');
    expect(result).toEqual({});
  });
});