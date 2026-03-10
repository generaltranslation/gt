import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  applyStructuralTransforms,
  unapplyStructuralTransforms,
} from '../transformJson';
import { parseJson } from '../parseJson';
import { mergeJson } from '../mergeJson';
import { extractJson } from '../extractJson';
import { logger } from '../../../console/logger.js';
import { exitSync } from '../../../console/logging.js';

vi.mock('../../../console/logger.js');
vi.mock('../../../console/logging.js');

const mockLogError = vi.spyOn(logger, 'error');
const mockExit = vi.mocked(exitSync).mockImplementation(() => {
  throw new Error('Process exit called');
});

// Sample data: a product catalog with source text in "label" and translations in "i18n"
const sampleJson = {
  btn_save: {
    label: 'Save changes',
    i18n: {
      es: 'Guardar cambios',
      fr: 'Enregistrer les modifications',
    },
    context: 'toolbar',
  },
  btn_cancel: {
    label: 'Cancel',
    i18n: {
      es: 'Cancelar',
      fr: 'Annuler',
    },
    context: 'toolbar',
  },
};

const compositeConfig = {
  '$.*.i18n': {
    type: 'object' as const,
    include: ['$'],
  },
};

const transforms = [
  { sourcePointer: '/label', destinationPointer: '/i18n/en' },
];

