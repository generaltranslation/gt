import { describe, it, expect } from 'vitest';
import { _isSameDialect } from '../isSameDialect';
import { _requiresTranslation } from '../requiresTranslation';

describe('_isSameDialect', () => {
  it('treats a bare language as the same dialect as its regional variants', () => {
    expect(_isSameDialect('en', 'en-US')).toBe(true);
    expect(_isSameDialect('en', 'en-GB')).toBe(true);
    expect(_isSameDialect('en-US', 'en')).toBe(true);
  });

  it('treats different regions as different dialects', () => {
    expect(_isSameDialect('en-US', 'en-GB')).toBe(false);
  });

  it('treats different languages as different dialects', () => {
    expect(_isSameDialect('en', 'fr')).toBe(false);
  });

  it('never matches a pseudo-locale region against an unspecified region', () => {
    expect(_isSameDialect('en', 'en-XA')).toBe(false);
    expect(_isSameDialect('en-XA', 'en')).toBe(false);
    expect(_isSameDialect('ar', 'ar-XB')).toBe(false);
  });

  it('still matches identical pseudo-locales', () => {
    expect(_isSameDialect('en-XA', 'en-XA')).toBe(true);
  });

  it('keeps pseudo-locales distinct from real regional variants', () => {
    expect(_isSameDialect('en-US', 'en-XA')).toBe(false);
  });
});

describe('_requiresTranslation', () => {
  it('does not require translation for a regional variant of the source', () => {
    expect(_requiresTranslation('en', 'en-US', ['en-US'])).toBe(false);
  });

  it('requires translation for pseudo-locales of the source language', () => {
    expect(_requiresTranslation('en', 'en-XA', ['en-XA'])).toBe(true);
    expect(_requiresTranslation('ar', 'ar-XB', ['ar-XB'])).toBe(true);
  });

  it('requires translation for a different language', () => {
    expect(_requiresTranslation('en', 'es', ['es'])).toBe(true);
  });
});
