import { describe, expect, it } from 'vitest';
import { DEFAULT_SEPARATORS } from '../catalogConvert.js';
import { collectCallSiteEvidence } from '../reactI18nextEvidence.js';

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

  it('ignores t-like calls not bound to useTranslation', () => {
    const { countKeys } = collect(
      ['function C() {', "  return t('items', { count: n });", '}'].join('\n')
    );
    expect(countKeys.size).toBe(0);
  });
});
