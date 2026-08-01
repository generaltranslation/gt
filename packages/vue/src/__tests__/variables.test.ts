import { createSSRApp, defineComponent, h, type Component } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import { Currency, DateTime, Num, createGT } from '../index';

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

    expect(await render(Root)).toContain('1,234.5|$12.00|2024|2024');
  });

  it('gives value props precedence over static slot text', async () => {
    const Root = defineComponent({
      setup() {
        return () =>
          h(Num, { locales: ['en-US'], value: 2 }, { default: () => '999' });
      },
    });

    expect(await render(Root)).toBe('2');
  });

  it('returns partially parseable slot text unchanged', async () => {
    const Root = defineComponent({
      setup() {
        return () =>
          h('div', [
            h(Num, { locales: ['en-US'] }, { default: () => '1,234.5' }),
            '|',
            h(
              Currency,
              { currency: 'USD', locales: ['en-US'] },
              { default: () => '12 dollars' }
            ),
          ]);
      },
    });

    expect(await render(Root)).toContain('1,234.5|12 dollars');
  });

  it('returns invalid dates unchanged', async () => {
    const Root = defineComponent({
      setup() {
        return () => h(DateTime, { value: 'definitely-not-a-date' as string });
      },
    });

    expect(await render(Root)).toContain('definitely-not-a-date');
  });

  it('does not interpret whitespace-only slot text as zero or a date', async () => {
    const Root = defineComponent({
      setup() {
        return () =>
          h('div', [
            h(Num, null, { default: () => '   ' }),
            h(Currency, null, { default: () => '\n' }),
            h(DateTime, null, { default: () => '\t' }),
          ]);
      },
    });

    expect(await render(Root)).toBe('<div><!----><!----><!----></div>');
  });
});

async function render(root: Component): Promise<string> {
  return renderToString(createSSRApp(root).use(createGT()));
}
