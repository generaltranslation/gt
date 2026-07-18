import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearI18nextConfigCache,
  getI18nextConfig,
} from '../reactI18nextConfig.js';

const tmpDirs: string[] = [];

function makeApp(files: Record<string, string>): string {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-ri18n-cfg-'));
  tmpDirs.push(cwd);
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(cwd, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return cwd;
}

beforeEach(() => clearI18nextConfigCache());
afterEach(() => {
  for (const dir of tmpDirs.splice(0))
    fs.rmSync(dir, { recursive: true, force: true });
});

describe('getI18nextConfig', () => {
  it('returns defaults when no config file exists', () => {
    const config = getI18nextConfig(makeApp({}));
    expect(config.defaultNS).toBe('translation');
    expect(config.locales).toBeNull();
    expect(config.separators.keySeparator).toBe('.');
    expect(config.separators.nsSeparator).toBe(':');
    expect(config.refuseReason).toBeNull();
  });

  it('reads locales, defaultLocale, defaultNS and ns from an init config', () => {
    const cwd = makeApp({
      'app/i18n/settings.ts': [
        'export function getOptions() {',
        '  return {',
        "    supportedLngs: ['en', 'pl', 'ar'],",
        "    fallbackLng: 'en',",
        "    defaultNS: 'common',",
        "    ns: ['common', 'dashboard'],",
        '  };',
        '}',
      ].join('\n'),
    });
    const config = getI18nextConfig(cwd);
    expect(config.locales).toEqual(['en', 'pl', 'ar']);
    expect(config.defaultLocale).toBe('en');
    expect(config.defaultNS).toBe('common');
    expect(config.namespaces).toEqual(['common', 'dashboard']);
  });

  it('resolves module-level const settings referenced by shorthand', () => {
    // The official i18next App Router example shape.
    const cwd = makeApp({
      'app/i18n/settings.ts': [
        "export const languages = ['en', 'pl', 'ar'];",
        "export const fallbackLng = 'en';",
        "export const defaultNS = 'common';",
        'export function getOptions(lng = fallbackLng, ns = defaultNS) {',
        '  return { supportedLngs: languages, fallbackLng, lng, defaultNS, ns };',
        '}',
      ].join('\n'),
    });
    const config = getI18nextConfig(cwd);
    expect(config.defaultNS).toBe('common');
    expect(config.locales).toEqual(['en', 'pl', 'ar']);
    expect(config.defaultLocale).toBe('en');
  });

  it('refuses keySeparator: false with a specific reason', () => {
    const cwd = makeApp({
      'i18n.ts': [
        'i18next.init({',
        "  fallbackLng: 'en',",
        '  keySeparator: false,',
        '});',
      ].join('\n'),
    });
    const config = getI18nextConfig(cwd);
    expect(config.refuseReason).toMatch(/keySeparator/);
  });

  it('refuses a non-default interpolation delimiter', () => {
    const cwd = makeApp({
      'i18n.ts': [
        'i18next.init({',
        "  fallbackLng: 'en',",
        "  interpolation: { prefix: '{', suffix: '}' },",
        '});',
      ].join('\n'),
    });
    const config = getI18nextConfig(cwd);
    expect(config.refuseReason).toMatch(/interpolation delimiter/);
  });

  it('refuses keySeparator: false spread from a base object (M4)', () => {
    // The false lives in a lower-scoring base object spread into init; the
    // refusal must OR across every option object, not just the best-scoring one.
    const cwd = makeApp({
      'i18n.ts': [
        'const base = { keySeparator: false };',
        'i18next.use(initReactI18next).init({',
        "  fallbackLng: 'en',",
        "  supportedLngs: ['en', 'fr'],",
        "  defaultNS: 'translation',",
        "  ns: ['translation', 'common'],",
        '  ...base,',
        '});',
      ].join('\n'),
    });
    const config = getI18nextConfig(cwd);
    expect(config.refuseReason).toMatch(/keySeparator/);
  });

  it('refuses a non-default interpolation delimiter in a spread base (M4)', () => {
    const cwd = makeApp({
      'i18n.ts': [
        "const base = { interpolation: { prefix: '${', suffix: '}' } };",
        'i18next.use(initReactI18next).init({',
        "  fallbackLng: 'en',",
        "  supportedLngs: ['en', 'fr'],",
        "  defaultNS: 'translation',",
        "  ns: ['translation', 'common'],",
        '  ...base,',
        '});',
      ].join('\n'),
    });
    const config = getI18nextConfig(cwd);
    expect(config.refuseReason).toMatch(/interpolation delimiter/);
  });

  it('reads a non-default nsSeparator without refusing', () => {
    const cwd = makeApp({
      'i18n.ts': [
        'i18next.init({',
        "  fallbackLng: 'en',",
        "  nsSeparator: '::',",
        '});',
      ].join('\n'),
    });
    const config = getI18nextConfig(cwd);
    expect(config.separators.nsSeparator).toBe('::');
    expect(config.refuseReason).toBeNull();
  });

  it('handles a fallbackLng map { default: [...] }', () => {
    const cwd = makeApp({
      'i18n.ts': [
        'i18next.init({',
        "  fallbackLng: { default: ['en'] },",
        "  supportedLngs: ['en', 'de'],",
        '});',
      ].join('\n'),
    });
    const config = getI18nextConfig(cwd);
    expect(config.defaultLocale).toBe('en');
    expect(config.locales).toEqual(['en', 'de']);
  });
});
