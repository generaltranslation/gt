import type { JsxChildren } from 'generaltranslation/types';
import { hashSource } from 'generaltranslation/id';
import {
  Fragment,
  createCommentVNode,
  createRenderer,
  createSSRApp,
  defineComponent,
  h,
  nextTick,
  ref,
  vShow,
  withDirectives,
  type Slots,
} from 'vue';
import { renderToString } from 'vue/server-renderer';
import { getBranchNames } from '../components/utils';
import {
  Branch,
  Currency,
  DateTime,
  Num,
  Plural,
  T,
  Var,
  createGT,
  msg,
  useGT,
  useLocale,
  useMessages,
} from '../index';
import type { TranslationCatalog } from '../index';

describe('gt-vue runtime', () => {
  it('deduplicates branch names shared by attrs and slots', () => {
    const slots = {
      default: () => [],
      one: () => [],
      other: () => [],
    } as Slots;

    expect(
      getBranchNames({ one: 'attribute', 'data-note': 'ignored' }, slots)
    ).toEqual(['one', 'other']);
  });

  it('loads and caches plain STRING translations, then rerenders on locale changes', async () => {
    const source = 'Hello, {name}!';
    const encoded = msg('Navigation: home', { $context: 'navigation' });
    const loadTranslations = vi.fn(async (locale: string) =>
      locale === 'fr'
        ? {
            [stringHash(source, 'greeting')]: 'Bonjour, {name}!',
            [stringHash('Navigation: home', 'navigation')]:
              'Navigation : accueil',
          }
        : {}
    );
    const plugin = createGT({ loadTranslations });
    const Root = defineComponent({
      setup() {
        const gt = useGT();
        const m = useMessages();
        const locale = useLocale();
        return () =>
          h(
            'p',
            `${locale.value}|${gt(source, { $context: 'greeting' })}|${m(encoded)}`
          );
      },
    });
    const mounted = mount(Root, plugin);

    expect(textContent(mounted.root)).toBe(
      'en|Hello, {name}!|Navigation: home'
    );

    await Promise.all([
      plugin.loadTranslations('fr'),
      plugin.loadTranslations('fr'),
    ]);
    await plugin.setLocale('fr');
    await nextTick();

    expect(textContent(mounted.root)).toBe(
      'fr|Bonjour, {name}!|Navigation : accueil'
    );
    expect(loadTranslations).toHaveBeenCalledTimes(1);

    await plugin.setLocale('en');
    await plugin.setLocale('fr');
    expect(loadTranslations).toHaveBeenCalledTimes(1);
    mounted.app.unmount();
  });

  it('keeps msg and useMessages context-only and never interpolates', async () => {
    const contextual = msg('Literal {name}: 你好', { $context: 'example' });
    const empty = msg('', { $context: 'empty' });
    const messages: string[] = msg(['First', 'Second'] as const, {
      $context: 'list',
    });
    const plugin = createGT({
      loadTranslations: async () => ({
        [stringHash('Literal {name}: 你好', 'example')]:
          'Littéral {name} : 你好',
        [stringHash('First', 'list')]: 'Premier',
        [stringHash('Second', 'list')]: 'Deuxième',
        [stringHash('', 'empty')]: 'Vide',
      }),
    });
    await plugin.setLocale('fr');

    let nullResult: null | undefined | string;
    let undefinedResult: null | undefined | string;
    const Root = defineComponent({
      setup() {
        const m = useMessages();
        nullResult = m(null);
        undefinedResult = m(undefined);
        return () =>
          h('p', [m(contextual), '|', ...messages.map(m), '|', m(empty)]);
      },
    });
    const html = await renderWithPlugin(Root, plugin);

    expect(html).toContain('Littéral {name} : 你好|PremierDeuxième|Vide');
    expect(nullResult!).toBeNull();
    expect(undefinedResult!).toBeUndefined();
  });

  it('renders translated rich children and preserves child-only variables', async () => {
    const name = ref('Ada');
    const source: JsxChildren = {
      t: 'p',
      i: 1,
      d: { ti: 'Greeting' },
      c: ['Hello, ', { i: 2, k: '_gt_value_2', v: 'v' }, '!'],
    };
    const target: JsxChildren = {
      t: 'p',
      i: 1,
      d: { ti: 'Salutation' },
      c: ['Bonjour, ', { i: 2, k: '_gt_value_2', v: 'v' }, ' !'],
    };
    const plugin = createGT({
      loadTranslations: async () => ({ [jsxHash(source, 'hero')]: target }),
    });
    await plugin.setLocale('fr');
    const Root = defineComponent({
      setup() {
        return () =>
          h(
            T,
            { $context: 'hero' },
            {
              default: () =>
                h('p', { title: 'Greeting' }, [
                  'Hello, ',
                  h(Var, null, { default: () => name.value }),
                  '!',
                ]),
            }
          );
      },
    });
    const mounted = mount(Root, plugin);
    await nextTick();

    expect(textContent(mounted.root)).toBe('Bonjour, Ada !');
    expect(findElement(mounted.root, 'p')?.props.title).toBe('Salutation');

    name.value = 'Grace';
    await nextTick();
    expect(textContent(mounted.root)).toBe('Bonjour, Grace !');
    mounted.app.unmount();
  });

  it('preserves component props while replacing translated slot children', async () => {
    const onNavigate = vi.fn();
    const Link = defineComponent({
      emits: ['navigate'],
      name: 'TestLink',
      props: {
        title: { type: String, required: true },
        to: { type: String, required: true },
      },
      setup(props, { emit, slots }) {
        return () =>
          h(
            'a',
            {
              href: props.to,
              onClick: () => emit('navigate'),
              title: props.title,
            },
            slots.default?.()
          );
      },
    });
    const plugin = createGT({
      loadTranslations: async () => ({
        link: {
          t: 'TestLink',
          i: 1,
          d: { ti: 'Titre traduit' },
          c: 'Lien traduit',
        },
      }),
    });
    await plugin.setLocale('fr');
    const Root = defineComponent({
      setup() {
        return () =>
          h(
            T,
            { _hash: 'link' },
            {
              default: () =>
                h(
                  Link,
                  {
                    class: 'source-link',
                    id: 'docs-link',
                    onNavigate,
                    title: 'Source title',
                    to: '/docs',
                  },
                  { default: () => 'Source link' }
                ),
            }
          );
      },
    });

    const mounted = mount(Root, plugin);
    await nextTick();

    const anchor = findElement(mounted.root, 'a');
    expect(anchor?.props).toMatchObject({
      class: 'source-link',
      href: '/docs',
      id: 'docs-link',
      title: 'Titre traduit',
    });
    expect(textContent(mounted.root)).toBe('Lien traduit');
    const onClick = anchor?.props.onClick;
    expect(onClick).toBeTypeOf('function');
    (onClick as () => void)();
    expect(onNavigate).toHaveBeenCalledTimes(1);
    mounted.app.unmount();
  });

  it('updates multi-root rich children from arrays to scalar text on the client', async () => {
    const source: JsxChildren = [
      {
        t: 'h1',
        i: 1,
        c: ['Hello, ', { i: 2, k: '_gt_value_2', v: 'v' }, '!'],
      },
      { t: 'p', i: 3, c: 'Source paragraph.' },
    ];
    const target: JsxChildren = [
      {
        t: 'h1',
        i: 1,
        c: ['Bonjour, ', { i: 2, k: '_gt_value_2', v: 'v' }, ' !'],
      },
      { t: 'p', i: 3, c: 'Paragraphe traduit.' },
    ];
    const plugin = createGT({
      loadTranslations: async (locale) =>
        locale === 'fr' ? { [jsxHash(source)]: target } : {},
    });
    const Root = defineComponent({
      setup() {
        return () =>
          h(T, null, {
            default: () => [
              h('h1', null, [
                'Hello, ',
                h(Var, null, { default: () => 'Ada' }),
                '!',
              ]),
              h('p', null, 'Source paragraph.'),
            ],
          });
      },
    });
    const mounted = mount(Root, plugin);

    expect(textContent(mounted.root)).toBe('Hello, Ada!Source paragraph.');

    await plugin.setLocale('fr');
    await nextTick();

    expect(textContent(mounted.root)).toBe('Bonjour, Ada !Paragraphe traduit.');
    mounted.app.unmount();
  });

  it('coalesces text around comments and fragments for stable rich hashes', async () => {
    const source = 'Hello world';
    const plugin = createGT({
      loadTranslations: async () => ({
        [jsxHash(source)]: 'Bonjour le monde',
      }),
    });
    await plugin.setLocale('fr');
    const Root = defineComponent({
      setup() {
        return () =>
          h(T, null, {
            default: () =>
              h(Fragment, null, [
                'Hello',
                createCommentVNode('translator note'),
                ' world',
              ]),
          });
      },
    });

    expect(
      stripFragmentMarkers(await renderWithPlugin(Root, plugin))
    ).toContain('Bonjour le monde');
  });

  it('numbers variables independently within every plural and branch slot', async () => {
    const pluralSource: JsxChildren = {
      t: 'Plural',
      i: 1,
      d: {
        b: {
          one: ['one ', { i: 2, k: '_gt_value_2', v: 'v' }],
          other: ['other ', { i: 2, k: '_gt_value_2', v: 'v' }],
        },
        t: 'p',
      },
      c: ['fallback ', { i: 2, k: '_gt_value_2', v: 'v' }],
    };
    const branchSource: JsxChildren = {
      t: 'Branch',
      i: 3,
      d: {
        b: {
          formal: ['formal ', { i: 4, k: '_gt_value_4', v: 'v' }],
          casual: ['casual ', { i: 4, k: '_gt_value_4', v: 'v' }],
        },
        t: 'b',
      },
      c: ['fallback ', { i: 4, k: '_gt_value_4', v: 'v' }],
    };
    const source: JsxChildren = [pluralSource, ' / ', branchSource];
    const target: JsxChildren = [
      {
        ...pluralSource,
        d: {
          b: {
            one: ['un ', { i: 2, k: '_gt_value_2', v: 'v' }],
            other: ['plusieurs ', { i: 2, k: '_gt_value_2', v: 'v' }],
          },
          t: 'p',
        },
      },
      ' / ',
      {
        ...branchSource,
        d: {
          b: {
            formal: ['bonjour ', { i: 4, k: '_gt_value_4', v: 'v' }],
            casual: ['salut ', { i: 4, k: '_gt_value_4', v: 'v' }],
          },
          t: 'b',
        },
      },
    ];
    const plugin = createGT({
      loadTranslations: async () => ({ [jsxHash(source)]: target }),
    });
    await plugin.setLocale('fr');
    const Root = defineComponent({
      setup() {
        return () =>
          h(T, null, {
            default: () => [
              h(
                Plural,
                { n: 1 },
                {
                  default: () => [
                    'fallback ',
                    h(Var, null, { default: () => 'article' }),
                  ],
                  one: () => [
                    'one ',
                    h(Var, null, { default: () => 'article' }),
                  ],
                  other: () => [
                    'other ',
                    h(Var, null, { default: () => 'articles' }),
                  ],
                }
              ),
              ' / ',
              h(
                Branch,
                { branch: 'formal' },
                {
                  default: () => [
                    'fallback ',
                    h(Var, null, { default: () => 'Ada' }),
                  ],
                  formal: () => [
                    'formal ',
                    h(Var, null, { default: () => 'Ada' }),
                  ],
                  casual: () => [
                    'casual ',
                    h(Var, null, { default: () => 'Ada' }),
                  ],
                }
              ),
            ],
          });
      },
    });

    expect(
      stripFragmentMarkers(await renderWithPlugin(Root, plugin))
    ).toContain('un article / bonjour Ada');
  });

  it('ignores Vue-reserved VNode props when hashing rich branches', async () => {
    const source: JsxChildren = {
      t: 'Branch',
      i: 1,
      d: { b: { formal: 'Hello' }, t: 'b' },
      c: 'Fallback',
    };
    const target: JsxChildren = {
      t: 'Branch',
      i: 1,
      d: { b: { formal: 'Bonjour' }, t: 'b' },
      c: 'Repli',
    };
    const plugin = createGT({
      loadTranslations: async () => ({ [jsxHash(source)]: target }),
    });
    await plugin.setLocale('fr');
    const Root = defineComponent({
      setup() {
        return () =>
          h(T, null, {
            default: () =>
              h(
                Branch,
                {
                  branch: 'formal',
                  key: 'stable',
                  onVnodeMounted: () => undefined,
                  ref: () => undefined,
                  ref_for: true,
                  ref_key: 'greeting',
                },
                {
                  default: () => 'Fallback',
                  formal: () => 'Hello',
                }
              ),
          });
      },
    });

    expect(await renderWithPlugin(Root, plugin)).toContain('Bonjour');
  });

  it('formats slot children and renders standalone branch components', async () => {
    const plugin = createGT();
    const Root = defineComponent({
      setup() {
        return () =>
          h('div', [
            h(Num, { locales: ['en-US'] }, { default: () => '1234.5' }),
            '|',
            h(
              Currency,
              { currency: 'USD', locales: ['en-US'] },
              { default: () => '12' }
            ),
            '|',
            h(
              DateTime,
              {
                locales: ['en-US'],
                options: { timeZone: 'UTC', year: 'numeric' },
              },
              { default: () => '2024-01-01T00:00:00.000Z' }
            ),
            '|',
            h(
              Plural,
              { n: 2, other: 'items' },
              { one: () => 'item', default: () => 'fallback' }
            ),
            '|',
            h(
              Branch,
              { branch: 'formal', formal: 'Welcome' },
              { default: () => 'Hi' }
            ),
          ]);
      },
    });
    const html = await renderWithPlugin(Root, plugin);

    expect(html).toContain('1,234.5|$12.00|2024|items|Welcome');
  });

  it('falls back safely for inherited object-property branch names', async () => {
    const plugin = createGT();
    const Root = defineComponent({
      setup() {
        return () =>
          h('div', [
            h(
              Branch,
              { branch: 'toString' },
              { default: () => 'Standalone fallback' }
            ),
            '|',
            h(
              Branch,
              { branch: 'missing', missing: undefined },
              { default: () => 'Undefined fallback' }
            ),
            '|',
            h(T, null, {
              default: () =>
                h(
                  Branch,
                  { branch: 'constructor' },
                  { default: () => 'Rich fallback' }
                ),
            }),
          ]);
      },
    });

    expect(
      stripFragmentMarkers(await renderWithPlugin(Root, plugin))
    ).toContain('Standalone fallback|Undefined fallback|Rich fallback');
  });

  it('preserves Vue directives while replacing rich children', async () => {
    const plugin = createGT();
    const Root = defineComponent({
      setup() {
        return () =>
          h(T, null, {
            default: () =>
              withDirectives(h('p', null, 'Hidden'), [[vShow, false]]),
          });
      },
    });

    expect(await renderWithPlugin(Root, plugin)).toContain(
      '<p style="display:none;">Hidden</p>'
    );
  });

  it('applies translated content props to leaf elements', async () => {
    const plugin = createGT({
      loadTranslations: async () => ({
        image: { t: 'img', i: 1, d: { alt: 'Portrait traduit' } },
      }),
    });
    await plugin.setLocale('fr');
    const Root = defineComponent({
      setup() {
        return () =>
          h(
            T,
            { _hash: 'image' },
            {
              default: () => h('img', { alt: 'Source portrait' }),
            }
          );
      },
    });

    const html = await renderWithPlugin(Root, plugin);
    expect(html).toContain('alt="Portrait traduit"');
    expect(html).not.toContain('alt="Source portrait"');
  });

  it('uses the default locale for untranslated rich source fallbacks', async () => {
    const plugin = createGT({
      defaultLocale: 'en-US',
      loadTranslations: async () => ({}),
    });
    await plugin.setLocale('fr-FR');
    const Root = defineComponent({
      setup() {
        return () =>
          h(T, null, {
            default: () => [
              h(
                Plural,
                { n: 0 },
                {
                  one: () => 'one',
                  other: () => 'other',
                }
              ),
              '|',
              h(Num, null, { default: () => '1234.5' }),
            ],
          });
      },
    });

    expect(
      stripFragmentMarkers(await renderWithPlugin(Root, plugin))
    ).toContain('other|1,234.5');
  });

  it('requires explicit preloading for an asynchronous SSR locale', async () => {
    const source = 'Hello';
    let resolveCatalog!: (catalog: TranslationCatalog) => void;
    const plugin = createGT({
      locale: 'fr',
      loadTranslations: () =>
        new Promise((resolve) => {
          resolveCatalog = resolve;
        }),
    });
    const Root = defineComponent({
      setup() {
        const gt = useGT();
        return () => h('p', gt(source));
      },
    });

    const initialRender = renderWithPlugin(Root, plugin);
    expect(await initialRender).toContain('Hello');

    const preload = plugin.loadTranslations('fr');
    resolveCatalog({ [stringHash(source)]: 'Bonjour' });
    await preload;

    expect(await renderWithPlugin(Root, plugin)).toContain('Bonjour');
  });

  it('keeps app caches isolated during concurrent SSR', async () => {
    const source = 'Hello';
    const french = createGT({
      loadTranslations: async () => ({ [stringHash(source)]: 'Bonjour' }),
    });
    const chinese = createGT({
      loadTranslations: async () => ({ [stringHash(source)]: '你好' }),
    });
    await Promise.all([french.setLocale('fr'), chinese.setLocale('zh')]);
    const Root = defineComponent({
      setup() {
        const gt = useGT();
        return () => h('p', gt(source));
      },
    });

    const [fr, zh] = await Promise.all([
      renderWithPlugin(Root, french),
      renderWithPlugin(Root, chinese),
    ]);
    expect(fr).toContain('Bonjour');
    expect(zh).toContain('你好');
  });

  it('applies only the latest concurrent locale request', async () => {
    const resolvers = new Map<string, (catalog: TranslationCatalog) => void>();
    const plugin = createGT({
      loadTranslations: (locale) =>
        new Promise((resolve) => resolvers.set(locale, resolve)),
    });
    const Root = defineComponent({
      setup() {
        const locale = useLocale();
        return () => h('p', locale.value);
      },
    });
    const mounted = mount(Root, plugin);
    const french = plugin.setLocale('fr');
    const chinese = plugin.setLocale('zh');

    await vi.waitFor(() => expect(resolvers.size).toBe(2));
    resolvers.get('zh')?.({});
    await chinese;
    resolvers.get('fr')?.({});
    await french;
    await nextTick();

    expect(textContent(mounted.root)).toBe('zh');
    mounted.app.unmount();
  });
});

