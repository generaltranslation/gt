import { beforeEach, describe, expect, it } from 'vitest';
import { createSSRApp, defineComponent, h, nextTick } from 'vue';
import type { VNodeChild } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { hashMessage } from 'gt-i18n/internal';
import { T } from '../components/T';
import { Plural } from '../components/branches';
import { Num, Var } from '../components/variables';
import { LocaleSelector } from '../components/LocaleSelector';
import { useTranslations } from '../dictionary';
import { useLocale } from '../locale-composables';
import { createGT } from '../plugin';
import { t, useGT } from '../translate';
import { tagChildren } from '../internal/tagChildren';
import { writeChildrenAsObjects } from '../internal/writeChildrenAsObjects';

type Translations = Record<string, Record<string, unknown>>;

async function initGT({
  locale = 'es',
  translations = {},
  dictionary,
}: {
  locale?: string;
  translations?: Translations;
  dictionary?: Record<string, unknown>;
} = {}) {
  // Reset the first-write-wins singletons between tests
  delete (globalThis as Record<string, unknown>).__generaltranslation;

  const gt = createGT({
    defaultLocale: 'en',
    locales: ['es', 'fr'],
    locale,
    loadTranslations: async (locale: string) => translations[locale] ?? {},
    ...(dictionary && { dictionary }),
  });
  await gt.ready;
  return gt;
}

function jsxHash(children: VNodeChild, locale: string): string {
  const wire = writeChildrenAsObjects(tagChildren(children));
  return hashMessage(wire as never, { $format: 'JSX', $locale: locale });
}

async function renderApp(render: () => VNodeChild): Promise<string> {
  const app = createSSRApp(
    defineComponent({
      setup: () => render,
    })
  );
  return await renderToString(app);
}

describe('<T> rendering', () => {
  beforeEach(() => {
    delete (globalThis as Record<string, unknown>).__generaltranslation;
  });

  const greeting = () => [
    h('p', null, [
      'Hello, ',
      h(Var, { name: 'name' }, { default: () => 'Alice' }),
      '!',
    ]),
  ];

  it('renders source content when no translation exists', async () => {
    await initGT();
    const html = await renderApp(() => h(T, null, { default: greeting }));
    expect(html).toContain('Hello, ');
    expect(html).toContain('Alice');
  });

  it('renders the translated tree with reordered variables', async () => {
    const hash = jsxHash(greeting(), 'es');
    await initGT({
      translations: {
        es: {
          [hash]: {
            t: 'p',
            i: 1,
            c: ['¡Hola, ', { k: 'name', v: 'v', i: 2 }, '!'],
          },
        },
      },
    });
    const html = await renderApp(() => h(T, null, { default: greeting }));
    expect(html).toContain('¡Hola, ');
    expect(html).toContain('Alice');
    expect(html).not.toContain('Hello');
  });

  it('renders element structure from the translation (reordering)', async () => {
    const source = () => [
      h('b', null, "Alice's"),
      ' happy ',
      h('i', null, 'customer'),
    ];
    const hash = jsxHash(source(), 'es');
    await initGT({
      translations: {
        es: {
          [hash]: [
            { c: 'El cliente', i: 2 },
            ' feliz ',
            { c: 'de Alice', i: 1 },
          ],
        },
      },
    });
    const html = await renderApp(() => h(T, null, { default: source }));
    // Translated order: <i> first, then <b>
    expect(html).toMatch(/<i>El cliente<\/i> feliz <b>de Alice<\/b>/);
  });

  it('resolves plural branches in the source render', async () => {
    await initGT({ locale: 'en' });
    const pluralOf = (n: number) => () => [
      h(
        Plural,
        { n },
        {
          one: () => [
            h('p', null, ['You have ', h(Num, { value: n }), ' item']),
          ],
          other: () => [
            h('p', null, ['You have ', h(Num, { value: n }), ' items']),
          ],
        }
      ),
    ];
    expect(
      await renderApp(() => h(T, null, { default: pluralOf(1) }))
    ).toContain('1 item<');
    expect(
      await renderApp(() => h(T, null, { default: pluralOf(2) }))
    ).toContain('2 items');
  });

  it('resolves translated plural branches', async () => {
    const pluralOf = (n: number) => () => [
      h(
        Plural,
        { n },
        {
          one: () => [h('p', null, 'One item')],
          other: () => [h('p', null, 'Some items')],
        }
      ),
    ];
    const hash = jsxHash(pluralOf(1)(), 'es');
    await initGT({
      translations: {
        es: {
          [hash]: {
            t: 'Plural',
            i: 1,
            d: {
              t: 'p',
              b: {
                one: [{ t: 'p', i: 2, c: 'Un artículo' }],
                other: [{ t: 'p', i: 2, c: 'Varios artículos' }],
              },
            },
          },
        },
      },
    });
    expect(
      await renderApp(() => h(T, null, { default: pluralOf(1) }))
    ).toContain('Un artículo');
    expect(
      await renderApp(() => h(T, null, { default: pluralOf(5) }))
    ).toContain('Varios artículos');
  });
});

describe('string translation', () => {
  it('useGT resolves translated strings with variables', async () => {
    const hash = hashMessage('Hello, {name}!', {
      $format: 'ICU',
      $locale: 'es',
    });
    await initGT({
      translations: { es: { [hash]: '¡Hola, {name}!' } },
    });
    const html = await renderApp(() => {
      const gt = useGT();
      return h('p', null, gt('Hello, {name}!', { name: 'Alice' }));
    });
    expect(html).toContain('¡Hola, Alice!');
  });

  it('t() resolves translated strings after initialization', async () => {
    const hash = hashMessage('Sync string', { $format: 'ICU', $locale: 'es' });
    await initGT({
      translations: { es: { [hash]: 'Cadena síncrona' } },
    });
    expect(t('Sync string')).toBe('Cadena síncrona');
  });

  it('useTranslations resolves dictionary entries', async () => {
    await initGT({
      locale: 'en',
      dictionary: { greetings: { hello: 'Hello, world!' } },
    });
    const html = await renderApp(() => {
      const translate = useTranslations();
      return h('p', null, translate('greetings.hello'));
    });
    expect(html).toContain('Hello, world!');
  });
});

describe('reactive locale switching', () => {
  it('setting the useLocale ref switches translations without a reload', async () => {
    const hash = hashMessage('Switch me', { $format: 'ICU', $locale: 'fr' });
    await initGT({
      locale: 'en',
      translations: { fr: { [hash]: 'Changé' } },
    });

    const locale = useLocale();
    expect(locale.value).toBe('en');
    expect(t('Switch me')).toBe('Switch me');

    locale.value = 'fr';
    // setLocale loads the new locale's translations before flipping the ref
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();

    expect(locale.value).toBe('fr');
    expect(t('Switch me')).toBe('Changé');
  });
});

describe('<LocaleSelector>', () => {
  it('renders an option per locale', async () => {
    await initGT();
    const html = await renderApp(() => h(LocaleSelector));
    expect(html).toContain('<select');
    expect(html).toContain('Español');
    expect(html).toContain('Français');
  });
});
