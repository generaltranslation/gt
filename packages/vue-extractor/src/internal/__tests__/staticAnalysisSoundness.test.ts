import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from './testVueCompiler.js';

describe('Vue static-analysis soundness', () => {
  it.each([
    {
      name: 'destructured Vue namespace',
      script: `const Vue = require('vue'); Vue.Suspense = String; const { Suspense: Boundary } = Vue;`,
      tag: 'Boundary',
    },
    {
      name: 'aliased Vue namespace',
      script: `const Vue = require('vue'); const Alias = Vue; Vue.Suspense = String; const Boundary = Alias.Suspense;`,
      tag: 'Boundary',
    },
    {
      name: 'computed Vue namespace write',
      script: `const Vue = require('vue'); Vue['Suspense'] = String; const Boundary = Vue.Suspense;`,
      tag: 'Boundary',
    },
    {
      name: 'Object.assign namespace write',
      script: `const Vue = require('vue'); Object.assign(Vue, { Suspense: String }); const Boundary = Vue.Suspense;`,
      tag: 'Boundary',
    },
    {
      name: 'Reflect.set namespace write',
      script: `const Vue = require('vue'); Reflect.set(Vue, 'Suspense', String); const Boundary = Vue.Suspense;`,
      tag: 'Boundary',
    },
    {
      name: 'escaped Vue namespace',
      script: `const Vue = require('vue'); mutate(Vue); const Boundary = Vue.Suspense;`,
      tag: 'Boundary',
    },
    {
      name: 'destructured GT namespace',
      script: `const GT = require('gt-vue'); GT.T = String; const { T: LocalT } = GT;`,
      tag: 'LocalT',
    },
  ])('fails closed for a mutated $name', async ({ script, tag }) => {
    const output = await extract(
      setup(script, `<T><${tag}>Hidden</${tag}></T>`)
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      `Could not statically resolve component alias "${tag}"`
    );
  });

  it.each([
    `const registry = { nested: { Boundary: Suspense } }; mutate(registry.nested); const { nested: { Boundary } } = registry;`,
    `const registry = { nested: { Boundary: Suspense } }; const { nested } = registry; nested.Boundary = String; const { Boundary } = registry.nested;`,
    `const registry = { nested: { Boundary: Suspense } }; const copy = { ...registry }; copy.nested.Boundary = String; const { Boundary } = registry.nested;`,
    `const registry = { nested: { Boundary: Suspense } }; Object.assign(registry.nested, { Boundary: String }); const { nested: { Boundary } } = registry;`,
    `const registry = { nested: { Boundary: Suspense } }; Reflect.set(registry.nested, 'Boundary', String); const { nested: { Boundary } } = registry;`,
  ])(
    'fails closed when a nested component container escapes: %s',
    async (script) => {
      const output = await extract(
        setup(
          `import { Suspense } from 'vue'; ${script}`,
          '<T><Boundary>Hidden</Boundary></T>'
        )
      );

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        'Could not statically resolve component alias "Boundary"'
      );
    }
  );

  it('resolves a component read through an immutable array member', async () => {
    const output = await extract(
      setup(
        `import { Suspense } from 'vue'; const registry = [Suspense]; const Boundary = registry[0];`,
        '<T><Boundary>Hidden</Boundary></T>'
      )
    );

    expect(output.errors).toEqual([]);
    expect(output.results[0]?.source).toEqual({
      t: 'Suspense',
      i: 1,
      c: 'Hidden',
    });
  });

  it('does not expose a function-local CommonJS import to the template', async () => {
    const output = await extract(`
      <script setup>
      function hidden() {
        const { T } = require('gt-vue');
        return T;
      }
      </script>
      <template><T>Not GT at runtime</T></template>
    `);

    expect(output.errors).toEqual([]);
    expect(output.results).toEqual([]);
  });

  it.each([
    `const Card = defineComponent({ setup() { void Suspense; return () => h('div'); } });`,
    `const Card = { nested: Suspense };`,
    `const Card = () => h('div', [h(Suspense)]);`,
    `const Card = markRaw(defineComponent({ render() { return h('div', [h(Suspense)]); } }));`,
  ])(
    'keeps an ordinary component opaque when its implementation mentions Suspense',
    async (script) => {
      const output = await extract(
        setup(
          `import { defineComponent, h, markRaw, Suspense } from 'vue'; ${script}`,
          '<T><Card>Hidden</Card></T>'
        )
      );

      expect(output.errors).toEqual([]);
      expect(output.results[0]?.source).toEqual({ t: 'Card', i: 1 });
    }
  );

  it.each([
    `const Boundary = (() => { const Inner = Suspense; return Inner; })();`,
    `const Boundary = computed(() => { const Inner = Suspense; return Inner; });`,
    `const holder = { get Boundary() { const Inner = Suspense; return Inner; } }; const { Boundary } = holder;`,
    `const make = () => { const Inner = Suspense; return Inner; }; const Boundary = make();`,
  ])(
    'tracks component identity through a function-local alias: %s',
    async (script) => {
      const output = await extract(
        setup(
          `import { computed, Suspense } from 'vue'; ${script}`,
          '<T><Boundary>Hidden</Boundary></T>'
        )
      );

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        'Could not statically resolve component alias "Boundary"'
      );
    }
  );

  it.each([
    `const Boundary = (() => { const Suspense = String; return Suspense; })();`,
    `const Boundary = computed(() => { const Suspense = String; return Suspense; });`,
    `const holder = { get Boundary() { const Suspense = String; return Suspense; } }; const { Boundary } = holder;`,
  ])('respects a function-local shadow of Suspense: %s', async (script) => {
    const output = await extract(
      setup(
        `import { computed, Suspense } from 'vue'; ${script}`,
        '<T><Boundary>Hidden</Boundary></T>'
      )
    );

    expect(output.errors).toEqual([]);
    expect(output.results[0]?.source).toEqual({ t: 'Boundary', i: 1 });
  });

  it('lets script setup shadow a normal-script Suspense binding', async () => {
    const output = await extract(`
      <script>import { Suspense as Boundary } from 'vue'; export { Boundary };</script>
      <script setup>import { T } from 'gt-vue'; const Boundary = String;</script>
      <template><T><Boundary>Hidden</Boundary></T></template>
    `);

    expect(output.errors).toEqual([]);
    expect(output.results[0]?.source).toEqual({ t: 'Boundary', i: 1 });
  });

  it('lets script setup shadow a normal-script GT component', async () => {
    const output = await extract(`
      <script>import { T } from 'gt-vue'; export { T };</script>
      <script setup>const T = String;</script>
      <template><T>Not GT at runtime</T></template>
    `);

    expect(output.errors).toEqual([]);
    expect(output.results).toEqual([]);
  });

  it('removes a stale cross-block static value when script setup shadows it', async () => {
    const output = await extract(`
      <script>export const value = 'Hello';</script>
      <script setup>import { T } from 'gt-vue'; const value = Date.now();</script>
      <template><T>{{ value }}</T></template>
    `);

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain('dynamic template content');
  });

  it('keeps registration identity separate from a script-setup shadow', async () => {
    const direct = await extract(
      optionsWithSetupShadow('<AsyncBoundary>Hidden</AsyncBoundary>')
    );
    const literal = await extract(
      optionsWithSetupShadow(
        `<component :is="'AsyncBoundary'"><main>Source</main></component>`
      )
    );
    const expression = await extract(
      optionsWithSetupShadow(
        '<component :is="AsyncBoundary">Hidden</component>'
      )
    );

    expect(direct.errors).toEqual([]);
    expect(direct.results[0]?.source).toEqual({ t: 'AsyncBoundary', i: 1 });
    expect(literal.errors).toEqual([]);
    expect(literal.results[0]?.source).toEqual({
      t: 'Suspense',
      i: 1,
      c: { t: 'main', i: 2, c: 'Source' },
    });
    expect(expression.results).toEqual([]);
    expect(expression.errors.join('\n')).toContain('dynamic <component>');
  });

  it('does not use a registration to resolve an Options data selector', async () => {
    const output = await extract(`
      <script>
      import { Suspense } from 'vue';
      import { T } from 'gt-vue';
      export default {
        components: { T, AsyncBoundary: Suspense },
        data() { return { AsyncBoundary: String }; },
      };
      </script>
      <template><T><component :is="AsyncBoundary">Hidden</component></T></template>
    `);

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain('dynamic <component>');
  });

  it.each([
    {
      name: 'factory call',
      prelude: `const makeSetup = () => () => ({ gt: useGT() });`,
      setup: 'makeSetup()',
    },
    {
      name: 'dynamic conditional',
      prelude: `const direct = () => ({ gt: useGT() }); const other = () => ({}); const flag = Boolean(Date.now());`,
      setup: 'flag ? direct : other',
    },
    {
      name: 'external import',
      prelude: `import { setup as externalSetup } from './external';`,
      setup: 'externalSetup',
    },
  ])(
    'rejects an unresolvable Options setup $name',
    async ({ prelude, setup }) => {
      const output = await extract(`
      <script>
      import { useGT } from 'gt-vue';
      ${prelude}
      export default { setup: ${setup} };
      </script>
      <template>{{ gt('Hidden') }}</template>
    `);

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        'Could not statically resolve the Vue Options API setup function'
      );
    }
  );

  it('accepts explicit absent Options components and setup values', async () => {
    const output = await extract(`
      <script>
      import { T } from 'gt-vue';
      export default { components: undefined, setup: undefined };
      </script>
      <template><div>Nothing to extract</div></template>
    `);

    expect(output.errors).toEqual([]);
    expect(output.results).toEqual([]);
  });

  it('keeps a dynamic Options setup-return spread blocking after an explicit binding', async () => {
    const output = await extract(`
      <script>
      import { useGT } from 'gt-vue';
      const getState = () => ({});
      export default {
        setup() {
          const gt = useGT();
          return { ...getState(), gt };
        },
      };
      </script>
      <template>{{ gt('Known but incomplete') }}</template>
    `);

    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve an Options API setup return'
    );
  });

  it('resolves exact same-script component members without a wildcard', async () => {
    const output = await extract(`
      <script setup>
      import { T } from 'gt-vue';
      import { Suspense } from 'vue';
      const kit = { nested: { T }, Suspense, Card: String };
      </script>
      <template>
        <kit.nested.T>Direct member</kit.nested.T>
        <component :is="kit.nested.T">Dynamic member</component>
        <T><kit.Suspense>Ready</kit.Suspense></T>
        <kit.Card>Not a translation</kit.Card>
      </template>
    `);

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      'Direct member',
      'Dynamic member',
      { t: 'Suspense', i: 1, c: 'Ready' },
    ]);
  });

  it('resolves a nested component member returned from Options setup', async () => {
    const output = await extract(`
      <script>
      import { T } from 'gt-vue';
      export default { setup() { return { kit: { nested: { T } } }; } };
      </script>
      <template><component :is="kit.nested.T">Options member</component></template>
    `);

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      'Options member',
    ]);
  });

  it('fails closed when a nested primitive changes before destructuring', async () => {
    const output = await extract(`
      <script setup>
      import { useGT } from 'gt-vue';
      const config = { context: 'old' };
      const outer = { config };
      config.context = 'new';
      const { config: { context } } = outer;
      const gt = useGT();
      gt('Hello', { $context: context });
      </script>
      <template />
    `);

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain('dynamic $context');
  });

  it('preserves a nested primitive captured before a later mutation', async () => {
    const output = await extract(`
      <script setup>
      import { useGT } from 'gt-vue';
      const config = { context: 'old' };
      const outer = { config };
      const { config: { context } } = outer;
      config.context = 'new';
      const gt = useGT();
      gt('Hello', { $context: context });
      </script>
      <template />
    `);

    expect(output.errors).toEqual([]);
    expect(output.results[0]?.metadata.context).toBe('old');
  });

  it('fails closed when a nested component changes before destructuring', async () => {
    const output = await extract(
      setup(
        `import { Suspense } from 'vue';
         const registry = { Boundary: Suspense };
         const outer = { inner: registry };
         registry.Boundary = String;
         const { inner: { Boundary } } = outer;`,
        '<T><Boundary>Hidden</Boundary></T>'
      )
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve component alias "Boundary"'
    );
  });

  it('distinguishes a getter side effect from a harmless sibling read', async () => {
    const getter = await extract(
      setup(
        `import { Suspense } from 'vue';
         const registry = {
           Boundary: Suspense,
           get trigger() { this.Boundary = String; return true; },
         };
         if (registry.trigger) {}
         const { Boundary } = registry;`,
        '<T><Boundary>Hidden</Boundary></T>'
      )
    );
    const sibling = await extract(
      setup(
        `import { Suspense } from 'vue';
         const registry = { Boundary: Suspense, label: 'safe' };
         const label = registry.label;
         void label;
         const { Boundary } = registry;`,
        '<T><Boundary>Ready</Boundary></T>'
      )
    );

    expect(getter.results).toEqual([]);
    expect(getter.errors.join('\n')).toContain(
      'Could not statically resolve component alias "Boundary"'
    );
    expect(sibling.errors).toEqual([]);
    expect(sibling.results[0]?.source).toEqual({
      t: 'Suspense',
      i: 1,
      c: 'Ready',
    });
  });

  it.each([
    `if (Math.random() > 0.5) context = 'chosen';`,
    `for (const value of []) context = 'chosen';`,
    `function neverCalled() { context = 'chosen'; }`,
  ])(
    'does not treat a conditional deferred assignment as definite: %s',
    async (assignment) => {
      const output = await extractFromVueSource(
        `<script setup>
        import { useGT } from 'gt-vue';
        const gt = useGT();
        let context;
        ${assignment}
        gt('Hello', { $context: context });
        </script><template />`,
        '/fixtures/ConditionalAssignment.vue',
        { projectRoot: '/fixtures' }
      );

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain('dynamic $context');
    }
  );

  it('does not apply a later deferred assignment to an earlier function call', async () => {
    const output = await extractFromVueSource(
      `<script setup>
      import { useGT } from 'gt-vue';
      const gt = useGT();
      let context;
      translateBeforeAssignment();
      context = 'chosen';
      function translateBeforeAssignment() {
        gt('Hello', { $context: context });
      }
      </script><template />`,
      '/fixtures/CrossFunctionAssignment.vue',
      { projectRoot: '/fixtures' }
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain('dynamic $context');
  });
});

function setup(script: string, template: string): string {
  return `<script setup>import { T } from 'gt-vue'; ${script}</script><template>${template}</template>`;
}

function optionsWithSetupShadow(content: string): string {
  return `
    <script>
    import { Suspense } from 'vue';
    import { T } from 'gt-vue';
    export default { components: { T, AsyncBoundary: Suspense } };
    </script>
    <script setup>const AsyncBoundary = String;</script>
    <template><T>${content}</T></template>
  `;
}

async function extract(source: string) {
  return extractFromVueSource(source, '/fixtures/StaticSoundness.vue', {
    projectRoot: '/fixtures',
  });
}
