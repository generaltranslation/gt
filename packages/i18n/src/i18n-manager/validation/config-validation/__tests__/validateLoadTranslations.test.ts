import { describe, it, expect } from 'vitest';
import { validateLoadTranslations } from '../validateLoadTranslations';

describe('validateLoadTranslations', () => {
  it('requires projectId for remote loading', () => {
    const result = validateLoadTranslations({ cacheUrl: 'https://example.com' });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('error');
    expect(result[0].message).toContain('projectId is required');
  });

  it('requires customTranslationLoader for custom loading', () => {
    const result = validateLoadTranslations({ customTranslationLoader: undefined, cacheUrl: null });
    expect(result).toHaveLength(0);
  });

  it('requires projectId for GT remote', () => {
    const result = validateLoadTranslations({});
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('error');
    expect(result[0].message).toContain('projectId is required');
  });
});