import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveTranslationSync } from '../sync-translation-resolution';
import { getI18nManager } from '../../../i18n-manager/singleton-operations';
import { interpolateMessage } from '../../utils/interpolation/interpolateMessage';

vi.mock('../../../i18n-manager/singleton-operations');
vi.mock('../../utils/interpolation/interpolateMessage');

describe('resolveTranslationSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(interpolateMessage).mockReturnValue('interpolated-result');
  });

  it('should call interpolateMessage with source, target, and options when translation found', () => {
    const mockManager = {
      getLocale: vi.fn().mockReturnValue('fr'),
      lookupTranslation: vi.fn().mockReturnValue('Bonjour {name} !'),
      getDefaultLocale: vi.fn().mockReturnValue('en'),
    };
    vi.mocked(getI18nManager).mockReturnValue(
      mockManager as unknown as ReturnType<typeof getI18nManager>
    );

    const message = 'Hello {name}!';
    const options = { $locale: 'fr', name: 'Alice' };

    resolveTranslationSync('fr', message, options);

    expect(interpolateMessage).toHaveBeenCalledWith({
      source: 'Hello {name}!',
      target: 'Bonjour {name} !',
      options: {
        $format: 'ICU',
        $locale: 'fr',
        name: 'Alice',
      },
      sourceLocale: 'en',
    });
  });

  it('should return undefined when no translation found', () => {
    const mockManager = {
      getLocale: vi.fn().mockReturnValue('fr'),
      lookupTranslation: vi.fn().mockReturnValue(undefined),
    };
    vi.mocked(getI18nManager).mockReturnValue(
      mockManager as unknown as ReturnType<typeof getI18nManager>
    );

    const message = 'Hello {name}!';
    const options = { $locale: 'fr', name: 'Alice' };

    const result = resolveTranslationSync('fr', message, options);

    expect(result).toBeUndefined();
    expect(interpolateMessage).not.toHaveBeenCalled();
  });

  it('should preserve user options when translation found', () => {
    const mockManager = {
      getLocale: vi.fn().mockReturnValue('fr'),
      lookupTranslation: vi.fn().mockReturnValue('Translated'),
      getDefaultLocale: vi.fn().mockReturnValue('en'),
    };
    vi.mocked(getI18nManager).mockReturnValue(
      mockManager as unknown as ReturnType<typeof getI18nManager>
    );

    const message = 'Hello {name}!';
    const options = {
      $locale: 'fr',
      name: 'Bob',
      $context: 'greeting',
      $id: 'hello-msg',
    };

    resolveTranslationSync('fr', message, options);

    expect(interpolateMessage).toHaveBeenCalledWith({
      source: 'Hello {name}!',
      target: 'Translated',
      options: {
        $format: 'ICU',
        $locale: 'fr',
        name: 'Bob',
        $context: 'greeting',
        $id: 'hello-msg',
      },
      sourceLocale: 'en',
    });
  });

  it('should preserve $format in options passed to interpolateMessage', () => {
    const mockManager = {
      getLocale: vi.fn().mockReturnValue('fr'),
      lookupTranslation: vi.fn().mockReturnValue('Translated'),
      getDefaultLocale: vi.fn().mockReturnValue('en'),
    };
    vi.mocked(getI18nManager).mockReturnValue(
      mockManager as unknown as ReturnType<typeof getI18nManager>
    );

    const message = 'Hello {name}!';
    const options = {
      $locale: 'fr',
      name: 'Alice',
      $format: 'STRING' as const,
    };

    resolveTranslationSync('fr', message, options);

    expect(interpolateMessage).toHaveBeenCalledWith({
      source: 'Hello {name}!',
      target: 'Translated',
      options: {
        $format: 'STRING',
        $locale: 'fr',
        name: 'Alice',
      },
      sourceLocale: 'en',
    });
  });
});