function stringHash(source: string, context?: string): string {
  return hashSource({ source, context, dataFormat: 'STRING' });
}

function jsxHash(source: JsxChildren, context?: string): string {
  return hashSource({ source, context, dataFormat: 'JSX' });
}

function stripFragmentMarkers(html: string): string {
  return html.replaceAll('<!--[-->', '').replaceAll('<!--]-->', '');
}

async function renderWithPlugin(
  root: ReturnType<typeof defineComponent>,
  plugin: ReturnType<typeof createGT>
): Promise<string> {
  const app = createSSRApp(root);
  app.use(plugin);
  return renderToString(app);
}

type HostNode = {
  children: HostNode[];
  parent?: HostNode;
  props: Record<string, unknown>;
  text?: string;
  type: string;
};

const renderer = createRenderer<HostNode, HostNode>({
  createComment: (text) => createHostNode('#comment', text),
  createElement: (type) => createHostNode(type),
  createText: (text) => createHostNode('#text', text),
  insert(child, parent, anchor) {
    child.parent = parent;
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    if (index < 0) parent.children.push(child);
    else parent.children.splice(index, 0, child);
  },
  nextSibling(node) {
    if (!node.parent) return null;
    const index = node.parent.children.indexOf(node);
    return node.parent.children[index + 1] ?? null;
  },
  parentNode: (node) => node.parent ?? null,
  patchProp(element, key, _previous, value) {
    element.props[key] = value;
  },
  remove(child) {
    if (!child.parent) return;
    const index = child.parent.children.indexOf(child);
    if (index >= 0) child.parent.children.splice(index, 1);
  },
  setElementText(element, text) {
    const child = createHostNode('#text', text);
    child.parent = element;
    element.children = [child];
  },
  setText(node, text) {
    node.text = text;
  },
});

function createHostNode(type: string, text?: string): HostNode {
  return { children: [], props: {}, text, type };
}

function mount(
  rootComponent: ReturnType<typeof defineComponent>,
  plugin: ReturnType<typeof createGT>
) {
  const root = createHostNode('root');
  const app = renderer.createApp(rootComponent);
  app.use(plugin);
  app.mount(root);
  return { app, root };
}

function textContent(node: HostNode): string {
  return node.text ?? node.children.map(textContent).join('');
}

function findElement(node: HostNode, type: string): HostNode | undefined {
  if (node.type === type) return node;
  return node.children.map((child) => findElement(child, type)).find(Boolean);
}
