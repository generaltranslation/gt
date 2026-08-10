import type { JsxChildren } from 'generaltranslation/types';
import { hashSource } from 'generaltranslation/id';
import {
  Branch as ReactBranch,
  Currency as ReactCurrency,
  DateTime as ReactDateTime,
  Num as ReactNum,
  Plural as ReactPlural,
  Var as ReactVar,
} from '@generaltranslation/react-core/components';
import { prepareT } from '@generaltranslation/react-core/components-rsc';
import { createElement, type ReactNode } from 'react';
import * as Vue from 'vue';
import {
  createSSRApp,
  defineComponent,
  h,
  type Component,
  type VNode,
} from 'vue';
import { compileTemplate } from 'vue/compiler-sfc';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import {
  Branch,
  Currency,
  DateTime,
  Num,
  Plural,
  T,
  Var,
  createGT,
} from '../index';
import { serializeVueChildren } from '../rendering/translateVueChildren';

type ContractFixture = {
  context?: string;
  name: string;
  react: () => ReactNode;
  vue: {
    components?: Record<string, Component>;
    setup?: () => Record<string, unknown>;
    template: string;
  };
};

function DocsLink({ children }: { children?: ReactNode }): ReactNode {
  return createElement('a', null, children);
}

function Callout({ children }: { children?: ReactNode }): ReactNode {
  return createElement('aside', null, children);
}

const VueDocsLink = defineComponent({
  name: 'DocsLink',
  props: {
    to: { required: true, type: String },
  },
  setup(props, { slots }) {
    return () => h('a', { href: props.to }, slots.default?.());
  },
});

const VueCallout = defineComponent({
  name: 'Callout',
  setup(_props, { slots }) {
    return () => h('aside', slots.default?.());
  },
});

