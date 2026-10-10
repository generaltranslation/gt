// The languages offered: Payload's locales except the default, named as the
// project names them, with codes GT does not recognise marked.
import { describe, expect, it } from 'vitest';
import { targetLocaleOptions } from '../locales';

describe('targetLocaleOptions', () => {
  it('lists every locale but the default, in order', () => {
    const options = targetLocaleOptions({
      locales: ['en', 'es', 'fr'],
      defaultLocale: 'en',
    });

    expect(options.map((o) => o.code)).toEqual(['es', 'fr']);
    expect(options[0]).toMatchObject({ name: 'Spanish', supported: true });
  });

  it('uses the label set in Payload', () => {
    const options = targetLocaleOptions({
      locales: [
        { code: 'en' },
        { code: 'es-MX', label: 'Español (México)' },
        { code: 'de', label: { en: 'German (formal)', de: 'Deutsch' } },
      ],
      defaultLocale: 'en',
    });

    expect(options.map((o) => o.name)).toEqual([
      'Español (México)',
      'German (formal)',
    ]);
  });

  it('names a locale Payload labelled with its own code', () => {
    const [option] = targetLocaleOptions({
      locales: [
        { code: 'en', label: 'en' },
        { code: 'es', label: 'es' },
      ],
      defaultLocale: 'en',
    });

    expect(option.name).toBe('Spanish');
  });

  it('marks a code GT does not recognise', () => {
    const [option] = targetLocaleOptions({
      locales: ['en', 'cn'],
      defaultLocale: 'en',
    });

    expect(option).toMatchObject({ code: 'cn', supported: false });
  });

  it('accepts a code mapped with customMapping', () => {
    const [option] = targetLocaleOptions(
      { locales: ['en', 'cn'], defaultLocale: 'en' },
      { cn: { code: 'zh' } }
    );

    expect(option).toMatchObject({ code: 'cn', supported: true });
  });

  it('lists nothing without localization', () => {
    expect(targetLocaleOptions(false)).toEqual([]);
  });
});
