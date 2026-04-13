import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveTranslationSync } from '../sync-translation-resolution';
import { getI18nManager } from '../../../i18n-manager/singleton-operations';
import { interpolateMessage } from '../../utils/interpolateMessage';

vi.mock('../../../i18n-manager/singleton-operations');
vi.mock('../../utils/interpolateMessage');

describe('resolveTranslationSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(interpolateMessage).mockReturnValue('interpolated-result');
  });

  it('should call interpolateMessage with the translation and $_fallback set to original message when translation found', () => {
    const mockManager = {
      resolveTranslationSync: vi.fn().mockReturnValue('Bonjour {name} !'),
      getLocale: vi.fn().mockReturnValue('fr'),
    };
    vi.mocked(getI18nManager).mockReturnValue(mockManager as any);

    const message = 'Hello {name}!';
    const options = { name: 'Alice' };

    resolveTranslationSync(message, options);

    expect(interpolateMessage).toHaveBeenCalledWith('Bonjour {name} !', {
      $locale: 'fr',
      name: 'Alice',
      $_fallback: 'Hello {name}!',
    });
  });

  it('should return undefined when no translation found', () => {
    const mockManager = {
      resolveTranslationSync: vi.fn().mockReturnValue(undefined),
    };
    vi.mocked(getI18nManager).mockReturnValue(mockManager as any);

    const message = 'Hello {name}!';
    const options = { name: 'Alice' };

    const result = resolveTranslationSync(message, options);

    expect(result).toBeUndefined();
    expect(interpolateMessage).not.toHaveBeenCalled();
  });

  it('should preserve user options alongside $_fallback when translation found', () => {
    const mockManager = {
      resolveTranslationSync: vi.fn().mockReturnValue('Translated'),
      getLocale: vi.fn().mockReturnValue('es'),
    };
    vi.mocked(getI18nManager).mockReturnValue(mockManager as any);

    const message = 'Hello {name}!';
    const options = { name: 'Bob', $context: 'greeting', $id: 'hello-msg' };

    resolveTranslationSync(message, options);

    expect(interpolateMessage).toHaveBeenCalledWith('Translated', {
      $locale: 'es',
      name: 'Bob',
      $context: 'greeting',
      $id: 'hello-msg',
      $_fallback: 'Hello {name}!',
    });
  });

  it('should preserve $format in options passed to interpolateMessage', () => {
    const mockManager = {
      resolveTranslationSync: vi.fn().mockReturnValue('Translated'),
      getLocale: vi.fn().mockReturnValue('fr'),
    };
    vi.mocked(getI18nManager).mockReturnValue(mockManager as any);

    const message = 'Hello {name}!';
    const options = { name: 'Alice', $format: 'STRING' };

    resolveTranslationSync(message, options);

    expect(interpolateMessage).toHaveBeenCalledWith('Translated', {
      $locale: 'fr',
      name: 'Alice',
      $format: 'STRING',
      $_fallback: 'Hello {name}!',
    });
  });
});
