import { libraryDefaultLocale } from 'generaltranslation/internal';
import { createSSRApp, defineComponent, h, type Component } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it, vi } from 'vitest';
import { getFormatLocales } from '../components/utils';
import { Currency, DateTime, Num, Var, createGT } from '../index';

describe('gt-vue formatting components', () => {
  it('formats typed number, currency, Date, and epoch values', async () => {
    const Root = defineComponent({
      setup() {
        return () =>
          h('div', [
            h(Num, { locales: ['en-US'], value: 1234.5 }),
            '|',
            h(Currency, {
              currency: 'USD',
              locales: ['en-US'],
              value: 12,
            }),
            '|',
            h(DateTime, {
              locales: ['en-US'],
              options: { timeZone: 'UTC', year: 'numeric' },
              value: new Date('2024-01-01T00:00:00.123Z'),
            }),
            '|',
            h(DateTime, {
              locales: ['en-US'],
              options: { timeZone: 'UTC', year: 'numeric' },
              value: 1704067200000,
            }),
          ]);
      },
    });

    expect(stripFragmentMarkers(await render(Root))).toContain(
      '1,234.5|$12.00|2024|2024'
    );
  });

  it('does not treat formatter slot children as values', async () => {
    const slot = vi.fn(() => '999');
    const Root = defineComponent({
      setup() {
        return () =>
          h('div', [
            h(Num, { locales: ['en-US'], value: 2 }, { default: slot }),
            h(Currency, { locales: ['en-US'], value: 3 }, { default: slot }),
            h(
              DateTime,
              {
                locales: ['en-US'],
                options: { timeZone: 'UTC', year: 'numeric' },
                value: 1704067200000,
              },
              { default: slot }
            ),
          ]);
      },
    });

    expect(stripFragmentMarkers(await render(Root))).toContain('2$3.002024');
    expect(slot).not.toHaveBeenCalled();
  });

  it('returns partially parseable value strings unchanged', async () => {
    const Root = defineComponent({
      setup() {
        return () =>
          h('div', [
            h(Num, { locales: ['en-US'], value: '1,234.5' }),
            '|',
            h(Currency, {
              currency: 'USD',
              locales: ['en-US'],
              value: '12 dollars',
            }),
          ]);
      },
    });

    expect(stripFragmentMarkers(await render(Root))).toContain(
      '1,234.5|12 dollars'
    );
  });

  it('returns invalid dates unchanged', async () => {
    const Root = defineComponent({
      setup() {
        return () => h(DateTime, { value: 'definitely-not-a-date' as string });
      },
    });

    expect(await render(Root)).toContain('definitely-not-a-date');
  });

  it('does not interpret nullish or whitespace-only values as zero or a date', async () => {
    const Root = defineComponent({
      setup() {
        return () =>
          h('div', [
            h(Num, { value: '   ' }),
            h(Currency, { value: '\n' }),
            h(DateTime, { value: '\t' }),
            h(Num, { value: null }),
            h(Currency, { value: null }),
            h(DateTime, { value: null }),
          ]);
      },
    });

    expect(stripFragmentMarkers(await render(Root))).toBe('<div></div>');
  });

  it('accepts explicit null values without required or type warnings', async () => {
    const Root = defineComponent({
      setup() {
        return () =>
          h('div', [
            h(Num, { value: null }),
            h(Currency, { value: null }),
            h(DateTime, { value: null }),
          ]);
      },
    });
    const warnings: string[] = [];
    const app = createSSRApp(Root).use(createGT());
    app.config.warnHandler = (message) => warnings.push(message);

    expect(stripFragmentMarkers(await renderToString(app))).toBe('<div></div>');
    expect(warnings).toEqual([]);
  });

  it('uses only the default locale when it is active', () => {
    expect(getFormatLocales(['fr-CA'], 'en', 'en')).toEqual(['en']);
    expect(getFormatLocales(['fr-CA'], libraryDefaultLocale)).toEqual([
      libraryDefaultLocale,
    ]);
  });

  it('ignores explicit formatter locales when the default locale is active', async () => {
    const Root = defineComponent({
      setup() {
        return () => h(Num, { locales: ['de-DE'], value: 1234.5 });
      },
    });

    expect(stripFragmentMarkers(await render(Root))).toBe('1,234.5');
  });

  it('prefers explicit locales for standalone formatters at a non-default locale', async () => {
    const Root = defineComponent({
      setup() {
        return () => h(Num, { locales: ['de'], value: 1234.5 });
      },
    });
    const app = createSSRApp(Root).use(
      createGT({ defaultLocale: 'en', locale: 'fr' })
    );

    expect(stripFragmentMarkers(await renderToString(app))).toBe(
      new Intl.NumberFormat('de').format(1234.5)
    );
  });

  it('tries explicit, active, and default locales once while translating', () => {
    expect(getFormatLocales(['fr-CA', 'fr', 'en'], 'fr', 'en')).toEqual([
      'fr-CA',
      'fr',
      'en',
    ]);
  });

  it('ignores fallthrough attributes without warning for unwrapped values', async () => {
    let listenerCalls = 0;
    const fallthrough = {
      class: 'ignored-class',
      'data-ignored': 'ignored-data',
      onClick: () => {
        listenerCalls += 1;
      },
      title: 'ignored-title',
    };
    const Root = defineComponent({
      setup() {
        return () =>
          h('div', [
            h(Var, fallthrough, { default: () => 'Ada' }),
            h(Var, fallthrough, {
              default: () => h('span', { id: 'inner' }, 'Grace'),
            }),
            h(Num, { ...fallthrough, locales: ['en-US'], value: 2 }),
            h(Currency, {
              ...fallthrough,
              currency: 'USD',
              locales: ['en-US'],
              value: 3,
            }),
            h(DateTime, {
              ...fallthrough,
              locales: ['en-US'],
              options: { timeZone: 'UTC', year: 'numeric' },
              value: 1704067200000,
            }),
          ]);
      },
    });
    const warnings: string[] = [];
    const app = createSSRApp(Root).use(createGT());
    app.config.warnHandler = (message) => warnings.push(message);

    const html = await renderToString(app);

    expect(html).toContain('Ada');
    expect(html).toContain('<span id="inner">Grace</span>');
    expect(html).toContain('2');
    expect(html).toContain('$3.00');
    expect(html).toContain('2024');
    expect(html).not.toContain('ignored-');
    expect(listenerCalls).toBe(0);
    expect(warnings).toEqual([]);
  });
});

async function render(root: Component): Promise<string> {
  return renderToString(createSSRApp(root).use(createGT()));
}

function stripFragmentMarkers(html: string): string {
  return html.replaceAll('<!--[-->', '').replaceAll('<!--]-->', '');
}
