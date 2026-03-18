import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveTranslationSync } from '../resolveTranslationSync';
import { getI18nManager } from '../../../i18n-manager/singleton-operations';
import { gtFallback } from '../../fallbacks/gtFallback';

vi.mock('../../../i18n-manager/singleton-operations');
vi.mock('../../fallbacks/gtFallback');

describe('resolveTranslationSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(gtFallback).mockReturnValue('fallback-result');
  });

  it('should call gtFallback with the translation and $_fallback set to original message when translation found', () => {
    const mockManager = {
      resolveTranslationSync: vi.fn().mockReturnValue('Bonjour {name} !'),
    };
    vi.mocked(getI18nManager).mockReturnValue(mockManager as any);

    const message = 'Hello {name}!';
    const options = { name: 'Alice' };

    resolveTranslationSync(message, options);

    expect(gtFallback).toHaveBeenCalledWith('Bonjour {name} !', {
      name: 'Alice',
      $_fallback: 'Hello {name}!',
    });
  });

  it('should call gtFallback with original message and user options (no $_fallback) when no translation found', () => {
    const mockManager = {
      resolveTranslationSync: vi.fn().mockReturnValue(undefined),
    };
    vi.mocked(getI18nManager).mockReturnValue(mockManager as any);

    const message = 'Hello {name}!';
    const options = { name: 'Alice' };

    resolveTranslationSync(message, options);

    expect(gtFallback).toHaveBeenCalledWith('Hello {name}!', {
      name: 'Alice',
    });
    // Verify $_fallback is NOT present
    const callArgs = vi.mocked(gtFallback).mock.calls[0][1];
    expect(callArgs).not.toHaveProperty('$_fallback');
  });

  it('should preserve user options alongside $_fallback when translation found', () => {
    const mockManager = {
      resolveTranslationSync: vi.fn().mockReturnValue('Translated'),
    };
    vi.mocked(getI18nManager).mockReturnValue(mockManager as any);

    const message = 'Hello {name}!';
    const options = { name: 'Bob', $context: 'greeting', $id: 'hello-msg' };

    resolveTranslationSync(message, options);

    expect(gtFallback).toHaveBeenCalledWith('Translated', {
      name: 'Bob',
      $context: 'greeting',
      $id: 'hello-msg',
      $_fallback: 'Hello {name}!',
    });
  });
});
