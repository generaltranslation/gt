import { createSSRApp, defineComponent, h, type Component } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import { Currency, DateTime, Num, Var, createGT } from '../index';

describe('gt-vue formatting components', () => {
  it('preserves SSR boundaries around formatter text', async () => {
    const Root = defineComponent({
      setup() {
        return () =>
          h('p', [
            'Count: ',
            h(Num, { locales: ['en-US'], value: 1234 }),
            ' · Date: ',
            h(DateTime, {
              locales: ['en-US'],
              options: { timeZone: 'UTC', year: 'numeric' },
              value: new Date('2026-08-01T12:00:00.000Z'),
            }),
            ' · Total: ',
            h(Currency, {
              currency: 'USD',
              locales: ['en-US'],
              value: 12,
            }),
          ]);
      },
    });

    const html = await render(Root);

    expect(html).toContain('Count: <!--[-->1,234<!--]--> · Date: ');
    expect(html).toContain('<!--[-->2026<!--]--> · Total: ');
    expect(html).toContain('<!--[-->$12.00<!--]-->');
  });

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

  it('gives value props precedence over static slot text', async () => {
    const Root = defineComponent({
      setup() {
        return () =>
          h(Num, { locales: ['en-US'], value: 2 }, { default: () => '999' });
      },
    });

    expect(stripFragmentMarkers(await render(Root))).toBe('2');
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