const fixtures: ContractFixture[] = [
  {
    name: 'plain text',
    react: () => createElement('p', null, 'Hello, world!'),
    vue: { template: '<T><p>Hello, world!</p></T>' },
  },
  {
    name: 'nested intrinsic elements and exact text boundaries',
    react: () =>
      createElement(
        'p',
        null,
        'Read ',
        createElement('strong', null, 'the docs'),
        ' today.'
      ),
    vue: {
      template: '<T><p>Read <strong>the docs</strong> today.</p></T>',
    },
  },
  {
    name: 'text boundaries separated by a source comment',
    react: () => createElement('p', null, 'Before', 'After'),
    vue: {
      template: '<T><p>Before<!-- source boundary -->After</p></T>',
    },
  },
  {
    name: 'static custom-component children',
    react: () => createElement(DocsLink, { to: '/docs' }, 'Cannot access?'),
    vue: {
      components: { DocsLink: VueDocsLink },
      template: '<T><DocsLink to="/docs">Cannot access?</DocsLink></T>',
    },
  },
  {
    name: 'nested static custom-component content with a dynamic Var',
    react: () =>
      createElement(
        DocsLink,
        { to: '/docs' },
        createElement(
          'span',
          null,
          'Hello, ',
          createElement(ReactVar, null, 'Ada'),
          '!'
        )
      ),
    vue: {
      components: { DocsLink: VueDocsLink },
      setup: () => ({ name: 'Ada' }),
      template:
        '<T><DocsLink to="/docs"><span>Hello, <Var>{{ name }}</Var>!</span></DocsLink></T>',
    },
  },
  {
    name: 'nested custom components',
    react: () =>
      createElement(
        Callout,
        null,
        createElement(
          DocsLink,
          { to: '/docs' },
          'Read ',
          createElement('em', null, 'the guide')
        )
      ),
    vue: {
      components: { Callout: VueCallout, DocsLink: VueDocsLink },
      template:
        '<T><Callout><DocsLink to="/docs">Read <em>the guide</em></DocsLink></Callout></T>',
    },
  },
  {
    name: 'typed and untyped variables',
    react: () => [
      createElement(ReactVar, { key: 'var' }, 'Ada'),
      createElement(ReactNum, { key: 'num' }, 1234),
      createElement(ReactCurrency, { currency: 'USD', key: 'currency' }, 25),
      createElement(
        ReactDateTime,
        { key: 'date' },
        new Date('2025-01-01T00:00:00Z')
      ),
    ],
    vue: {
      setup: () => ({ date: new Date('2025-01-01T00:00:00Z'), name: 'Ada' }),
      template:
        '<T><Var>{{ name }}</Var><Num :value="1234"/><Currency currency="USD" :value="25"/><DateTime :value="date"/></T>',
    },
  },
  {
    name: 'Branch alternatives and fallback content',
    react: () =>
      createElement(
        ReactBranch,
        {
          branch: 'online',
          online: createElement('strong', null, 'Online'),
        },
        createElement('span', null, 'Unknown')
      ),
    vue: {
      template:
        '<T><Branch branch="online"><template #online><strong>Online</strong></template><span>Unknown</span></Branch></T>',
    },
  },
  {
    name: 'Plural alternatives and fallback content',
    react: () =>
      createElement(
        ReactPlural,
        {
          n: 2,
          one: createElement('span', null, 'One item'),
          other: createElement('span', null, 'Many items'),
        },
        createElement('span', null, 'Items')
      ),
    vue: {
      template:
        '<T><Plural :n="2"><template #one><span>One item</span></template><template #other><span>Many items</span></template><span>Items</span></Plural></T>',
    },
  },
  {
    name: 'custom components inside Branch alternatives',
    react: () =>
      createElement(
        ReactBranch,
        {
          branch: 'docs',
          docs: createElement(DocsLink, { to: '/docs' }, 'Read the docs'),
        },
        createElement('span', null, 'No destination')
      ),
    vue: {
      components: { DocsLink: VueDocsLink },
      template:
        '<T><Branch branch="docs"><template #docs><DocsLink to="/docs">Read the docs</DocsLink></template><span>No destination</span></Branch></T>',
    },
  },
  {
    name: 'Branch and Var inside a custom component',
    react: () =>
      createElement(
        Callout,
        null,
        createElement(
          ReactBranch,
          {
            branch: 'welcome',
            welcome: [
              'Welcome, ',
              createElement(ReactVar, { key: 'name' }, 'Ada'),
              '!',
            ],
          },
          'Welcome!'
        )
      ),
    vue: {
      components: { Callout: VueCallout },
      setup: () => ({ name: 'Ada' }),
      template:
        '<T><Callout><Branch branch="welcome"><template #welcome>Welcome, <Var>{{ name }}</Var>!</template>Welcome!</Branch></Callout></T>',
    },
  },
  {
    context: 'account navigation',
    name: 'static context',
    react: () => createElement('nav', null, 'Account'),
    vue: {
      template: '<T context="account navigation"><nav>Account</nav></T>',
    },
  },
];

