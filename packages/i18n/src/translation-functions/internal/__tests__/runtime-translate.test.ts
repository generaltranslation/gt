import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocale } from '../../../helpers/locale';
import { resolveJsxWithRuntimeFallback } from '../helpers';
import {
  GtInternalRuntimeTranslateJsx,
  GtInternalRuntimeTranslateString,
} from '../runtime-translate';
import { txPrefetch } from '../tx';

vi.mock('../../../helpers/locale');
vi.mock('../helpers');
vi.mock('../tx');

describe('internal runtime translate helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLocale).mockReturnValue('fr');
  });

  it('prefetches strings with the compiler string format default', () => {
    GtInternalRuntimeTranslateString('Hello', { $locale: 'es' });

    expect(txPrefetch).toHaveBeenCalledWith('Hello', {
      $format: 'ICU',
      $locale: 'es',
    });
  });

  it('translates JSX with the current locale by default', () => {
    const content = ['Hello'];

    GtInternalRuntimeTranslateJsx(content);

    expect(resolveJsxWithRuntimeFallback).toHaveBeenCalledWith('fr', content, {
      $format: 'JSX',
    });
  });

  it('translates JSX with an explicit locale when provided', () => {
    const content = ['Hello'];

    GtInternalRuntimeTranslateJsx(content, { $locale: 'es' });

    expect(resolveJsxWithRuntimeFallback).toHaveBeenCalledWith('es', content, {
      $format: 'JSX',
      $locale: 'es',
    });
  });
});
