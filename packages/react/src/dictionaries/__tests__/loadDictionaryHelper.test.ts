import { describe, it, expect, vi, beforeEach } from 'vitest';
import loadDictionaryHelper from '../loadDictionaryHelper';
import { CustomLoader, Dictionary } from '../../types/types';

// Mock the generaltranslation library
vi.mock('generaltranslation', () => ({
  getLocaleProperties: vi.fn((locale: string) => {
    // Mock implementation that extracts language code from locale
    if (locale === 'en-US') return { languageCode: 'en' };
    if (locale === 'es-ES') return { languageCode: 'es' };
    if (locale === 'fr-CA') return { languageCode: 'fr' };
    if (locale === 'pt-BR') return { languageCode: 'pt' };
    // For languages without regions, return the same as language code
    return { languageCode: locale };
  }),
}));

// Mock console.warn to avoid noise in tests
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('loadDictionaryHelper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleWarn.mockClear();
  });

  describe('should load dictionary successfully', () => {
    it('should return dictionary when loader succeeds for exact locale', async () => {
      const mockDictionary: Dictionary = {
        greeting: 'Hello',
        farewell: 'Goodbye',
      };

      const mockLoader: CustomLoader = vi
        .fn()
        .mockResolvedValue(mockDictionary);

      const result = await loadDictionaryHelper('en-US', mockLoader);

      expect(result).toEqual(mockDictionary);
      expect(mockLoader).toHaveBeenCalledWith('en-US');
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });

    it('should fallback to language code when exact locale fails', async () => {
      const mockDictionary: Dictionary = {
        greeting: 'Hello',
        farewell: 'Goodbye',
      };

      const mockLoader: CustomLoader = vi
        .fn()
        .mockRejectedValueOnce(new Error('Locale not found'))
        .mockResolvedValueOnce(mockDictionary);

      const result = await loadDictionaryHelper('en-US', mockLoader);

      expect(result).toEqual(mockDictionary);
      expect(mockLoader).toHaveBeenCalledTimes(2);
      expect(mockLoader).toHaveBeenNthCalledWith(1, 'en-US');
      expect(mockLoader).toHaveBeenNthCalledWith(2, 'en');
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });

    it('should return dictionary for language-only locale', async () => {
      const mockDictionary: Dictionary = {
        greeting: 'Bonjour',
        farewell: 'Au revoir',
      };

      const mockLoader: CustomLoader = vi
        .fn()
        .mockResolvedValue(mockDictionary);

      const result = await loadDictionaryHelper('fr', mockLoader);

      expect(result).toEqual(mockDictionary);
      expect(mockLoader).toHaveBeenCalledTimes(1);
      expect(mockLoader).toHaveBeenCalledWith('fr');
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });
  });

  describe('should handle loader returning falsy values', () => {
    it('should continue to fallback when loader returns null', async () => {
      const mockDictionary: Dictionary = {
        greeting: 'Hello',
      };

      const mockLoader: CustomLoader = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockDictionary);

      const result = await loadDictionaryHelper('en-US', mockLoader);

      expect(result).toEqual(mockDictionary);
      expect(mockLoader).toHaveBeenCalledTimes(2);
      expect(mockLoader).toHaveBeenNthCalledWith(1, 'en-US');
      expect(mockLoader).toHaveBeenNthCalledWith(2, 'en');
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });

    it('should continue to fallback when loader returns undefined', async () => {
      const mockDictionary: Dictionary = {
        greeting: 'Hello',
      };

      const mockLoader: CustomLoader = vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(mockDictionary);

      const result = await loadDictionaryHelper('en-US', mockLoader);

      expect(result).toEqual(mockDictionary);
      expect(mockLoader).toHaveBeenCalledTimes(2);
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });

    it('should return undefined and warn when all attempts fail with falsy values', async () => {
      const mockLoader: CustomLoader = vi.fn().mockResolvedValue(null);

      const result = await loadDictionaryHelper('en-US', mockLoader);

      expect(result).toBeUndefined();
      expect(mockLoader).toHaveBeenCalledTimes(2);
      expect(mockLoader).toHaveBeenNthCalledWith(1, 'en-US');
      expect(mockLoader).toHaveBeenNthCalledWith(2, 'en');
      expect(mockConsoleWarn).toHaveBeenCalledTimes(1);
    });
  });

  describe('should handle loader errors', () => {
    it('should return undefined and warn when all attempts throw errors', async () => {
      const mockLoader: CustomLoader = vi
        .fn()
        .mockRejectedValue(new Error('Dictionary not found'));

      const result = await loadDictionaryHelper('en-US', mockLoader);

      expect(result).toBeUndefined();
      expect(mockLoader).toHaveBeenCalledTimes(2);
      expect(mockLoader).toHaveBeenNthCalledWith(1, 'en-US');
      expect(mockLoader).toHaveBeenNthCalledWith(2, 'en');
      expect(mockConsoleWarn).toHaveBeenCalledTimes(1);
    });

    it('should ignore errors and continue to next locale', async () => {
      const mockDictionary: Dictionary = {
        greeting: 'Hello',
      };

      const mockLoader: CustomLoader = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockDictionary);

      const result = await loadDictionaryHelper('fr-CA', mockLoader);

      expect(result).toEqual(mockDictionary);
      expect(mockLoader).toHaveBeenCalledTimes(2);
      expect(mockLoader).toHaveBeenNthCalledWith(1, 'fr-CA');
      expect(mockLoader).toHaveBeenNthCalledWith(2, 'fr');
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });
  });

  describe('should handle locale deduplication', () => {
    it('should not call loader twice for same locale when locale equals language code', async () => {
      const mockDictionary: Dictionary = {
        greeting: 'Hello',
      };

      const mockLoader: CustomLoader = vi
        .fn()
        .mockResolvedValue(mockDictionary);

      const result = await loadDictionaryHelper('en', mockLoader);

      expect(result).toEqual(mockDictionary);
      expect(mockLoader).toHaveBeenCalledTimes(1);
      expect(mockLoader).toHaveBeenCalledWith('en');
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });

    it('should handle complex locale fallback', async () => {
      const mockLoader: CustomLoader = vi
        .fn()
        .mockRejectedValueOnce(new Error('pt-BR not found'))
        .mockRejectedValueOnce(new Error('pt not found'));

      const result = await loadDictionaryHelper('pt-BR', mockLoader);

      expect(result).toBeUndefined();
      expect(mockLoader).toHaveBeenCalledTimes(2);
      expect(mockLoader).toHaveBeenNthCalledWith(1, 'pt-BR');
      expect(mockLoader).toHaveBeenNthCalledWith(2, 'pt');
      expect(mockConsoleWarn).toHaveBeenCalledTimes(1);
    });
  });

  describe('should handle edge cases', () => {
    it('should handle empty string locale', async () => {
      const mockLoader: CustomLoader = vi
        .fn()
        .mockRejectedValue(new Error('Invalid locale'));

      const result = await loadDictionaryHelper('', mockLoader);

      expect(result).toBeUndefined();
      expect(mockLoader).toHaveBeenCalledWith('');
      expect(mockConsoleWarn).toHaveBeenCalledTimes(1);
    });

    it('should handle very long locale string', async () => {
      const longLocale = 'en-US-POSIX-custom-variant-extra';
      const mockDictionary: Dictionary = { test: 'value' };
      const mockLoader: CustomLoader = vi
        .fn()
        .mockResolvedValue(mockDictionary);

      const result = await loadDictionaryHelper(longLocale, mockLoader);

      expect(result).toEqual(mockDictionary);
      expect(mockLoader).toHaveBeenCalledWith(longLocale);
    });

    it('should handle loader that returns empty dictionary', async () => {
      const emptyDict: Dictionary = {};
      const mockLoader: CustomLoader = vi.fn().mockResolvedValue(emptyDict);

      const result = await loadDictionaryHelper('en', mockLoader);

      expect(result).toEqual(emptyDict);
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });

    it('should handle Promise rejection with non-Error objects', async () => {
      const mockDictionary: Dictionary = { greeting: 'Hello' };
      const mockLoader: CustomLoader = vi
        .fn()
        .mockRejectedValueOnce('String error')
        .mockRejectedValueOnce({ error: 'Object error' })
        .mockResolvedValueOnce(mockDictionary);

      // This should not be reached since we only try 2 locales
      const result = await loadDictionaryHelper('en-US', mockLoader);

      expect(result).toBeUndefined();
      expect(mockConsoleWarn).toHaveBeenCalledTimes(1);
    });
  });

  describe('should handle complex dictionary structures', () => {
    it('should successfully load complex nested dictionary', async () => {
      const complexDict: Dictionary = {
        user: {
          profile: {
            name: 'John',
            bio: ['Software Developer', { $context: 'bio' }],
          },
        },
        messages: {
          welcome: ['Welcome {name}!', { $context: 'greeting' }],
          errors: {
            notFound: 'Item not found',
            serverError: ['Server error occurred', { $context: 'error' }],
          },
        },
      };

      const mockLoader: CustomLoader = vi.fn().mockResolvedValue(complexDict);

      const result = await loadDictionaryHelper('es-ES', mockLoader);

      expect(result).toEqual(complexDict);
      expect(mockLoader).toHaveBeenCalledWith('es-ES');
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });
  });
});
