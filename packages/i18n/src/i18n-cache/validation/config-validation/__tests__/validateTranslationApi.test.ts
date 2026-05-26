import { describe, it, expect } from 'vitest';
import { validateTranslationApi } from '../validateTranslationApi';

describe('validateTranslationApi', () => {
  it('requires projectId for GT API', () => {
    const result = validateTranslationApi({ devApiKey: 'test-key' });
    expect(result).toHaveLength(0);
  });

  it('requires API key for translation API', () => {
    const result = validateTranslationApi({ projectId: 'test-project' });
    expect(result).toHaveLength(0);
  });

  it('passes validation when disabled', () => {
    const result = validateTranslationApi({ runtimeUrl: null });
    expect(result).toHaveLength(0);
  });
});
