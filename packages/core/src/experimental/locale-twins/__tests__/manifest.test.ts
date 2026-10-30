import { describe, expect, it } from 'vitest';
import {
  LOCALE_TWIN_MANIFEST_FILE,
  LOCALE_TWIN_MANIFEST_VERSION,
  parseLocaleTwinManifest,
  type LocaleTwinManifest,
} from '../../internal';

const manifest: LocaleTwinManifest = {
  version: 1,
  defaultLocale: 'en',
  locales: ['en', 'fr'],
  twinned: ['assets/index-DGIdfwLW.js', 'assets/about-Bx1.js'],
  entries: ['assets/index-DGIdfwLW.js'],
  versions: { en: '0a1b2c3d', fr: '1a2b3c4d' },
  twins: {
    en: {
      'assets/index-DGIdfwLW.js': 'assets/index-DGIdfwLW.en-0a1b2c3d.js',
      'assets/about-Bx1.js': 'assets/about-Bx1.en-0a1b2c3d.js',
    },
    fr: {
      'assets/index-DGIdfwLW.js': 'assets/index-DGIdfwLW.fr-1a2b3c4d.js',
      'assets/about-Bx1.js': 'assets/about-Bx1.fr-1a2b3c4d.js',
    },
  },
};

describe('locale twin manifest constants', () => {
  it('names the manifest file and its format version', () => {
    expect(LOCALE_TWIN_MANIFEST_FILE).toBe('gt-locale-twins.json');
    expect(LOCALE_TWIN_MANIFEST_VERSION).toBe(1);
  });
});

describe('parseLocaleTwinManifest', () => {
  it('accepts a manifest object', () => {
    expect(parseLocaleTwinManifest(manifest)).toEqual(manifest);
  });

  it('accepts manifest JSON text', () => {
    expect(parseLocaleTwinManifest(JSON.stringify(manifest))).toEqual(manifest);
  });

  it('rejects unknown versions with a diagnostic naming the version', () => {
    expect(() => parseLocaleTwinManifest({ ...manifest, version: 2 })).toThrow(
      /^generaltranslation Error: .*locale twin manifest.*version 2.*\b1\b/
    );
  });

  it('rejects a manifest without a version', () => {
    const { version: _version, ...withoutVersion } = manifest;
    expect(() => parseLocaleTwinManifest(withoutVersion)).toThrow(
      /^generaltranslation Error: .*locale twin manifest.*version/
    );
  });

  it('rejects text that is not JSON', () => {
    expect(() => parseLocaleTwinManifest('<html>')).toThrow(
      /^generaltranslation Error: .*locale twin manifest/
    );
  });

  it.each([
    ['not an object', null],
    ['an array', []],
    ['missing defaultLocale', { ...manifest, defaultLocale: undefined }],
    ['defaultLocale not in locales', { ...manifest, defaultLocale: 'de' }],
    ['locales not strings', { ...manifest, locales: ['en', 1] }],
    ['twinned missing', { ...manifest, twinned: undefined }],
    ['entries not an array', { ...manifest, entries: 'assets/index.js' }],
    ['versions not strings', { ...manifest, versions: { en: 1 } }],
    ['twins locale map not an object', { ...manifest, twins: { en: [] } }],
    ['twin file names not strings', { ...manifest, twins: { en: { a: 1 } } }],
  ])('rejects a manifest with %s', (_, value) => {
    expect(() => parseLocaleTwinManifest(value)).toThrow(
      /^generaltranslation Error: .*locale twin manifest/
    );
  });
});