describe('React-authoritative rich-content runtime contract', () => {
  for (const fixture of fixtures) {
    it(`matches React's semantic wire and hash for ${fixture.name}`, async () => {
      const reactWire = prepareReactWire(fixture);
      const vueWire = await prepareVueWire(fixture);

      expect(normalizeSemanticWire(vueWire)).toEqual(
        normalizeSemanticWire(reactWire)
      );
      expect(hashRichSource(vueWire, fixture.context)).toBe(
        hashRichSource(reactWire, fixture.context)
      );
    });
  }

  it('keeps Var values out of the wire and hash', async () => {
    const fixture = fixtures.find(
      ({ name }) =>
        name === 'nested static custom-component content with a dynamic Var'
    );
    expect(fixture).toBeDefined();

    const first = await prepareVueWire(fixture!);
    const second = await prepareVueWire({
      ...fixture!,
      react: () =>
        createElement(
          DocsLink,
          { to: '/docs' },
          createElement(
            'span',
            null,
            'Hello, ',
            createElement(ReactVar, null, 'Grace'),
            '!'
          )
        ),
      vue: { ...fixture!.vue, setup: () => ({ name: 'Grace' }) },
    });

    expect(second).toEqual(first);
    expect(hashRichSource(second)).toBe(hashRichSource(first));
  });

  it('renders React-keyed translations inside a custom component', async () => {
    const fixture = fixtures.find(
      ({ name }) => name === 'static custom-component children'
    );
    expect(fixture).toBeDefined();
    const reactWire = prepareReactWire(fixture!);
    const reactHash = hashRichSource(reactWire);
    const target: JsxChildren = {
      t: 'DocsLink',
      i: 1,
      c: 'Accéder à la documentation',
    };
    const plugin = createGT({
      locale: 'fr',
      loadTranslations: async () => ({ [reactHash]: target }),
    });
    await plugin.loadTranslations('fr');
    const Root = defineComponent({
      components: { DocsLink: VueDocsLink, T },
      render: compileVueTemplate(
        '<T><DocsLink to="/docs">Cannot access?</DocsLink></T>'
      ),
    });

    const html = await renderToString(createSSRApp(Root).use(plugin));

    expect(html).toContain('<a href="/docs">Accéder à la documentation</a>');
    expect(html).not.toContain('Cannot access?');
  });
});

function prepareReactWire(fixture: ContractFixture): JsxChildren {
  return prepareT({
    locale: 'en',
    params: fixture.context ? { context: fixture.context } : {},
    sourceChildren: fixture.react(),
  }).sourceJsxChildren;
}

async function prepareVueWire(fixture: ContractFixture): Promise<JsxChildren> {
  let sourceChildren: VNode[] | undefined;
  const ProbeT = defineComponent({
    name: 'T',
    setup(_props, { slots }) {
      return () => {
        sourceChildren = slots.default?.() ?? [];
        return null;
      };
    },
  });
  const Root = defineComponent({
    components: {
      Branch,
      Currency,
      DateTime,
      Num,
      Plural,
      T: ProbeT,
      Var,
      ...fixture.vue.components,
    },
    render: compileVueTemplate(fixture.vue.template),
    setup: fixture.vue.setup,
  });

  await renderToString(createSSRApp(Root));
  expect(sourceChildren).toBeDefined();
  return serializeVueChildren(sourceChildren!);
}

function compileVueTemplate(template: string): ReturnType<typeof Vue.compile> {
  const result = compileTemplate({
    compilerOptions: { mode: 'function' },
    filename: 'ReactRuntimeContract.vue',
    id: 'react-runtime-contract',
    source: template,
  });
  expect(result.errors).toEqual([]);
  return new Function('Vue', result.code)(Vue) as ReturnType<
    typeof Vue.compile
  >;
}

function hashRichSource(source: JsxChildren, context?: string): string {
  return hashSource({ context, dataFormat: 'JSX', source });
}

/**
 * Removes only diagnostic element labels before comparing framework wires.
 *
 * React function names can be minified and Vue component names can be inferred,
 * so `t` is deliberately ignored by `hashSource()` and by runtime ID binding.
 * IDs, nesting, translated props, branch data, and variable identities remain
 * exact in this comparison.
 */
function normalizeSemanticWire(source: JsxChildren): unknown {
  if (Array.isArray(source)) return source.map(normalizeSemanticWire);
  if (typeof source === 'string') return source;
  if ('k' in source) {
    return {
      i: source.i,
      k: source.k,
      ...(source.v && { v: source.v }),
    };
  }

  return {
    i: source.i,
    ...(source.d && {
      d: {
        ...source.d,
        ...(source.d.b && {
          b: Object.fromEntries(
            Object.entries(source.d.b).map(([key, branch]) => [
              key,
              normalizeSemanticWire(branch),
            ])
          ),
        }),
      },
    }),
    ...(source.c !== undefined && { c: normalizeSemanticWire(source.c) }),
  };
}
