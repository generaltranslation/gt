import { describe, it, expect } from 'vitest';
import { validateLocales } from '../validateLocales';

describe('validateLocales', () => {
  it('requires defaultLocale when locales provided', () => {
    const result = validateLocales({ locales: ['en', 'es'] });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('error');
    expect(result[0].message).toContain('defaultLocale is required');
  });

  it('validates locale format', () => {
    const result = validateLocales({ 
      locales: ['invalid-locale'], 
      defaultLocale: 'invalid-locale' 
    });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('error');
    expect(result[0].message).toContain('Invalid locale format');
  });

  it('detects duplicate locales', () => {
    const result = validateLocales({ 
      locales: ['en', 'en', 'es'], 
      defaultLocale: 'en' 
    });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('error');
    expect(result[0].message).toContain('duplicate values');
  });
});