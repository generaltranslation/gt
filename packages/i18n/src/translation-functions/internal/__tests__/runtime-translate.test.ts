import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocale } from '../../../helpers/locale';
import { resolveJsxWithRuntimeFallback } from '../helpers';
import { GtInternalRuntimeTranslateJsx } from '../runtime-translate';

vi.mock('../../../helpers/locale');
vi.mock('../helpers');

describe('internal runtime translate helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLocale).mockReturnValue('fr');
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
