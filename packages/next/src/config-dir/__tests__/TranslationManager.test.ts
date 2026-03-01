import { TranslationManager } from '../TranslationManager';

describe('TranslationManager', () => {
  let manager: TranslationManager;

  beforeEach(() => {
    manager = new TranslationManager();
  });

  describe('setTranslations', () => {
    it('should set a translation entry', () => {
      manager.setTranslations('en', 'hash1', 'Hello');
      const translations = manager.getRecentTranslations('en');
      expect(translations).toEqual({ hash1: 'Hello' });
    });

    it('should accumulate translations for the same locale', () => {
      manager.setTranslations('en', 'hash1', 'Hello');
      manager.setTranslations('en', 'hash2', 'World');
      const translations = manager.getRecentTranslations('en');
      expect(translations).toEqual({ hash1: 'Hello', hash2: 'World' });
    });

    it('should overwrite an existing hash', () => {
      manager.setTranslations('en', 'hash1', 'Hello');
      manager.setTranslations('en', 'hash1', 'Hi');
      const translations = manager.getRecentTranslations('en');
      expect(translations).toEqual({ hash1: 'Hi' });
    });

    it('should return false for invalid inputs', () => {
      expect(manager.setTranslations('', 'hash1', 'Hello')).toBe(false);
      expect(manager.setTranslations('en', '', 'Hello')).toBe(false);
    });

    it('should keep separate translations per locale', () => {
      manager.setTranslations('en', 'hash1', 'Hello');
      manager.setTranslations('fr', 'hash1', 'Bonjour');
      expect(manager.getRecentTranslations('en')).toEqual({ hash1: 'Hello' });
      expect(manager.getRecentTranslations('fr')).toEqual({
        hash1: 'Bonjour',
      });
    });

    it('should mutate in place (not create new objects)', () => {
      manager.setTranslations('en', 'hash1', 'Hello');
      const ref1 = manager.getRecentTranslations('en');
      manager.setTranslations('en', 'hash2', 'World');
      const ref2 = manager.getRecentTranslations('en');
      // Same object reference means mutation in place
      expect(ref1).toBe(ref2);
    });
  });
});
