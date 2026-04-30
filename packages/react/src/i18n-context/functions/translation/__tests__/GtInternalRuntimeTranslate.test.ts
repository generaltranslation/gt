import { describe, expect, it, vi } from 'vitest';
import { getLocale, resolveJsxWithRuntimeFallback, tx } from 'gt-i18n/internal';
import { GtInternalRuntimeTranslateJsx } from '../GtInternalRuntimeTranslateJsx';
import { GtInternalRuntimeTranslateString } from '../GtInternalRuntimeTranslateString';

vi.mock('gt-i18n/internal', () => ({
  getLocale: vi.fn(() => 'fr'),
  resolveJsxWithRuntimeFallback: vi.fn(),
  tx: vi.fn(),
}));

describe('internal runtime translation functions', () => {
  it('defaults JSX runtime translation to the current locale', () => {
    const content = ['Hello'];

    GtInternalRuntimeTranslateJsx(content);

    expect(resolveJsxWithRuntimeFallback).toHaveBeenCalledWith(content, {
      $format: 'JSX',
      $locale: 'fr',
    });
  });

  it('allows JSX runtime translation to override $locale', () => {
    const content = ['Hello'];

    GtInternalRuntimeTranslateJsx(content, { $locale: 'es' });

    expect(resolveJsxWithRuntimeFallback).toHaveBeenCalledWith(content, {
      $format: 'JSX',
      $locale: 'es',
    });
  });

  it('allows string runtime translation to pass through $locale', () => {
    GtInternalRuntimeTranslateString('Hello', { $locale: 'es' });

    expect(tx).toHaveBeenCalledWith('Hello', {
      $format: 'ICU',
      $locale: 'es',
    });
  });

  it('reads the current locale through locale operations', () => {
    GtInternalRuntimeTranslateJsx(['Hello']);

    expect(getLocale).toHaveBeenCalled();
  });
});
