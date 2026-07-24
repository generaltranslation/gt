import { describe, expect, it } from 'vitest';
import {
  convertCatalogs,
  DEFAULT_SEPARATORS,
  type Separators,
} from '../catalogs/catalogConvert.js';
import { collectCallSiteEvidence } from '../catalogs/reactI18nextEvidence.js';

function collect(code: string, defaultNS = 'translation') {
  return collectCallSiteEvidence(
    [{ file: 'src/app/page.tsx', code }],
    defaultNS,
    DEFAULT_SEPARATORS
  );
}

describe('collectCallSiteEvidence', () => {
  it('records count evidence keyed by default namespace', () => {
    const { countKeys } = collect(
      [
        "import { useTranslation } from 'react-i18next';",
        'function C() {',
        '  const { t } = useTranslation();',
        "  return t('items', { count: n });",
        '}',
      ].join('\n')
    );
    expect(countKeys.has('translation:items')).toBe(true);
  });

  it('records count evidence under a scoped namespace', () => {
    const { countKeys } = collect(
      [
        "import { useTranslation } from 'react-i18next';",
        'function C() {',
        "  const { t } = useTranslation('dashboard');",
        "  return t('widgets.count', { count: n });",
        '}',
      ].join('\n')
    );
    expect(countKeys.has('dashboard:widgets.count')).toBe(true);
  });

  it('honors an explicit ns:key prefix over the binding namespace', () => {
    const { countKeys } = collect(
      [
        "import { useTranslation } from 'react-i18next';",
        'function C() {',
        '  const { t } = useTranslation();',
        "  return t('common:apples', { count: n });",
        '}',
      ].join('\n')
    );
    expect(countKeys.has('common:apples')).toBe(true);
  });

  it('records context evidence', () => {
    const { contextKeys } = collect(
      [
        "import { useTranslation } from 'react-i18next';",
        'function C() {',
        '  const { t } = useTranslation();',
        "  return t('friend', { context: g });",
        '}',
      ].join('\n')
    );
    expect(contextKeys.has('translation:friend')).toBe(true);
  });

  it('records literal defaultValues (positional and option form)', () => {
    const { defaults } = collect(
      [
        "import { useTranslation } from 'react-i18next';",
        'function C() {',
        '  const { t } = useTranslation();',
        "  t('greeting', 'Hello');",
        "  t('farewell', { defaultValue: 'Bye' });",
        '  return null;',
        '}',
      ].join('\n')
    );
    expect(defaults).toContainEqual({
      ns: 'translation',
      key: 'greeting',
      value: 'Hello',
    });
    expect(defaults).toContainEqual({
      ns: 'translation',
      key: 'farewell',
      value: 'Bye',
    });
  });

  it('reads the options object after a positional string default (3-arg t)', () => {
    const { countKeys, defaults } = collect(
      [
        "import { useTranslation } from 'react-i18next';",
        'function C() {',
        '  const { t } = useTranslation();',
        "  return t('items', 'fallback', { count: n });",
        '}',
      ].join('\n')
    );
    // The positional default is still recorded...
    expect(defaults).toContainEqual({
      ns: 'translation',
      key: 'items',
      value: 'fallback',
    });
    // ...and the third-argument options object is no longer dropped.
    expect(countKeys.has('translation:items')).toBe(true);
  });

  it('ignores t-like calls not bound to useTranslation', () => {
    const { countKeys } = collect(
      ['function C() {', "  return t('items', { count: n });", '}'].join('\n')
    );
    expect(countKeys.size).toBe(0);
  });

  it('normalizes a custom keySeparator so nested-key evidence matches the converter', () => {
    const separators: Separators = { ...DEFAULT_SEPARATORS, keySeparator: '|' };
    const { contextKeys, countKeys } = collectCallSiteEvidence(
      [
        {
          file: 'src/app/page.tsx',
          code: [
            "import { useTranslation } from 'react-i18next';",
            'function C() {',
            '  const { t } = useTranslation();',
            "  t('profile|friend', { context: g });",
            "  return t('profile|items', { count: n });",
            '}',
          ].join('\n'),
        },
      ],
      'translation',
      separators
    );
    // The converter builds `{ns}:{dotted.path}` keys, so evidence for a custom
    // keySeparator must be normalized to '.' or the lookup never matches.
    expect(contextKeys.has('translation:profile.friend')).toBe(true);
    expect(countKeys.has('translation:profile.items')).toBe(true);

    // And that normalized evidence actually gates the nested context conversion.
    const { byLocale } = convertCatalogs({
      defaultLocale: 'en',
      locales: ['en'],
      defaultNS: 'translation',
      raw: {
        en: {
          translation: {
            profile: { friend: 'a friend', friend_male: 'his friend' },
          },
        },
      },
      separators,
      contextKeys,
    });
    const profile = byLocale.en.profile as Record<string, unknown>;
    expect(profile.friend).toBe(
      '{context, select, male {his friend} other {a friend}}'
    );
  });
});