describe('structuralTransform', () => {
  beforeEach(() => {
    mockLogError.mockClear();
    mockExit.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('applyStructuralTransforms', () => {
    it('should copy sourcePointer value to destinationPointer for each entry', () => {
      const json = structuredClone(sampleJson);
      applyStructuralTransforms(json, transforms, compositeConfig);

      expect(json.btn_save.i18n.en).toBe('Save changes');
      expect(json.btn_cancel.i18n.en).toBe('Cancel');
    });

    it('should preserve existing translations', () => {
      const json = structuredClone(sampleJson);
      applyStructuralTransforms(json, transforms, compositeConfig);

      expect(json.btn_save.i18n.es).toBe('Guardar cambios');
      expect(json.btn_save.i18n.fr).toBe('Enregistrer les modifications');
      expect(json.btn_cancel.i18n.es).toBe('Cancelar');
    });

    it('should preserve non-translation fields', () => {
      const json = structuredClone(sampleJson);
      applyStructuralTransforms(json, transforms, compositeConfig);

      expect(json.btn_save.label).toBe('Save changes');
      expect(json.btn_save.context).toBe('toolbar');
    });

    it('should skip entries where sourcePointer value is undefined', () => {
      const json = {
        item_a: {
          i18n: { es: 'Hola' },
          context: 'greeting',
        },
      };
      // no "label" field exists
      applyStructuralTransforms(json, transforms, compositeConfig);

      expect((json.item_a.i18n as any).en).toBeUndefined();
    });

    it('should handle multiple transforms', () => {
      const json = {
        page_home: {
          title: 'Home',
          description: 'Welcome page',
          content: {
            en: {},
          },
        },
      };
      const multiTransforms = [
        { sourcePointer: '/title', destinationPointer: '/content/en/title' },
        {
          sourcePointer: '/description',
          destinationPointer: '/content/en/description',
        },
      ];
      const multiComposite = {
        '$.*.content': {
          type: 'object' as const,
          include: ['$'],
        },
      };

      applyStructuralTransforms(json, multiTransforms, multiComposite);

      expect(json.page_home.content.en).toEqual({
        title: 'Home',
        description: 'Welcome page',
      });
    });
  });

  describe('unapplyStructuralTransforms', () => {
    it('should delete destinationPointer value for each entry', () => {
      const json = structuredClone(sampleJson);
      // First apply, then unapply
      applyStructuralTransforms(json, transforms, compositeConfig);
      expect(json.btn_save.i18n.en).toBe('Save changes');

      unapplyStructuralTransforms(json, transforms, compositeConfig);
      expect((json.btn_save.i18n as any).en).toBeUndefined();
      expect((json.btn_cancel.i18n as any).en).toBeUndefined();
    });

    it('should leave sourcePointer value intact', () => {
      const json = structuredClone(sampleJson);
      applyStructuralTransforms(json, transforms, compositeConfig);
      unapplyStructuralTransforms(json, transforms, compositeConfig);

      expect(json.btn_save.label).toBe('Save changes');
      expect(json.btn_cancel.label).toBe('Cancel');
    });

    it('should preserve other translations', () => {
      const json = structuredClone(sampleJson);
      applyStructuralTransforms(json, transforms, compositeConfig);
      unapplyStructuralTransforms(json, transforms, compositeConfig);

      expect(json.btn_save.i18n.es).toBe('Guardar cambios');
      expect(json.btn_save.i18n.fr).toBe('Enregistrer les modifications');
    });

    it('should not throw if destinationPointer does not exist', () => {
      const json = structuredClone(sampleJson);
      // unapply without apply — /i18n/en doesn't exist
      expect(() => {
        unapplyStructuralTransforms(json, transforms, compositeConfig);
      }).not.toThrow();
    });

    it('should produce identical output to original input after round-trip', () => {
      const json = structuredClone(sampleJson);
      const originalSnapshot = JSON.stringify(json);

      applyStructuralTransforms(json, transforms, compositeConfig);
      unapplyStructuralTransforms(json, transforms, compositeConfig);

      expect(JSON.stringify(json)).toBe(originalSnapshot);
    });
  });

  describe('parseJson integration', () => {
    it('should parse composite JSON with structural transform', () => {
      const json = structuredClone(sampleJson);
      const content = JSON.stringify(json);

      const result = parseJson(
        content,
        'catalog.json',
        {
          jsonSchema: {
            '**/*.json': {
              structuralTransform: transforms,
              composite: compositeConfig,
            },
          },
        },
        'en'
      );

      const parsed = JSON.parse(result);
      // Source text extracted with empty-string pointer (value is a string, not an object)
      expect(parsed['/btn_save/i18n']).toEqual({ '': 'Save changes' });
      expect(parsed['/btn_cancel/i18n']).toEqual({ '': 'Cancel' });
    });
  });

  describe('mergeJson integration', () => {
    // Use object-valued translations for merge test (composite object merge
    // works with object sourceItems, not primitive strings)
    const mergeOriginal = {
      hero_banner: {
        defaultText: { title: 'Welcome', subtitle: 'Get started today' },
        translations: {
          es: { title: 'Bienvenido', subtitle: 'Comienza hoy' },
        },
        placement: 'top',
      },
      cta_button: {
        defaultText: { title: 'Sign up' },
        translations: {
          es: { title: 'Regístrate' },
        },
        placement: 'bottom',
      },
    };

    const mergeComposite = {
      '$.*.translations': {
        type: 'object' as const,
        include: ['$.title', '$.subtitle'],
      },
    };

    const mergeTransforms = [
      {
        sourcePointer: '/defaultText',
        destinationPointer: '/translations/en',
      },
    ];

    it('should merge and unapply so output does not contain injected key', () => {
      const originalContent = JSON.stringify(mergeOriginal);

      const translatedContent = JSON.stringify({
        '/hero_banner/translations': {
          '/title': 'Willkommen',
          '/subtitle': 'Starten Sie noch heute',
        },
        '/cta_button/translations': {
          '/title': 'Anmelden',
        },
      });

      const result = mergeJson(
        originalContent,
        'catalog.json',
        {
          jsonSchema: {
            '**/*.json': {
              structuralTransform: mergeTransforms,
              composite: mergeComposite,
            },
          },
        },
        [{ translatedContent, targetLocale: 'de' }],
        'en'
      );

      const merged = JSON.parse(result[0]);
      // German translation should be present
      expect(merged.hero_banner.translations.de.title).toBe('Willkommen');
      expect(merged.hero_banner.translations.de.subtitle).toBe(
        'Starten Sie noch heute'
      );
      expect(merged.cta_button.translations.de.title).toBe('Anmelden');
      // Injected "en" key should be removed by unapply
      expect(merged.hero_banner.translations.en).toBeUndefined();
      expect(merged.cta_button.translations.en).toBeUndefined();
      // Original fields preserved
      expect(merged.hero_banner.defaultText.title).toBe('Welcome');
      expect(merged.hero_banner.placement).toBe('top');
      // Existing translations preserved
      expect(merged.hero_banner.translations.es.title).toBe('Bienvenido');
    });
  });

  describe('extractJson integration', () => {
    it('should extract translations using structural transform', () => {
      const json = structuredClone(sampleJson);
      const content = JSON.stringify(json);

      const result = extractJson(
        content,
        'catalog.json',
        {
          jsonSchema: {
            '**/*.json': {
              structuralTransform: transforms,
              composite: compositeConfig,
            },
          },
        },
        'es',
        'en'
      );

      expect(result).not.toBeNull();
      const extracted = JSON.parse(result!);
      expect(extracted['/btn_save/i18n']).toEqual({ '': 'Guardar cambios' });
      expect(extracted['/btn_cancel/i18n']).toEqual({ '': 'Cancelar' });
    });
  });
});
