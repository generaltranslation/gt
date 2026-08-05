import { describe, expect, it } from 'vitest';
import { hashSource } from 'generaltranslation/id';
import { extractFromVueSource } from '../../index.js';

describe('opaque component runtime parity', () => {
  it('does not inspect comment whitespace outside serialized component slots', async () => {
    const output = await extract(`
      <script setup lang="ts">
      import { T } from 'gt-vue';
      </script>
      <template>
        <!-- outside translated content -->
        <T><Card>Hidden <!-- opaque slot --> content</Card><b>After</b></T>
      </template>
    `);

    expect(output.errors).toEqual([]);
    expect(output.results[0]?.source).toEqual([
      { t: 'Card', i: 1 },
      { t: 'b', i: 2, c: 'After' },
    ]);
  });

  it('omits arbitrary component slots and extracts a nested T independently', async () => {
    const output = await extract(`
      <script setup lang="ts">
      import { T, Var } from 'gt-vue';
      </script>
      <template>
        <T context="outer"><Card title="Heading"><template #default="{ label }"><strong>Hidden</strong><T context="inner">Inner<Var>{{ label }}</Var></T></template><template #unused>Ignored</template></Card><span>After</span></T>
      </template>
    `);

    expect(output.errors).toEqual([]);
    expect(
      output.results
        .filter((result) => result.dataFormat === 'JSX')
        .map((result) => ({
          context: result.metadata.context,
          source: result.source,
        }))
    ).toEqual([
      {
        context: 'outer',
        source: [
          { t: 'Card', i: 1, d: { ti: 'Heading' } },
          { t: 'span', i: 2, c: 'After' },
        ],
      },
      {
        context: 'inner',
        source: ['Inner', { i: 1, k: '_gt_value_1', v: 'v' }],
      },
    ]);
  });

  it('serializes only Suspense default content and extracts fallback T independently', async () => {
    const output = await extract(`
      <script setup lang="ts">
      import { T } from 'gt-vue';
      </script>
      <template>
        <T><Suspense><main>Source</main><template #fallback><T context="loading">Loading</T></template></Suspense><Transition><p>Motion</p></Transition><b>After</b></T>
      </template>
    `);

    expect(output.errors).toEqual([]);
    expect(
      output.results
        .filter((result) => result.dataFormat === 'JSX')
        .map((result) => ({
          context: result.metadata.context,
          source: result.source,
        }))
    ).toEqual([
      {
        context: undefined,
        source: [
          {
            t: 'Suspense',
            i: 1,
            c: { t: 'main', i: 2, c: 'Source' },
          },
          { t: 'Transition', i: 3 },
          { t: 'b', i: 4, c: 'After' },
        ],
      },
      { context: 'loading', source: 'Loading' },
    ]);
  });

  it.each(['#fallback', 'v-slot:fallback'])(
    'extracts a component-level Suspense fallback independently with %s',
    async (directive) => {
      const output = await extract(`
        <script setup lang="ts">
        import { T } from 'gt-vue';
        </script>
        <template><T><Suspense ${directive}><T context="loading">Loading</T></Suspense><b>After</b></T></template>
      `);

      expect(output.errors).toEqual([]);
      expect(
        output.results.map((result) => ({
          context: result.metadata.context,
          source: result.source,
        }))
      ).toEqual([
        {
          context: undefined,
          source: [
            { t: 'Suspense', i: 1 },
            { t: 'b', i: 2, c: 'After' },
          ],
        },
        { context: 'loading', source: 'Loading' },
      ]);
    }
  );

  it('rejects multiple Suspense default roots that Vue normalizes to a comment', async () => {
    const output = await extract(`
      <script setup lang="ts">
      import { T } from 'gt-vue';
      </script>
      <template><T><Suspense><!-- ignored --><p>First</p><p>Second</p><template #fallback>Loading</template></Suspense></T></template>
    `);

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'more than one default root inside Vue <Suspense>'
    );
  });

  it.each(["Hello {{ 'world' }}", "{{ 'Hello' }}{{ ' world' }}"])(
    'accepts adjacent text as one Suspense root: %s',
    async (content) => {
      const output = await extract(`
      <script setup lang="ts">
      import { T } from 'gt-vue';
      </script>
      <template><T><Suspense>${content}</Suspense></T></template>
    `);

      expect(output.errors).toEqual([]);
      expect(output.results[0]?.source).toEqual({
        t: 'Suspense',
        i: 1,
        c: 'Hello world',
      });
    }
  );

  it.each([
    'Hello<!-- compiler barrier -->world',
    'Hello<template #fallback>Loading</template>world',
    "{{ 'Hello' }}<!-- compiler barrier -->{{ ' world' }}",
  ])(
    'rejects text roots separated by a Vue compiler barrier: %s',
    async (content) => {
      const output = await extract(`
        <script setup lang="ts">
        import { T } from 'gt-vue';
        </script>
        <template><T><Suspense>${content}</Suspense></T></template>
      `);

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        'more than one default root inside Vue <Suspense>'
      );
    }
  );

  it('ignores a trailing comment when Suspense has one meaningful root', async () => {
    const output = await extract(`
      <script setup lang="ts">
      import { T } from 'gt-vue';
      </script>
      <template><T><Suspense><main>Source</main><!-- ignored --></Suspense></T></template>
    `);

    expect(output.errors).toEqual([]);
    expect(output.results[0]?.source).toEqual({
      t: 'Suspense',
      i: 1,
      c: { t: 'main', i: 2, c: 'Source' },
    });
  });

  it.each([
    {
      name: 'literal builtin',
      script: '',
      tag: 'Suspense',
    },
    {
      name: 'named import alias',
      script: "import { Suspense as AsyncBoundary } from 'vue';",
      tag: 'AsyncBoundary',
    },
    {
      name: 'transitive alias',
      script:
        "import { Suspense } from 'vue'; const First = Suspense; const AsyncBoundary = First;",
      tag: 'AsyncBoundary',
    },
    {
      name: 'namespace tag',
      script: "import * as Vue from 'vue';",
      tag: 'Vue.Suspense',
    },
    {
      name: 'namespace-derived alias',
      script: "import * as Vue from 'vue'; const AsyncBoundary = Vue.Suspense;",
      tag: 'AsyncBoundary',
    },
    {
      name: 'nullish alias',
      script:
        "import * as Vue from 'vue'; const AsyncBoundary = Vue.Suspense ?? String;",
      tag: 'AsyncBoundary',
    },
    {
      name: 'logical alias',
      script:
        "import * as Vue from 'vue'; const AsyncBoundary = Vue.Suspense || String;",
      tag: 'AsyncBoundary',
    },
    {
      name: 'logical-and alias',
      script:
        "import * as Vue from 'vue'; const AsyncBoundary = Vue.Suspense && Vue.Suspense;",
      tag: 'AsyncBoundary',
    },
    {
      name: 'static conditional alias',
      script:
        "import * as Vue from 'vue'; const AsyncBoundary = true ? Vue.Suspense : String;",
      tag: 'AsyncBoundary',
    },
    {
      name: 'identical conditional alias',
      script:
        "import * as Vue from 'vue'; const runtimeFlag = Boolean(Date.now()); const AsyncBoundary = runtimeFlag ? Vue.Suspense : Vue.Suspense;",
      tag: 'AsyncBoundary',
    },
    {
      name: 'sequence alias',
      script:
        "import * as Vue from 'vue'; const AsyncBoundary = (0, Vue.Suspense);",
      tag: 'AsyncBoundary',
    },
    {
      name: 'markRaw identity wrapper',
      script:
        "import { markRaw, Suspense } from 'vue'; const AsyncBoundary = markRaw(Suspense);",
      tag: 'AsyncBoundary',
    },
    {
      name: 'kebab-case alias',
      script: "import { Suspense as AsyncBoundary } from 'vue';",
      tag: 'async-boundary',
    },
    {
      name: 'dynamic direct binding',
      script: "import { Suspense } from 'vue';",
      tag: 'component :is="Suspense"',
    },
    {
      name: 'dynamic namespace binding',
      script: "import * as Vue from 'vue';",
      tag: 'component :is="Vue.Suspense"',
    },
  ])('matches literal Suspense for a $name', async ({ script, tag }) => {
    const output = await extract(`
      <script setup lang="ts">
      import { T } from 'gt-vue';
      ${script}
      </script>
      <template><T><${tag}><main>Source</main><template #fallback>Loading</template></${tag.split(' ')[0]}></T></template>
    `);

    expect(output.errors).toEqual([]);
    const source = output.results.find(
      (result) => result.dataFormat === 'JSX'
    )?.source;
    expect(source).toEqual({
      t: 'Suspense',
      i: 1,
      c: { t: 'main', i: 2, c: 'Source' },
    });
    expect(hashSource({ dataFormat: 'JSX', source })).toBe('bb63de9e2be66ffe');
  });

  it('resolves Options API Suspense registration through object spreads and static selectors', async () => {
    const output = await extract(`
      <script lang="ts">
      import { defineComponent, Suspense } from 'vue';
      import { T } from 'gt-vue';
      const shared = { AsyncBoundary: Suspense };
      export default defineComponent({
        components: { T, ...shared },
      });
      </script>
      <template><T><component :is="'AsyncBoundary'"><main>Source</main><template #fallback>Loading</template></component></T></template>
    `);

    expect(output.errors).toEqual([]);
    const source = output.results.find(
      (result) => result.dataFormat === 'JSX'
    )?.source;
    expect(source).toEqual({
      t: 'Suspense',
      i: 1,
      c: { t: 'main', i: 2, c: 'Source' },
    });
    expect(hashSource({ dataFormat: 'JSX', source })).toBe('bb63de9e2be66ffe');
  });

  it.each([
    {
      name: 'direct overrides',
      declaration: `{
        ...getOptions(),
        components: { T, AsyncBoundary: Suspense },
        setup() { return {}; },
      }`,
    },
    {
      name: 'nested overrides',
      declaration: `{
        ...{
          ...getOptions(),
          components: { T, AsyncBoundary: Suspense },
          setup() { return {}; },
        },
      }`,
    },
    {
      name: 'explicit absent setup override',
      declaration: `{
        ...getOptions(),
        components: { T, AsyncBoundary: Suspense },
        setup: undefined,
      }`,
    },
  ])(
    'accepts relevant Options API properties after unknown top-level spreads: $name',
    async ({ declaration }) => {
      const output = await extract(`
        <script>
        import { Suspense } from 'vue';
        import { T } from 'gt-vue';
        const getOptions = () => ({ components: { Card: Suspense } });
        export default ${declaration};
        </script>
        <template><T><AsyncBoundary><main>Source</main></AsyncBoundary></T></template>
      `);

      expect(output.errors).toEqual([]);
      expect(output.results[0]?.source).toEqual({
        t: 'Suspense',
        i: 1,
        c: { t: 'main', i: 2, c: 'Source' },
      });
    }
  );

  it.each([
    {
      name: 'missing explicit setup',
      declaration:
        '{ ...getOptions(), components: { T, AsyncBoundary: Suspense } }',
    },
    {
      name: 'missing explicit components',
      declaration: '{ ...getOptions(), setup() { return {}; } }',
    },
    {
      name: 'trailing spread',
      declaration:
        '{ components: { T, AsyncBoundary: Suspense }, setup() { return {}; }, ...getOptions() }',
    },
    {
      name: 'trailing computed key',
      declaration:
        '{ components: { T, AsyncBoundary: Suspense }, setup() { return {}; }, [getKey()]: true }',
    },
  ])(
    'rejects unknown top-level Options API properties after $name',
    async ({ declaration }) => {
      const output = await extract(`
        <script>
        import { Suspense } from 'vue';
        import { T } from 'gt-vue';
        const getOptions = () => ({});
        const getKey = () => 'components';
        export default ${declaration};
        </script>
        <template><T><AsyncBoundary><main>Hidden</main></AsyncBoundary></T></template>
      `);

      expect(output.errors.join('\n')).toContain(
        'Could not statically resolve the Vue Options API components or setup'
      );
    }
  );

  it('keeps unknown component-registry keys blocking after explicit overrides', async () => {
    const output = await extract(`
      <script>
      import { Suspense } from 'vue';
      import { T } from 'gt-vue';
      const getComponents = () => ({ Card: Suspense });
      export default {
        components: { ...getComponents(), T, AsyncBoundary: Suspense },
        setup() { return {}; },
      };
      </script>
      <template><T><Card><main>Hidden</main></Card></T></template>
    `);

    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve the Vue Options API components registry'
    );
  });

  it('keeps unproven Suspense-like components opaque and rejects unregistered string selectors', async () => {
    const opaque = await extract(`
      <script setup lang="ts">
      import { T } from 'gt-vue';
      import { Suspense as AsyncBoundary } from './ui';
      </script>
      <template><T><AsyncBoundary><main>Hidden</main></AsyncBoundary></T></template>
    `);
    const mutable = await extract(`
      <script setup lang="ts">
      import { Suspense } from 'vue';
      import { T } from 'gt-vue';
      let AsyncBoundary = Suspense;
      AsyncBoundary = String;
      </script>
      <template><T><AsyncBoundary><main>Hidden</main></AsyncBoundary></T></template>
    `);
    const stringSelector = await extract(`
      <script setup lang="ts">
      import { T } from 'gt-vue';
      </script>
      <template><T><component :is="'Suspense'"><main>Hidden</main></component></T></template>
    `);

    expect(opaque.errors).toEqual([]);
    expect(opaque.results[0]?.source).toEqual({ t: 'AsyncBoundary', i: 1 });
    expect(mutable.results).toEqual([]);
    expect(mutable.errors.join('\n')).toContain(
      'Could not statically resolve component alias "AsyncBoundary"'
    );
    expect(stringSelector.results).toEqual([]);
    expect(stringSelector.errors.join('\n')).toContain('dynamic <component>');
  });

  it.each([
    {
      name: 'member assignment',
      setup:
        'const registry = { AsyncBoundary: Suspense }; registry.AsyncBoundary = String;',
      registration: 'const { AsyncBoundary } = registry;',
    },
    {
      name: 'computed member assignment',
      setup:
        "const registry = { AsyncBoundary: Suspense }; registry['AsyncBoundary'] = String;",
      registration: 'const { AsyncBoundary } = registry;',
    },
    {
      name: 'Object.assign mutation',
      setup:
        'const registry = { AsyncBoundary: Suspense }; Object.assign(registry, { AsyncBoundary: String });',
      registration: 'const { AsyncBoundary } = registry;',
    },
    {
      name: 'escaped container',
      setup:
        'const registry = { AsyncBoundary: Suspense }; console.log(registry);',
      registration: 'const { AsyncBoundary } = registry;',
    },
    {
      name: 'deleted member',
      setup:
        'const registry: { AsyncBoundary?: unknown } = { AsyncBoundary: Suspense }; delete registry.AsyncBoundary;',
      registration: 'const { AsyncBoundary } = registry;',
    },
    {
      name: 'object-pattern member assignment',
      setup:
        'const registry = { AsyncBoundary: Suspense }; ({ AsyncBoundary: registry.AsyncBoundary } = { AsyncBoundary: String });',
      registration: 'const { AsyncBoundary } = registry;',
    },
    {
      name: 'array-pattern member assignment',
      setup:
        'const registry = { AsyncBoundary: Suspense }; [registry.AsyncBoundary] = [String];',
      registration: 'const { AsyncBoundary } = registry;',
    },
    {
      name: 'for-of member assignment',
      setup:
        'const registry = { AsyncBoundary: Suspense }; for (registry.AsyncBoundary of [String]) {}',
      registration: 'const { AsyncBoundary } = registry;',
    },
    {
      name: 'hoisted closure member assignment',
      setup: 'const registry = { AsyncBoundary: Suspense }; mutateRegistry();',
      registration:
        'const { AsyncBoundary } = registry; function mutateRegistry() { registry.AsyncBoundary = String; }',
    },
    {
      name: 'unknown trailing spread',
      setup: 'const getRegistry = () => ({ AsyncBoundary: String });',
      registration:
        'const { AsyncBoundary } = { AsyncBoundary: Suspense, ...getRegistry() };',
    },
    {
      name: 'mutated Options API registry',
      setup:
        'const registry = { AsyncBoundary: Suspense }; registry.AsyncBoundary = String;',
      registration: 'const components = registry;',
      options: true,
    },
    {
      name: 'unknown trailing Options API spread',
      setup: 'const getRegistry = () => ({ AsyncBoundary: String });',
      registration:
        'const components = { AsyncBoundary: Suspense, ...getRegistry() };',
      options: true,
    },
  ])(
    'does not follow a Suspense alias through $name',
    async ({ setup, registration, options }) => {
      const output = await extract(`
        <script${options ? '' : ' setup'} lang="ts">
        import { Suspense } from 'vue';
        import { T } from 'gt-vue';
        ${setup}
        ${registration}
        ${options ? 'export default { components: { ...components, T } };' : ''}
        </script>
        <template><T><AsyncBoundary><main>Hidden</main></AsyncBoundary></T></template>
      `);

      expect(output.errors.join('\n')).toContain(
        options
          ? 'Could not statically resolve the Vue Options API components registry'
          : 'Could not statically resolve component alias "AsyncBoundary"'
      );
      if (options) {
        expect(output.results[0]?.source).toEqual({
          t: 'AsyncBoundary',
          i: 1,
        });
      } else {
        expect(output.results).toEqual([]);
      }
    }
  );

  it.each([
    'registry.AsyncBoundary = String;',
    'Object.assign(registry, { AsyncBoundary: String });',
  ])(
    'keeps a component captured before later mutation: %s',
    async (mutation) => {
      const output = await extract(`
      <script setup lang="ts">
      import { Suspense } from 'vue';
      import { T } from 'gt-vue';
      const registry = { AsyncBoundary: Suspense };
      const { AsyncBoundary } = registry;
      ${mutation}
      </script>
      <template><T><AsyncBoundary><main>Source</main></AsyncBoundary></T></template>
    `);

      expect(output.errors).toEqual([]);
      expect(output.results[0]?.source).toEqual({
        t: 'Suspense',
        i: 1,
        c: { t: 'main', i: 2, c: 'Source' },
      });
    }
  );

  it.each([
    {
      name: 'reassigned destructured require binding',
      script: "let { Suspense: Boundary } = require('vue'); Boundary = String;",
      tag: 'Boundary',
    },
    {
      name: 'mutated require namespace member',
      script:
        "const Vue = require('vue'); Vue.Suspense = String; const Boundary = Vue.Suspense;",
      tag: 'Boundary',
    },
    {
      name: 'reassigned require namespace',
      script:
        "let Vue = require('vue'); Vue = { Suspense: String }; const Boundary = Vue.Suspense;",
      tag: 'Boundary',
    },
  ])('fails closed for a $name', async ({ script, tag }) => {
    const output = await extract(`
      <script setup>
      import { T } from 'gt-vue';
      ${script}
      </script>
      <template><T><${tag}><main>Hidden</main></${tag}></T></template>
    `);

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      `Could not statically resolve component alias "${tag}"`
    );
  });

  it('does not trust a mutable CommonJS namespace across SFC script blocks', async () => {
    const output = await extract(`
      <script>
      const Vue = require('vue');
      Vue.Suspense = String;
      export default {};
      </script>
      <script setup>
      import { T } from 'gt-vue';
      </script>
      <template><T><Vue.Suspense><main>Hidden</main></Vue.Suspense></T></template>
    `);

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve component alias "Vue.Suspense"'
    );
  });

  it.each([
    'const Boundary = shallowRef(Suspense);',
    'const Boundary = computed(() => Suspense);',
    'const Boundary = computed({ get: () => Suspense, set() {} });',
    'const Boundary = (() => Suspense)();',
    'function makeBoundary() { return Suspense; } const Boundary = makeBoundary();',
    'const holder = { get Boundary() { return Suspense; } }; const { Boundary } = holder;',
  ])(
    'fails closed when a wrapper can return Vue Suspense: %s',
    async (script) => {
      const output = await extract(`
        <script setup>
        import { computed, shallowRef, Suspense } from 'vue';
        import { T } from 'gt-vue';
        ${script}
        </script>
        <template><T><Boundary><main>Hidden</main></Boundary></T></template>
      `);

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        'Could not statically resolve component alias "Boundary"'
      );
    }
  );

  it('still rejects source-shaping directives and dynamic content props on opaque components', async () => {
    const output = await extract(`
      <script setup lang="ts">
      import { T } from 'gt-vue';
      const heading = String(Date.now());
      const visible = true;
      </script>
      <template><T><Card v-if="visible" :title="heading">Hidden</Card></T></template>
    `);

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain('source-shaping directive v-if');
    expect(output.errors.join('\n')).toContain(
      'dynamic translatable prop "title"'
    );
  });
});

async function extract(source: string) {
  return extractFromVueSource(source, '/fixtures/OpaqueComponents.vue', {
    projectRoot: process.cwd(),
  });
}
