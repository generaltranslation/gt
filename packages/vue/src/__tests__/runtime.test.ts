import type { JsxChildren } from 'generaltranslation/types';
import { hashSource } from 'generaltranslation/id';
import * as Vue from 'vue';
import {
  Fragment,
  Suspense,
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
import { compileTemplate } from 'vue/compiler-sfc';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it, vi } from 'vitest';
import { getBranchNames } from '../components/utils';
import { translateVueChildren } from '../rendering/translateVueChildren';
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

  it('renders the default locale before serializing or reading a catalog', () => {
    const source = h('span');
    Object.defineProperty(source, 'props', {
      value: new Proxy(Object.create(null) as object, {
        get(_target, property) {
          if (
            property === 'key' ||
            property === 'ref' ||
            property === 'ref_for' ||
            property === 'ref_key'
          ) {
            return undefined;
          }
          throw new Error('default-locale source was serialized');
        },
      }),
    });
    const state = {
      defaultLocale: 'en',
      getCatalog: vi.fn(() => {
        throw new Error('default-locale catalog was read');
      }),
      locale: ref('en'),
    } as unknown as Parameters<typeof translateVueChildren>[1];

    const rendered = translateVueChildren([source], state, {});
    expect(Array.isArray(rendered) && rendered[0]).toMatchObject({
      type: 'span',
    });
    expect(state.getCatalog).not.toHaveBeenCalled();
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

  it('prefers the documented context prop over the internal $context alias', async () => {
    const source: JsxChildren = { t: 'p', i: 1, c: 'Hello' };
    const plugin = createGT({
      loadTranslations: async () => ({
        [jsxHash(source, 'friendly')]: { t: 'p', i: 1, c: 'Friendly' },
        [jsxHash(source, 'formal')]: { t: 'p', i: 1, c: 'Formal' },
      }),
    });
    await plugin.setLocale('fr');
    const Root = defineComponent({
      setup() {
        return () =>
          h(
            T,
            { $context: 'formal', context: 'friendly' },
            { default: () => h('p', 'Hello') }
          );
      },
    });

    const html = await renderWithPlugin(Root, plugin);

    expect(html).toContain('<p>Friendly</p>');
    expect(html).not.toContain('Formal');
  });

  it('translates supported component props while preserving opaque slots', async () => {
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
    expect(textContent(mounted.root)).toBe('Source link');
    const onClick = anchor?.props.onClick;
    expect(onClick).toBeTypeOf('function');
    (onClick as () => void)();
    expect(onNavigate).toHaveBeenCalledTimes(1);
    mounted.app.unmount();
  });

  it('keeps Vue-compiled scoped slots opaque and supplies real props in SSR', async () => {
    const ScopedCard = defineComponent({
      name: 'ScopedCard',
      setup(_props, { slots }) {
        return () => h('article', slots.default?.({ label: 'Runtime label' }));
      },
    });
    const plugin = createGT({
      loadTranslations: async () => ({
        scoped: {
          t: 'ScopedCard',
          i: 1,
          c: 'A translated replacement must not consume a scoped slot',
        },
      }),
    });
    await plugin.setLocale('fr');
    const Root = defineComponent({
      components: { Card: ScopedCard, T },
      render: compileSfcTemplate(
        '<T _hash="scoped"><Card v-slot="{ label }"><span>{{ label }}</span></Card></T>'
      ),
    });

    const html = await renderWithPlugin(Root, plugin);

    expect(html).toContain('<article><span>Runtime label</span></article>');
    expect(html).not.toContain('translated replacement');
  });

  it('never probes direct, ignored, or forwarded custom component slots', async () => {
    const directCalls = vi.fn();
    const ignoredCalls = vi.fn();
    const forwardedCalls = vi.fn();
    const scope = { label: 'Runtime label' };
    const DeferredReader = defineComponent({
      name: 'DeferredReader',
      props: { payload: { required: true, type: Object } },
      setup(props) {
        return () => h('span', String(props.payload.label));
      },
    });
    const DirectOwner = defineComponent({
      name: 'DirectOwner',
      setup(_props, { slots }) {
        return () => h('section', slots.default?.(scope));
      },
    });
    const IgnoredOwner = defineComponent({
      name: 'IgnoredOwner',
      setup() {
        return () => h('aside', 'Ignored safely');
      },
    });
    const ForwardingOwner = defineComponent({
      name: 'ForwardingOwner',
      setup(_props, { slots }) {
        return () => h('div', slots.default?.(scope));
      },
    });
    const plugin = createGT({
      loadTranslations: async () => ({
        opaqueSlots: [
          { t: 'DirectOwner', i: 1, c: 'Wrong direct replacement' },
          { t: 'IgnoredOwner', i: 2, c: 'Wrong ignored replacement' },
          { t: 'ForwardingOwner', i: 3, c: 'Wrong forwarded replacement' },
        ],
      }),
    });
    await plugin.setLocale('fr');
    const Root = defineComponent({
      setup() {
        return () =>
          h(
            T,
            { _hash: 'opaqueSlots' },
            {
              default: () => [
                h(DirectOwner, null, {
                  default: (slotScope: typeof scope) => {
                    directCalls(slotScope);
                    return slotScope === scope
                      ? 'Exact scope object'
                      : 'Synthetic scope object';
                  },
                }),
                h(IgnoredOwner, null, {
                  default: () => {
                    ignoredCalls();
                    return 'Never rendered';
                  },
                }),
                h(ForwardingOwner, null, {
                  default: (slotScope: typeof scope) => {
                    forwardedCalls(slotScope);
                    return h(DeferredReader, { payload: slotScope });
                  },
                }),
              ],
            }
          );
      },
    });

    const html = await renderWithPlugin(Root, plugin);

    expect(html).toContain('Exact scope object');
    expect(html).toContain('Ignored safely');
    expect(html).toContain('Runtime label');
    expect(html).not.toContain('Wrong');
    expect(directCalls).toHaveBeenCalledOnce();
    expect(directCalls).toHaveBeenCalledWith(scope);
    expect(ignoredCalls).not.toHaveBeenCalled();
    expect(forwardedCalls).toHaveBeenCalledOnce();
    expect(forwardedCalls).toHaveBeenCalledWith(scope);
  });

  it('preserves arbitrary scoped named slots without invoking them', async () => {
    const ScopedBranch = defineComponent({
      name: 'ScopedBranch',
      setup(_props, { slots }) {
        return () => slots.one?.({ label: 'Runtime label' });
      },
    });
    const plugin = createGT({
      loadTranslations: async () => ({
        scopedBranch: {
          t: 'ScopedBranch',
          i: 1,
          c: 'Translated replacement',
        },
      }),
    });
    await plugin.setLocale('fr');
    const Root = defineComponent({
      components: { ScopedBranch, T },
      render: compileSfcTemplate(
        '<T _hash="scopedBranch"><ScopedBranch><template #one="{ label }"><span>{{ label }}</span></template></ScopedBranch></T>'
      ),
    });

    const html = await renderWithPlugin(Root, plugin);

    expect(html).toContain('<span>Runtime label</span>');
    expect(html).not.toContain('Translated replacement');
  });

  it('reuses explicit source element IDs repeated by a translation', async () => {
    const target: JsxChildren = [
      { t: 'a', i: 1, c: 'Premier' },
      { t: 'a', i: 1, c: 'Encore' },
    ];
    const plugin = createGT({
      loadTranslations: async () => ({ repeated: target }),
    });
    await plugin.setLocale('fr');
    const Root = defineComponent({
      setup() {
        return () =>
          h(
            T,
            { _hash: 'repeated' },
            {
              default: () => [
                h('a', null, 'First'),
                h('strong', null, 'Second'),
              ],
            }
          );
      },
    });

    const html = stripFragmentMarkers(await renderWithPlugin(Root, plugin));

    expect(html).toContain('<a>Premier</a><a>Encore</a>');
    expect(html).not.toContain('<strong>');
  });

  it('keeps stateful component identity through translated reorder and repetition', async () => {
    let setupCount = 0;
    const Stateful = defineComponent({
      name: 'Stateful',
      props: { label: { required: true, type: String } },
      setup(props) {
        const initialLabel = props.label;
        const instance = ++setupCount;
        return () => h('span', `${props.label}:${initialLabel}:${instance}|`);
      },
    });
    const plugin = createGT({
      loadTranslations: async (locale) => ({
        identity:
          locale === 'fr'
            ? [
                { t: 'Stateful', i: 2 },
                { t: 'Stateful', i: 1 },
              ]
            : [
                { t: 'Stateful', i: 1 },
                { t: 'Stateful', i: 1 },
                { t: 'Stateful', i: 2 },
              ],
      }),
    });
    const Root = defineComponent({
      setup() {
        return () =>
          h(
            T,
            { _hash: 'identity' },
            {
              default: () => [
                h(Stateful, { label: 'a' }),
                h(Stateful, { label: 'b' }),
              ],
            }
          );
      },
    });
    const mounted = mount(Root, plugin);

    expect(textContent(mounted.root)).toBe('a:a:1|b:b:2|');
    await plugin.setLocale('fr');
    await nextTick();
    expect(textContent(mounted.root)).toBe('b:b:2|a:a:1|');
    expect(setupCount).toBe(2);

    await plugin.setLocale('de');
    await nextTick();
    expect(textContent(mounted.root)).toBe('a:a:1|a:a:3|b:b:2|');
    expect(setupCount).toBe(3);

    await plugin.setLocale('fr');
    await nextTick();
    expect(textContent(mounted.root)).toBe('b:b:2|a:a:1|');

    await plugin.setLocale('en');
    await nextTick();
    expect(textContent(mounted.root)).toBe('a:a:1|b:b:2|');
    mounted.app.unmount();
  });

  it('preserves explicit string, number, and symbol keys during translation reorder', async () => {
    let setupCount = 0;
    const symbolKey = Symbol('source-key');
    const Stateful = defineComponent({
      name: 'ExplicitlyKeyedStateful',
      props: { label: { required: true, type: String } },
      setup(props) {
        const instance = ++setupCount;
        return () => h('span', `${props.label}:${instance}|`);
      },
    });
    const plugin = createGT({
      loadTranslations: async () => ({
        explicitKeys: [
          { t: 'Stateful', i: 3 },
          { t: 'Stateful', i: 1 },
          { t: 'Stateful', i: 2 },
        ],
      }),
    });
    const Root = defineComponent({
      setup() {
        return () =>
          h(
            T,
            { _hash: 'explicitKeys' },
            {
              default: () => [
                h(Stateful, { key: 'alpha', label: 'a' }),
                h(Stateful, { key: 2, label: 'b' }),
                h(Stateful, { key: symbolKey, label: 'c' }),
              ],
            }
          );
      },
    });
    const mounted = mount(Root, plugin);

    expect(textContent(mounted.root)).toBe('a:1|b:2|c:3|');
    await plugin.setLocale('fr');
    await nextTick();
    expect(textContent(mounted.root)).toBe('c:3|a:1|b:2|');
    expect(setupCount).toBe(3);
    mounted.app.unmount();
  });

  it('preserves keys on GT transformations that render fragment children', async () => {
    let setupCount = 0;
    const order = ref(['a', 'b']);
    const Stateful = defineComponent({
      name: 'KeyedBranchStateful',
      props: { label: { required: true, type: String } },
      setup(props) {
        const initialLabel = props.label;
        const instance = ++setupCount;
        return () => h('span', `${props.label}:${initialLabel}:${instance}|`);
      },
    });
    const plugin = createGT();
    const Root = defineComponent({
      setup() {
        return () =>
          h(T, null, {
            default: () =>
              order.value.map((label) =>
                h(
                  Branch,
                  { key: label, branch: 'show' },
                  { show: () => h(Stateful, { label }) }
                )
              ),
          });
      },
    });
    const mounted = mount(Root, plugin);

    expect(textContent(mounted.root)).toBe('a:a:1|b:b:2|');
    order.value = ['b', 'a'];
    await nextTick();
    expect(textContent(mounted.root)).toBe('b:b:2|a:a:1|');
    expect(setupCount).toBe(2);
    mounted.app.unmount();
  });

  it('anchors descendant identity to keyed native containers', async () => {
    let setupCount = 0;
    const order = ref(['a', 'b']);
    const Stateful = defineComponent({
      name: 'KeyedContainerStateful',
      props: { label: { required: true, type: String } },
      setup(props) {
        const initialLabel = props.label;
        const instance = ++setupCount;
        return () => h('span', `${props.label}:${initialLabel}:${instance}|`);
      },
    });
    const plugin = createGT();
    const Root = defineComponent({
      setup() {
        return () =>
          h(T, null, {
            default: () =>
              order.value.map((label) =>
                h('section', { key: label }, [h(Stateful, { label })])
              ),
          });
      },
    });
    const mounted = mount(Root, plugin);

    expect(textContent(mounted.root)).toBe('a:a:1|b:b:2|');
    order.value = ['b', 'a'];
    await nextTick();
    expect(textContent(mounted.root)).toBe('b:b:2|a:a:1|');
    expect(setupCount).toBe(2);
    mounted.app.unmount();
  });

  it('does not let keyed siblings shift unkeyed component identity', async () => {
    let setupCount = 0;
    const showKeyedSibling = ref(true);
    const Stateful = defineComponent({
      name: 'UnkeyedSiblingStateful',
      setup() {
        const instance = ++setupCount;
        return () => h('span', `${instance}|`);
      },
    });
    const plugin = createGT();
    const Root = defineComponent({
      setup() {
        return () =>
          h(T, null, {
            default: () => [
              ...(showKeyedSibling.value
                ? [h('i', { key: 'fixed' }, 'keyed')]
                : []),
              h(Stateful),
            ],
          });
      },
    });
    const mounted = mount(Root, plugin);

    expect(textContent(mounted.root)).toBe('keyed1|');
    showKeyedSibling.value = false;
    await nextTick();
    expect(textContent(mounted.root)).toBe('1|');
    expect(setupCount).toBe(1);
    mounted.app.unmount();
  });

  it('matches unkeyed components by VNode type across unrelated siblings', async () => {
    let setupCount = 0;
    const showUnrelatedSibling = ref(true);
    const Stateful = defineComponent({
      name: 'TypeMatchedStateful',
      setup() {
        const instance = ++setupCount;
        return () => h('span', `${instance}|`);
      },
    });
    const plugin = createGT();
    const Root = defineComponent({
      setup() {
        return () =>
          h(T, null, {
            default: () => [
              ...(showUnrelatedSibling.value ? [h('i', 'unrelated')] : []),
              h(Stateful),
            ],
          });
      },
    });
    const mounted = mount(Root, plugin);

    expect(textContent(mounted.root)).toBe('unrelated1|');
    showUnrelatedSibling.value = false;
    await nextTick();
    expect(textContent(mounted.root)).toBe('1|');
    expect(setupCount).toBe(1);
    mounted.app.unmount();
  });

  it('retains keyed Fragment scopes while keeping their wire shape flat', async () => {
    let setupCount = 0;
    const order = ref(['a', 'b']);
    const Stateful = defineComponent({
      name: 'KeyedFragmentStateful',
      props: { label: { required: true, type: String } },
      setup(props) {
        const initialLabel = props.label;
        const instance = ++setupCount;
        return () => h('span', `${props.label}:${initialLabel}:${instance}|`);
      },
    });
    const plugin = createGT();
    const Root = defineComponent({
      setup() {
        return () =>
          h(T, null, {
            default: () =>
              order.value.map((label) =>
                h(Fragment, { key: label }, [
                  h(Stateful, { key: 'shared-child-key', label }),
                  h('i', `${label}!`),
                ])
              ),
          });
      },
    });
    const mounted = mount(Root, plugin);

    expect(textContent(mounted.root)).toBe('a:a:1|a!b:b:2|b!');
    order.value = ['b', 'a'];
    await nextTick();
    expect(textContent(mounted.root)).toBe('b:b:2|b!a:a:1|a!');
    expect(setupCount).toBe(2);
    mounted.app.unmount();
  });

  it('keeps Branch and Plural descendants isolated by named slot', async () => {
    let setupCount = 0;
    const branch = ref('formal');
    const n = ref(1);
    const Stateful = defineComponent({
      name: 'BranchStateful',
      props: { label: { required: true, type: String } },
      setup(props) {
        const initialLabel = props.label;
        const instance = ++setupCount;
        return () => h('span', `${props.label}:${initialLabel}:${instance}|`);
      },
    });
    const plugin = createGT();
    const Root = defineComponent({
      setup() {
        return () =>
          h(T, null, {
            default: () => [
              h(
                Branch,
                { branch: branch.value },
                {
                  casual: () => h(Stateful, { label: 'casual' }),
                  formal: () => h(Stateful, { label: 'formal' }),
                }
              ),
              h(
                Plural,
                { n: n.value },
                {
                  one: () => h(Stateful, { label: 'one' }),
                  other: () => h(Stateful, { label: 'other' }),
                }
              ),
            ],
          });
      },
    });
    const mounted = mount(Root, plugin);

    expect(textContent(mounted.root)).toBe('formal:formal:1|one:one:2|');
    branch.value = 'casual';
    n.value = 2;
    await nextTick();
    expect(textContent(mounted.root)).toBe('casual:casual:3|other:other:4|');
    expect(setupCount).toBe(4);
    mounted.app.unmount();
  });

  it('rebuilds Suspense content instead of retaining stale normalized children', async () => {
    const fallbackCalls = vi.fn();
    const plugin = createGT({
      loadTranslations: async () => ({
        suspense: {
          t: 'Suspense',
          i: 1,
          c: { t: 'span', i: 2, c: 'TARGET' },
        },
      }),
    });
    const Root = defineComponent({
      setup() {
        return () =>
          h(
            T,
            { _hash: 'suspense' },
            {
              default: () =>
                h(Suspense, null, {
                  default: () => h('span', 'SOURCE'),
                  fallback: () => {
                    fallbackCalls();
                    return h('span', 'FALLBACK');
                  },
                }),
            }
          );
      },
    });

    const sourceHtml = stripFragmentMarkers(
      await renderWithPlugin(Root, plugin)
    );
    expect(sourceHtml).toContain('<span>SOURCE</span>');
    expect(fallbackCalls).toHaveBeenCalledTimes(1);

    await plugin.setLocale('fr');
    const targetHtml = stripFragmentMarkers(
      await renderWithPlugin(Root, plugin)
    );

    expect(targetHtml).toContain('<span>TARGET</span>');
    expect(targetHtml).not.toContain('SOURCE');
    expect(fallbackCalls).toHaveBeenCalledTimes(2);
  });

  it('renders Vue-compiled text-only Suspense source content in SSR', async () => {
    const plugin = createGT({ loadTranslations: async () => ({}) });
    const Root = defineComponent({
      components: { T },
      render: compileSfcTemplate('<T><Suspense>Hello world</Suspense></T>'),
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      const defaultHtml = stripFragmentMarkers(
        await renderWithPlugin(Root, plugin)
      );
      expect(defaultHtml).toContain('Hello world');

      await plugin.setLocale('fr');
      const fallbackHtml = stripFragmentMarkers(
        await renderWithPlugin(Root, plugin)
      );
      expect(fallbackHtml).toContain('Hello world');
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('renders translated text-only Suspense content in SSR', async () => {
    const plugin = createGT({
      loadTranslations: async () => ({
        textSuspense: {
          t: 'Suspense',
          i: 1,
          c: ['Bonjour le monde'],
        },
      }),
    });
    await plugin.setLocale('fr');
    const Root = defineComponent({
      components: { T },
      render: compileSfcTemplate(
        '<T _hash="textSuspense"><Suspense>Hello world</Suspense></T>'
      ),
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      const html = stripFragmentMarkers(await renderWithPlugin(Root, plugin));
      expect(html).toContain('Bonjour le monde');
      expect(html).not.toContain('Hello world');
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('updates Vue-compiled text-only Suspense content on the client', async () => {
    const plugin = createGT({
      loadTranslations: async () => ({
        textSuspense: {
          t: 'Suspense',
          i: 1,
          c: ['Bonjour le monde'],
        },
      }),
    });
    const Root = defineComponent({
      components: { T },
      render: compileSfcTemplate(
        '<T _hash="textSuspense"><Suspense>Hello world</Suspense></T>'
      ),
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const mounted = mount(Root, plugin);

    try {
      expect(textContent(mounted.root)).toBe('Hello world');

      await plugin.setLocale('fr');
      await nextTick();
      expect(textContent(mounted.root)).toBe('Bonjour le monde');

      await plugin.setLocale('en');
      await nextTick();
      expect(textContent(mounted.root)).toBe('Hello world');
      expect(warn).not.toHaveBeenCalled();
    } finally {
      mounted.app.unmount();
      warn.mockRestore();
    }
  });

  it('preserves Vue-compiled Fragment roots while rebuilding Suspense', async () => {
    const source: JsxChildren = {
      t: 'Suspense',
      i: 1,
      c: [
        { t: 'span', i: 2, c: 'A' },
        { t: 'span', i: 3, c: 'B' },
      ],
    };
    const plugin = createGT({
      loadTranslations: async () => ({
        [jsxHash(source)]: {
          t: 'Suspense',
          i: 1,
          c: [
            { t: 'span', i: 2, c: 'C' },
            { t: 'span', i: 3, c: 'D' },
          ],
        },
      }),
    });
    const Root = defineComponent({
      components: { T },
      render: compileSfcTemplate(
        '<T><Suspense><template v-if="true"><span>A</span><span>B</span></template></Suspense></T>'
      ),
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      const sourceHtml = stripFragmentMarkers(
        await renderWithPlugin(Root, plugin)
      );
      expect(sourceHtml).toContain('<span>A</span><span>B</span>');

      await plugin.setLocale('fr');
      const translatedHtml = stripFragmentMarkers(
        await renderWithPlugin(Root, plugin)
      );
      expect(translatedHtml).toContain('<span>C</span><span>D</span>');
      expect(translatedHtml).not.toContain('<span>A</span>');
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('rebuilds nested Suspense roots without rerunning fallback slots', async () => {
    const outerFallback = vi.fn(() => h('b', 'Outer fallback'));
    const innerFallback = vi.fn(() => h('i', 'Inner fallback'));
    const plugin = createGT({
      loadTranslations: async () => ({
        nestedSuspense: {
          t: 'Suspense',
          i: 1,
          c: {
            t: 'Suspense',
            i: 2,
            c: [
              { t: 'span', i: 3, c: 'C' },
              { t: 'span', i: 4, c: 'D' },
            ],
          },
        },
      }),
    });
    const Root = defineComponent({
      setup() {
        return () =>
          h(
            T,
            { _hash: 'nestedSuspense' },
            {
              default: () =>
                h(Suspense, null, {
                  default: () =>
                    h(Suspense, null, {
                      default: () =>
                        h(Fragment, null, [h('span', 'A'), h('span', 'B')]),
                      fallback: innerFallback,
                    }),
                  fallback: outerFallback,
                }),
            }
          );
      },
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      const sourceHtml = stripFragmentMarkers(
        await renderWithPlugin(Root, plugin)
      );
      expect(sourceHtml).toContain('<span>A</span><span>B</span>');
      expect(outerFallback).toHaveBeenCalledTimes(1);
      expect(innerFallback).toHaveBeenCalledTimes(1);

      await plugin.setLocale('fr');
      const translatedHtml = stripFragmentMarkers(
        await renderWithPlugin(Root, plugin)
      );
      expect(translatedHtml).toContain('<span>C</span><span>D</span>');
      expect(outerFallback).toHaveBeenCalledTimes(2);
      expect(innerFallback).toHaveBeenCalledTimes(2);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('renders repeated translated Suspense roots through a Fragment', async () => {
    const plugin = createGT({
      loadTranslations: async () => ({
        repeatedSuspense: {
          t: 'Suspense',
          i: 1,
          c: [
            { t: 'span', i: 2, c: 'Premier' },
            { t: 'span', i: 2, c: 'Deuxième' },
          ],
        },
      }),
    });
    await plugin.setLocale('fr');
    const Root = defineComponent({
      components: { T },
      render: compileSfcTemplate(
        '<T _hash="repeatedSuspense"><Suspense><span>Source</span></Suspense></T>'
      ),
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let mounted: ReturnType<typeof mount> | undefined;

    try {
      const html = stripFragmentMarkers(await renderWithPlugin(Root, plugin));
      expect(html).toContain('<span>Premier</span><span>Deuxième</span>');

      mounted = mount(Root, plugin);
      expect(textContent(mounted.root)).toBe('PremierDeuxième');
      await plugin.setLocale('en');
      await nextTick();
      expect(textContent(mounted.root)).toBe('Source');
      await plugin.setLocale('fr');
      await nextTick();
      expect(textContent(mounted.root)).toBe('PremierDeuxième');
      expect(warn).not.toHaveBeenCalled();
    } finally {
      mounted?.app.unmount();
      warn.mockRestore();
    }
  });

  it('preserves the first repeated Suspense root across locale transitions', async () => {
    let setupCount = 0;
    const Stateful = defineComponent({
      name: 'SuspenseStateful',
      props: { title: { required: true, type: String } },
      setup(props) {
        const instance = ++setupCount;
        return () => h('span', `${props.title}:${instance}|`);
      },
    });
    const plugin = createGT({
      loadTranslations: async () => ({
        statefulSuspense: {
          t: 'Suspense',
          i: 1,
          c: [
            { t: 'SuspenseStateful', i: 2, d: { ti: 'Premier' } },
            { t: 'SuspenseStateful', i: 2, d: { ti: 'Deuxième' } },
          ],
        },
      }),
    });
    const Root = defineComponent({
      setup() {
        return () =>
          h(
            T,
            { _hash: 'statefulSuspense' },
            {
              default: () =>
                h(Suspense, null, {
                  default: () => h(Stateful, { title: 'Source' }),
                }),
            }
          );
      },
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const mounted = mount(Root, plugin);

    try {
      expect(textContent(mounted.root)).toBe('Source:1|');
      await plugin.setLocale('fr');
      await nextTick();
      expect(textContent(mounted.root)).toBe('Premier:1|Deuxième:2|');
      await plugin.setLocale('en');
      await nextTick();
      expect(textContent(mounted.root)).toBe('Source:1|');
      expect(setupCount).toBe(2);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      mounted.app.unmount();
      warn.mockRestore();
    }
  });

  it('preserves an async Suspense fallback before rendering translated content', async () => {
    const fallbackCalls = vi.fn();
    let resolveGate!: () => void;
    const gate = new Promise<void>((resolve) => {
      resolveGate = resolve;
    });
    const AsyncGate = defineComponent({
      name: 'AsyncGate',
      async setup() {
        await gate;
        return () => h('i', 'READY');
      },
    });
    const plugin = createGT({
      loadTranslations: async () => ({
        asyncSuspense: {
          t: 'Suspense',
          i: 1,
          c: {
            t: 'div',
            i: 2,
            c: [
              { t: 'AsyncGate', i: 3 },
              { t: 'span', i: 4, c: 'TARGET' },
            ],
          },
        },
      }),
    });
    await plugin.setLocale('fr');
    const Root = defineComponent({
      setup() {
        return () =>
          h(
            T,
            { _hash: 'asyncSuspense' },
            {
              default: () =>
                h(Suspense, null, {
                  default: () => h('div', [h(AsyncGate), h('span', 'SOURCE')]),
                  fallback: () => {
                    fallbackCalls();
                    return h('span', 'FALLBACK');
                  },
                }),
            }
          );
      },
    });
    const mounted = mount(Root, plugin);

    expect(textContent(mounted.root)).toBe('FALLBACK');
    expect(fallbackCalls).toHaveBeenCalledOnce();
    resolveGate();
    await gate;
    await nextTick();
    await nextTick();
    expect(textContent(mounted.root)).toBe('READYTARGET');
    mounted.app.unmount();
  });

  it('selects source plural values with the source locale and target branches with the active locale', async () => {
    const variable = { i: 2, k: '_gt_value_2', v: 'v' } as const;
    const target: JsxChildren = {
      t: 'Plural',
      i: 1,
      d: {
        b: {
          one: ['Cible ', variable],
          other: ['Cibles ', variable],
        },
        t: 'p',
      },
    };
    const plugin = createGT({
      defaultLocale: 'en',
      loadTranslations: async () => ({ pluralLocale: target }),
    });
    await plugin.setLocale('fr');
    const Root = defineComponent({
      setup() {
        return () =>
          h(
            T,
            { _hash: 'pluralLocale' },
            {
              default: () =>
                h(
                  Plural,
                  { locales: ['en'], n: 0 },
                  {
                    one: () => h(Var, null, { default: () => 'ONE' }),
                    other: () => h(Var, null, { default: () => 'OTHER' }),
                  }
                ),
            }
          );
      },
    });

    const html = stripFragmentMarkers(await renderWithPlugin(Root, plugin));

    expect(html).toContain('Cible OTHER');
    expect(html).not.toContain('Cible ONE');
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

    expect(stripFragmentMarkers(html)).toContain(
      '1,234.5|$12.00|2024|items|Welcome'
    );
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

/** Compiles a template through the same SFC compiler used by Vue tooling. */
function compileSfcTemplate(template: string): ReturnType<typeof Vue.compile> {
  const result = compileTemplate({
    compilerOptions: { mode: 'function' },
    filename: 'ScopedSlotFixture.vue',
    id: 'scoped-slot-fixture',
    source: template,
  });
  expect(result.errors).toEqual([]);
  return new Function('Vue', result.code)(Vue) as ReturnType<
    typeof Vue.compile
  >;
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
    if (child.parent) {
      const previousIndex = child.parent.children.indexOf(child);
      if (previousIndex >= 0) child.parent.children.splice(previousIndex, 1);
    }
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
    child.parent = undefined;
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
  if (node.type === '#comment') return '';
  return node.text ?? node.children.map(textContent).join('');
}

function findElement(node: HostNode, type: string): HostNode | undefined {
  if (node.type === type) return node;
  return node.children.map((child) => findElement(child, type)).find(Boolean);
}
