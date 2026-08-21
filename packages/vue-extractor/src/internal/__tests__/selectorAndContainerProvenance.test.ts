import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from './testVueCompiler.js';

describe('Vue selector and container provenance', () => {
  it.each(['`T`', "'T' + ''"])(
    'resolves a static string dynamic selector from %s',
    async (selector) => {
      const output = await extract(`
        <script>
        import { T } from 'gt-vue';
        export default { components: { T } };
        </script>
        <template><component :is="${selector}">Static selector</component></template>
      `);

      expect(output.errors).toEqual([]);
      expect(output.results.map(({ source }) => source)).toEqual([
        'Static selector',
      ]);
    }
  );

  it.each([
    ['literal array', '[T][0]', ''],
    ['nested literal arrays', '[[T]][0][0]', ''],
    ['literal array spread', '[...[T]][0]', ''],
    ['immutable array binding', 'kit[0]', 'const kit = [T];'],
    [
      'identical conditional branches',
      'flag ? T : T',
      'const flag = Boolean(Date.now());',
    ],
    ['sequence result', '(0, T)', ''],
    ['truthy logical result', 'T || String', ''],
    ['Vue identity wrapper', 'markRaw(T)', "import { markRaw } from 'vue';"],
  ])(
    'extracts an exact T selected through %s',
    async (_name, selector, code) => {
      const output = await extract(
        setup(
          `import { T } from 'gt-vue'; ${code}`,
          `<component :is="${selector}">Hello</component>`
        )
      );

      expect(output.errors).toEqual([]);
      expect(output.results.map(({ source }) => source)).toEqual(['Hello']);
    }
  );

  it.each([
    ['object shorthand', '{ Component } in [{ Component: T }]'],
    ['array element', '[Component] in [[T]]'],
    ['object default', '{ Component = T } in [{}]'],
    ['array default', '[Component = T] in [[]]'],
    [
      'renamed object member',
      '{ translated: Component } in [{ translated: T }]',
    ],
    [
      'nested object member',
      '{ nested: { Component } } in [{ nested: { Component: T } }]',
    ],
  ])(
    'does not silently drop T from a destructured v-for %s',
    async (_name, loop) => {
      const output = await extract(
        setup(
          `import { T } from 'gt-vue';`,
          `<component v-for="${loop}" :is="Component">Hidden</component>`
        )
      );

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        'Could not statically resolve possible gt-vue component alias'
      );
    }
  );

  it.each([
    ['v-for alias', '<component v-for="C in [Num]" :is="C" />'],
    [
      'scoped-slot default',
      '<Wrapper v-slot="{ C = Num }"><component :is="C" /></Wrapper>',
    ],
  ])('does not conflate Num with T for a %s', async (_name, template) => {
    const output = await extract(
      setup(`import { Num } from 'gt-vue';`, template)
    );

    expect(output.errors).toEqual([]);
    expect(output.results).toEqual([]);
  });

  it.each([
    [
      'v-for alias',
      `<component
         v-for="Component in [T]"
         :is="Component"
       >Hidden</component>`,
    ],
    [
      'scoped-slot default',
      `<Wrapper v-slot="{ Component = T }">
         <component :is="Component">Hidden</component>
       </Wrapper>`,
    ],
  ])(
    'does not silently drop a possible T from a %s',
    async (_name, template) => {
      const output = await extract(
        setup(`import { T } from 'gt-vue';`, template)
      );

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toMatch(
        /Could not statically resolve possible gt-vue component alias|source-shaping directive/
      );
    }
  );

  it.each([
    [
      'a conditional result',
      'flag ? T : String',
      'const flag = Boolean(Date.now());',
    ],
    ['a logical result', 'flag && T', 'const flag = Boolean(Date.now());'],
    ['a component factory', 'make()', 'const make = () => T;'],
    [
      'an object-method factory',
      'helpers.make()',
      'const helpers = { make() { return T; } };',
    ],
    [
      'an array with an unknown spread offset',
      '[...items, T][0]',
      'const items = getItems();',
    ],
    [
      'an object with a dynamic key',
      '({ translated: T, ordinary: String })[key]',
      'const key = getKey();',
    ],
    ['an unknown identity call', 'identity(T)', 'const identity = (x) => x;'],
    [
      'a bound array with a dynamic index',
      'registry[index]',
      'const registry = [T, String]; const index = getIndex();',
    ],
    [
      'a bound object with a dynamic key',
      'registry[key]',
      `const registry = { translated: T, ordinary: String };
       const key = getKey();`,
    ],
    [
      'a selecting method on a bound array',
      'registry.at(index)',
      'const registry = [T, String]; const index = getIndex();',
    ],
    [
      'a nested bound array selected at both depths',
      'matrix[row][column]',
      `const matrix = [[T, String]];
       const row = getRow();
       const column = getColumn();`,
    ],
    [
      'an inline object spread',
      '({ ...{ translated: T }, ordinary: String })[key]',
      'const key = getKey();',
    ],
  ])(
    'fails closed when T is one possible value of %s',
    async (_name, selector, code) => {
      const output = await extract(
        setup(
          `import { T } from 'gt-vue'; ${code}`,
          `<component :is="${selector}">Hidden</component>`
        )
      );

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        'Could not statically resolve possible gt-vue component alias'
      );
    }
  );

  it('keeps ordinary dynamic selector provenance out of GT diagnostics', async () => {
    const output = await extract(
      setup(
        `const Card = String;
         const flag = Boolean(Date.now());
         const helpers = { make() { return Card; } };`,
        '<component :is="flag ? Card : helpers.make()">Ordinary</component>'
      )
    );

    expect(output.errors).toEqual([]);
    expect(output.results).toEqual([]);
  });

  it.each([
    [
      'array index',
      'registry[index]',
      'const registry = [String, Number]; const index = getIndex();',
    ],
    [
      'object key',
      'registry[key]',
      `const registry = { text: String, count: Number };
       const key = getKey();`,
    ],
    [
      'array selection method',
      'registry.at(index)',
      'const registry = [String, Number]; const index = getIndex();',
    ],
    [
      'nested object value',
      'registry[key]',
      `import { T } from 'gt-vue';
       const registry = { nested: { translated: T } };
       const key = getKey();`,
    ],
    [
      'overridden inline object member',
      '({ translated: T, translated: String })[key]',
      `import { T } from 'gt-vue';
       const key = getKey();`,
    ],
    [
      'ordinary object method named at',
      'registry.at(index)',
      `import { T } from 'gt-vue';
       const registry = { translated: T, at() { return String; } };
       const index = getIndex();`,
    ],
    [
      'out-of-range array at call',
      'registry.at(100)',
      `import { T } from 'gt-vue';
       const registry = [T];`,
    ],
  ])(
    'does not report an ordinary bound container selected by %s',
    async (_name, selector, code) => {
      const output = await extract(
        setup(code, `<component :is="${selector}">Ordinary</component>`)
      );

      expect(output.errors).toEqual([]);
      expect(output.results).toEqual([]);
    }
  );

  it('keeps an exact bound member selector exact', async () => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue';
         const registry = { translated: T };`,
        '<component :is="registry.translated">Exact</component>'
      )
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual(['Exact']);
  });

  it('keeps dotted property names distinct from nested member paths', async () => {
    const nested = await extract(
      setup(
        `import { T } from 'gt-vue';
         const registry = { nested: { value: String }, 'nested.value': T };`,
        '<component :is="registry.nested.value">Ordinary</component>'
      )
    );
    const dotted = await extract(
      setup(
        `import { T } from 'gt-vue';
         const registry = { 'nested.value': T, nested: { value: String } };`,
        `<component :is="registry['nested.value']">Translated</component>`
      )
    );
    const dynamic = await extract(
      setup(
        `import { T } from 'gt-vue';
         const registry = { 'nested.value': T };
         const key = getKey();`,
        '<component :is="registry[key]">Hidden</component>'
      )
    );

    expect(nested.errors).toEqual([]);
    expect(nested.results).toEqual([]);
    expect(dotted.errors).toEqual([]);
    expect(dotted.results.map(({ source }) => source)).toEqual(['Translated']);
    expect(dynamic.results).toEqual([]);
    expect(dynamic.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
  });

  it('preserves an empty static property key', async () => {
    const exact = await extract(
      setup(
        `import { T } from 'gt-vue';
         const registry = { '': T };`,
        `<component :is="registry['']">Exact</component>`
      )
    );
    const dynamic = await extract(
      setup(
        `import { T } from 'gt-vue';
         const registry = { '': T };
         const key = getKey();`,
        '<component :is="registry[key]">Hidden</component>'
      )
    );

    expect(exact.errors).toEqual([]);
    expect(exact.results.map(({ source }) => source)).toEqual(['Exact']);
    expect(dynamic.results).toEqual([]);
    expect(dynamic.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
  });

  it.each([
    [
      'array',
      'names[index]',
      `const names = ['T', 'div'];
       const index = getIndex();`,
    ],
    [
      'object',
      'names[key]',
      `const names = { translated: 'T', ordinary: 'div' };
       const key = getKey();`,
    ],
  ])(
    'fails closed for a registered T name selected from a bound %s',
    async (_name, selector, code) => {
      const output = await extract(`
        <script>
        import { T } from 'gt-vue';
        export default { components: { T } };
        </script>
        <script setup>${code}</script>
        <template><component :is="${selector}">Hidden</component></template>
      `);

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        'Could not statically resolve possible gt-vue component alias'
      );
    }
  );

  it('fails closed for a component factory returned from Options API setup', async () => {
    const output = await extract(`
      <script>
      import { T } from 'gt-vue';
      export default {
        setup() {
          const make = () => T;
          return { make };
        },
      };
      </script>
      <template><component :is="make()">Hidden</component></template>
    `);

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias "make()"'
    );
  });

  it('terminates recursive factory analysis while preserving GT provenance', async () => {
    const ordinary = await extract(
      setup(
        'function recurse() { return recurse(); }',
        '<component :is="recurse()">Ordinary</component>'
      )
    );
    const possibleT = await extract(
      setup(
        `import { T } from 'gt-vue';
         function recurse(flag) { return flag ? T : recurse(flag); }`,
        '<component :is="recurse(Boolean(Date.now()))">Hidden</component>'
      )
    );

    expect(ordinary.errors).toEqual([]);
    expect(ordinary.results).toEqual([]);
    expect(possibleT.results).toEqual([]);
    expect(possibleT.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
  });

  it.each([
    [
      'destructured object method factory',
      `const { make } = { make() { return OriginalT; } };
       const LocalT = make();`,
    ],
    [
      'dynamic object default',
      `const source = getSource();
       const { [getKey()]: LocalT = OriginalT } = source;`,
    ],
    [
      'dynamic array default',
      `const source = getSource();
       const [LocalT = OriginalT] = source;`,
    ],
    [
      'for-of assignment',
      `let LocalT = String;
       for (LocalT of [OriginalT]) {}`,
    ],
    [
      'for-of lexical value',
      `let LocalT = String;
       for (const candidate of [OriginalT]) { LocalT = candidate; }`,
    ],
    [
      'destructured for-of lexical value',
      `let LocalT = String;
       for (const { component } of [{ component: OriginalT }]) {
         LocalT = component;
       }`,
    ],
  ])('fails closed for a T alias from %s', async (_name, code) => {
    const output = await extract(
      setup(
        `import { T as OriginalT } from 'gt-vue'; ${code}`,
        '<LocalT>Hidden</LocalT>'
      )
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias "LocalT"'
    );
  });

  it('resolves nested arrays and statically computed destructuring keys', async () => {
    const output = await extract(
      setup(
        `import { T as OriginalT } from 'gt-vue';
         const registry = [[OriginalT]];
         const NestedT = registry[0][0];
         const key = 'ComputedT';
         const { [key]: ComputedT } = { ['Computed' + 'T']: OriginalT };`,
        '<NestedT>Nested</NestedT><ComputedT>Computed</ComputedT>'
      )
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      'Nested',
      'Computed',
    ]);
  });

  it('preserves component identity copied by an array spread', async () => {
    const output = await extract(
      setup(
        `import { T as OriginalT } from 'gt-vue';
         const source = [OriginalT];
         const copy = [...source];
         source[0] = String;
         const [LocalT] = copy;`,
        '<LocalT>Copied</LocalT>'
      )
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual(['Copied']);
  });

  it('distinguishes copied spread values from retained nested references', async () => {
    const copied = await extract(
      setup(
        `import { useGT } from 'gt-vue';
         const config = { context: 'old' };
         const outer = { ...config };
         config.context = 'new';
         const { context } = outer;
         const gt = useGT();
         gt('Copied', { $context: context });`
      )
    );
    const retained = await extract(
      setup(
        `import { useGT } from 'gt-vue';
         const config = { context: 'old' };
         const outer = { config };
         config.context = 'new';
         const { config: { context } } = outer;
         const gt = useGT();
         gt('Retained', { $context: context });`
      )
    );

    expect(copied.errors).toEqual([]);
    expect(copied.results[0]?.metadata.context).toBe('old');
    expect(retained.results).toEqual([]);
    expect(retained.errors.join('\n')).toContain('dynamic $context');
  });

  it.each([
    ['unknown spread', '...unknown'],
    ['unknown computed key', '[unknownKey]: 1'],
  ])(
    'uses order-sensitive certainty around an %s',
    async (_name, unknownEntry) => {
      const leading = await extract(
        crossBlock(
          `const unknown = getUnknown();
           const unknownKey = getKey();
           const kit = { ${unknownEntry}, T, Suspense, Card: String };`
        )
      );
      const trailing = await extract(
        crossBlock(
          `const unknown = getUnknown();
           const unknownKey = getKey();
           const kit = { T, Suspense, Card: String, ${unknownEntry} };`
        )
      );

      expect(leading.errors).toEqual([]);
      expect(leading.results.map(({ source }) => source)).toEqual([
        'Translated',
        [
          { t: 'Suspense', i: 1, c: 'Ready' },
          { t: 'kit.Card', i: 2, c: 'Opaque' },
        ],
      ]);
      expect(trailing.results).toEqual([]);
      expect(trailing.errors.join('\n')).toContain(
        'Could not statically resolve possible gt-vue component alias "kit.T"'
      );
      expect(trailing.errors.join('\n')).toContain(
        'Could not statically resolve component alias "kit.Suspense"'
      );
      expect(trailing.errors.join('\n')).not.toContain('kit.Card');
    }
  );

  it('keeps exact cross-block members through known object and array spreads', async () => {
    const output = await extract(`
      <script>
      import { T } from 'gt-vue';
      import { Suspense } from 'vue';
      const base = { T, Suspense };
      const kit = { ...base, Card: String };
      const list = [...[T]];
      </script>
      <script setup>const keepScriptSetup = true;</script>
      <template>
        <component :is="list[0]">Array</component>
        <kit.T>Object</kit.T>
        <T><kit.Suspense>Ready</kit.Suspense><kit.Card>Opaque</kit.Card></T>
      </template>
    `);

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      'Array',
      'Object',
      [
        { t: 'Suspense', i: 1, c: 'Ready' },
        { t: 'kit.Card', i: 2, c: 'Opaque' },
      ],
    ]);
  });

  it('resolves cross-block members reused by script-setup aliases', async () => {
    const output = await extract(`
      <script>
      import { Suspense } from 'vue';
      const objectRegistry = { Boundary: Suspense };
      const arrayRegistry = [Suspense];
      </script>
      <script setup>
      import { T } from 'gt-vue';
      const { Boundary: ObjectBoundary } = objectRegistry;
      const ArrayBoundary = arrayRegistry[0];
      </script>
      <template>
        <T><ObjectBoundary>Object</ObjectBoundary><ArrayBoundary>Array</ArrayBoundary></T>
      </template>
    `);

    expect(output.errors).toEqual([]);
    expect(output.results[0]?.source).toEqual([
      { t: 'Suspense', i: 1, c: 'Object' },
      { t: 'Suspense', i: 2, c: 'Array' },
    ]);
  });

  it('fails closed when an exported cross-block container can be mutated', async () => {
    const output = await extract(`
      <script>
      import { Suspense } from 'vue';
      export const registry = { Boundary: Suspense };
      </script>
      <script setup>
      import { T } from 'gt-vue';
      const { Boundary } = registry;
      </script>
      <template><T><Boundary>Hidden</Boundary></T></template>
    `);

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve component alias "Boundary"'
    );
  });

  it('rejects a nested getter read that can mutate a selected sibling', async () => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue';
         import { Suspense } from 'vue';
         const registry = {
           Boundary: Suspense,
           nested: {
             get trigger() {
               registry.Boundary = String;
               return true;
             },
           },
         };
         void registry.nested.trigger;
         const { Boundary } = registry;`,
        '<T><Boundary>Hidden</Boundary></T>'
      )
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve component alias "Boundary"'
    );
  });

  it.each([
    [
      'a conditional registry',
      `const flag = Boolean(Date.now());
       const registry = flag ? [T] : [String];`,
      '',
    ],
    [
      'an array with an unknown spread',
      'const registry = [...getItems(), T];',
      '',
    ],
    ['a destructured registry', 'const { registry } = { registry: [T] };', ''],
    ['a definitely assigned registry', 'let registry; registry = [T];', ''],
    [
      'a mutated reactive registry',
      'const registry = reactive([String]); registry.push(T);',
      "import { reactive } from 'vue';",
    ],
    [
      'a reassigned ref registry',
      'const registry = ref([String]); registry.value = [T];',
      "import { ref } from 'vue';",
    ],
    [
      'a conditional computed registry',
      `const flag = Boolean(Date.now());
       const registry = computed(() => flag ? [T] : [String]);`,
      "import { computed } from 'vue';",
    ],
    [
      'a markRaw registry',
      'const registry = markRaw([T]);',
      "import { markRaw } from 'vue';",
    ],
    [
      'a nested ref unwrapped with unref',
      'const registry = unref(ref([T]));',
      "import { ref, unref } from 'vue';",
    ],
    [
      'a local registry factory',
      'const makeRegistry = () => [T];',
      '',
      'makeRegistry()[index]',
    ],
  ])(
    'fails closed when T can be selected from %s',
    async (_name, code, imports, selector = 'registry[index]') => {
      const output = await extract(
        setup(
          `import { T } from 'gt-vue';
           ${imports}
           ${code}
           const index = getIndex();`,
          `<component :is="${selector}">Hidden</component>`
        )
      );

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        'Could not statically resolve possible gt-vue component alias'
      );
    }
  );

  it.each([
    [
      'a conditional nested array',
      `const flag = Boolean(Date.now());
       const registry = flag ? [[T]] : [[String]];`,
    ],
    ['an inserted nested array', 'const registry = []; registry.push([T]);'],
    [
      'a mutated existing nested array',
      'const registry = [[String]]; registry[0].push(T);',
    ],
    ['a mapped nested array', 'const registry = [String].map(() => [T]);'],
    ['a concatenated nested array', 'const registry = [String].concat([[T]]);'],
  ])('preserves selection depth for %s', async (_name, code) => {
    const first = await extract(
      setup(
        `import { T } from 'gt-vue'; ${code}
           const index = getIndex();`,
        '<component :is="registry[index]">Ordinary</component>'
      )
    );
    const second = await extract(
      setup(
        `import { T } from 'gt-vue'; ${code}
           const index = getIndex(); const nestedIndex = getNestedIndex();`,
        '<component :is="registry[index][nestedIndex]">Hidden</component>'
      )
    );
    const third = await extract(
      setup(
        `import { T } from 'gt-vue'; ${code}
           const index = getIndex(); const nestedIndex = getNestedIndex();
           const property = getKey();`,
        '<component :is="registry[index][nestedIndex][property]">Ordinary</component>'
      )
    );

    expect(first.errors).toEqual([]);
    expect(first.results).toEqual([]);
    expect(second.results).toEqual([]);
    expect(second.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
    expect(third.errors).toEqual([]);
    expect(third.results).toEqual([]);
  });

  it.each([
    [
      'mutation through an alias',
      'const registry = [String]; const alias = registry; alias.push(T);',
    ],
    [
      'reassignment after an initializer',
      'let registry = [String]; registry = [T];',
    ],
    [
      'Object.assign',
      'const registry = { ordinary: String }; Object.assign(registry, { translated: T });',
    ],
    [
      'Reflect.set',
      "const registry = { ordinary: String }; Reflect.set(registry, 'translated', T);",
    ],
    [
      'a copy after source mutation',
      'const source = [String]; source.push(T); const registry = [...source];',
    ],
  ])('tracks T introduced by %s', async (_name, code) => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue'; ${code}
         const index = getIndex();`,
        '<component :is="registry[index]">Hidden</component>'
      )
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
  });

  it.each([
    [
      'an Options setup conditional registry',
      `import { T } from 'gt-vue';
       export default {
         setup() {
           const flag = Boolean(Date.now());
           return { registry: flag ? [T] : [String], index: getIndex() };
         },
       };`,
      'registry[index]',
    ],
    [
      'an Options setup alias mutation',
      `import { T } from 'gt-vue';
       export default {
         setup() {
           const registry = [String];
           const alias = registry;
           alias.push(T);
           return { registry, index: getIndex() };
         },
       };`,
      'registry[index]',
    ],
    [
      'an Options setup computed registry',
      `import { computed } from 'vue';
       import { T } from 'gt-vue';
       export default {
         setup() {
           const flag = Boolean(Date.now());
           const registry = computed(() => flag ? [T] : [String]);
           return { registry, index: getIndex() };
         },
       };`,
      'registry[index]',
    ],
    [
      'an Options computed registry',
      `import { T } from 'gt-vue';
       export default {
         data: () => ({ index: getIndex() }),
         computed: {
           registry() {
             return Boolean(Date.now()) ? [T] : [String];
           },
         },
       };`,
      'registry[index]',
    ],
    [
      'an Options registry factory method',
      `import { T } from 'gt-vue';
       export default {
         data: () => ({ index: getIndex() }),
         methods: { makeRegistry() { return [T, String]; } },
       };`,
      'makeRegistry()[index]',
    ],
  ])('tracks T through %s', async (_name, script, selector) => {
    const output = await extract(
      `<script>${script}</script>
       <template><component :is="${selector}">Hidden</component></template>`
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
  });

  it.each([
    [
      'an exact container copied with slice',
      'const base = [T];',
      'const registry = base.slice();',
    ],
    [
      'a conditional normal-script container',
      `const flag = Boolean(Date.now());
       const base = flag ? [T] : [String];`,
      'const registry = base;',
    ],
  ])(
    'tracks T across script blocks through %s',
    async (_name, normalDeclaration, setupDeclaration) => {
      const output = await extract(`
        <script>
        import { T } from 'gt-vue';
        ${normalDeclaration}
        </script>
        <script setup>
        ${setupDeclaration}
        const index = getIndex();
        </script>
        <template><component :is="registry[index]">Hidden</component></template>
      `);

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        'Could not statically resolve possible gt-vue component alias'
      );
    }
  );

  it.each([
    ['flat', 'const registry = [[T]].flat();'],
    ['flatMap', 'const registry = [String].flatMap(() => [T]);'],
    [
      'reduce',
      'const registry = [[T]].reduce((result, value) => result.concat(value), []);',
    ],
    [
      'splice return',
      'const source = [T, String]; const registry = source.splice(0, 1);',
    ],
    [
      'Object.values',
      'const registry = Object.values({ translated: T, ordinary: String });',
    ],
    ['an identity map', 'const registry = [T, String].map((value) => value);'],
  ])('tracks T through the bound %s transform', async (_name, code) => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue'; ${code}
         const index = getIndex();`,
        '<component :is="registry[index]">Hidden</component>'
      )
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
  });

  it('preserves the exact leaf depth of a bound reduce flatten', async () => {
    const source = `import { T } from 'gt-vue';
      const registry = [[T]].reduce(
        (accumulator, value) => accumulator.concat(value),
        []
      );
      const first = getIndex(); const second = getIndex();`;
    const direct = await extract(
      setup(source, '<component :is="registry[first]">Hidden</component>')
    );
    const below = await extract(
      setup(
        source,
        '<component :is="registry[first][second]">Ordinary</component>'
      )
    );

    expect(direct.results).toEqual([]);
    expect(direct.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
    expect(below.errors).toEqual([]);
    expect(below.results).toEqual([]);
  });

  it('preserves Object.entries tuple depth', async () => {
    const script = `import { T } from 'gt-vue';
      const registry = Object.entries({ translated: T });
      const index = getIndex();`;
    const tuple = await extract(
      setup(script, '<component :is="registry[index]">Ordinary</component>')
    );
    const value = await extract(
      setup(script, '<component :is="registry[index][1]">Hidden</component>')
    );

    expect(tuple.errors).toEqual([]);
    expect(tuple.results).toEqual([]);
    expect(value.results).toEqual([]);
    expect(value.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
  });

  it('preserves Object.entries depth when its object is a binding', async () => {
    const script = `import { T } from 'gt-vue';
      const source = { translated: T };
      const registry = Object.entries(source);
      const index = getIndex();`;
    const tuple = await extract(
      setup(script, '<component :is="registry[index]">Ordinary</component>')
    );
    const value = await extract(
      setup(script, '<component :is="registry[index][1]">Hidden</component>')
    );

    expect(tuple.errors).toEqual([]);
    expect(tuple.results).toEqual([]);
    expect(value.results).toEqual([]);
    expect(value.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
  });

  it.each([
    [
      'an arrow identity',
      'const identity = (value) => value; const registry = identity([T, String]);',
    ],
    [
      'a function identity',
      'function identity(value) { return value; } const registry = identity([T, String]);',
    ],
    [
      'a copied argument',
      'const copy = (value) => [...value]; const registry = copy([T, String]);',
    ],
    [
      'a sliced argument',
      'const copy = (value) => value.slice(); const registry = copy([T, String]);',
    ],
    [
      'a conditional argument',
      `const identity = (value) => value;
       const registry = identity(Boolean(Date.now()) ? [T] : [String]);`,
    ],
    [
      'a destructured argument',
      'const values = ({ registry }) => registry; const registry = values({ registry: [T] });',
    ],
  ])('tracks T across %s call boundary', async (_name, code) => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue'; ${code}
         const index = getIndex();`,
        '<component :is="registry[index]">Hidden</component>'
      )
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
  });

  it('does not taint an ordinary value across a local call boundary', async () => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue';
         const identity = (value) => value;
         const registry = identity([String]);
         const index = getIndex();`,
        '<component :is="registry[index]">Ordinary</component>'
      )
    );

    expect(output.errors).toEqual([]);
    expect(output.results).toEqual([]);
  });

  it.each([
    ['map callback', 'const registry = [String].map(() => T);'],
    ['Array.from mapper', 'const registry = Array.from([String], () => T);'],
    [
      'Object.assign return value',
      'const registry = Object.assign({}, { translated: T });',
    ],
  ])('tracks T created by a %s', async (_name, code) => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue'; ${code}
         const index = getIndex();`,
        '<component :is="registry[index]">Hidden</component>'
      )
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
  });

  it.each([
    ['map callback', 'const registry = [T].map(() => String);'],
    ['Array.from mapper', 'const registry = Array.from([T], () => String);'],
  ])('does not retain T erased by a %s', async (_name, code) => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue'; ${code}
         const index = getIndex();`,
        '<component :is="registry[index]">Ordinary</component>'
      )
    );

    expect(output.errors).toEqual([]);
    expect(output.results).toEqual([]);
  });

  it.each([
    [
      'map wrapping its parameter',
      'const registry = [T].map((value) => [value]);',
      'registry[index][nested]',
    ],
    [
      'Array.from wrapping its parameter',
      'const registry = Array.from([T], (value) => [value]);',
      'registry[index][nested]',
    ],
    [
      'flatMap wrapping its parameter',
      'const registry = [T].flatMap((value) => [value]);',
      'registry[index]',
    ],
    [
      'Object.entries mapped to its value',
      `const registry = Object.entries({ translated: T })
         .map(([, value]) => value);`,
      'registry[index]',
    ],
  ])('preserves T through %s', async (_name, code, selector) => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue'; ${code}
         const index = getIndex(); const nested = getIndex();`,
        `<component :is="${selector}">Hidden</component>`
      )
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
  });

  it.each([
    [
      'the map source and index parameters',
      `const registry = [T].map((_value, index, source) => source[index]);`,
    ],
    [
      'a named map source callback',
      `function select(_value, index, source) { return source[index]; }
       const registry = [T].map(select);`,
    ],
    [
      'callback rest parameters',
      `const registry = [T].map((...args) => args[0]);`,
    ],
    [
      'an Array.from index closure',
      `const source = [T];
       const registry = Array.from(source, (_value, index) => source[index]);`,
    ],
  ])('preserves T through %s', async (_name, code) => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue'; ${code}
         const index = getIndex();`,
        '<component :is="registry[index]">Hidden</component>'
      )
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
  });

  it.each([
    ['with', 'const registry = [String].with(0, T);', 'registry[index]'],
    [
      'nested with',
      'const registry = [[String]].with(0, [T]);',
      'registry[index][nested]',
    ],
    [
      'toSpliced',
      'const registry = [String].toSpliced(0, 0, T);',
      'registry[index]',
    ],
    [
      'nested toSpliced',
      'const registry = [[String]].toSpliced(0, 0, [T]);',
      'registry[index][nested]',
    ],
  ])('tracks inserted T values through %s', async (_name, code, selector) => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue'; ${code}
         const index = getIndex(); const nested = getIndex();`,
        `<component :is="${selector}">Hidden</component>`
      )
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
  });

  it('tracks a component returned by reduce', async () => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue';
         const registry = [String];
         const selected = registry.reduce(() => T, String);`,
        '<component :is="selected">Hidden</component>'
      )
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
  });

  it.each([
    [
      'a singleton without an initial value',
      'const selected = [T].reduce(() => String);',
    ],
    [
      'the current value',
      'const selected = [String, T].reduce((_accumulator, value) => value);',
    ],
    [
      'the reverse current value',
      'const selected = [T, String].reduceRight((_accumulator, value) => value);',
    ],
  ])('tracks T returned by reduce through %s', async (_name, code) => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue'; ${code}`,
        '<component :is="selected">Hidden</component>'
      )
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
  });

  it('does not retain an initial T erased by reduce', async () => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue';
         const selected = [String].reduce(() => String, T);`,
        '<component :is="selected">Ordinary</component>'
      )
    );

    expect(output.errors).toEqual([]);
    expect(output.results).toEqual([]);
  });

  it.each([
    [
      'arrow rest arguments',
      'const collect = (...values) => values; const registry = collect(T, String);',
    ],
    [
      'unknown imported transform',
      `import { transform } from './transform';
       const registry = transform([T, String]);`,
    ],
  ])('fails closed across %s', async (_name, code) => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue'; ${code}
         const index = getIndex();`,
        '<component :is="registry[index]">Hidden</component>'
      )
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
  });

  it('respects explicit flat depths', async () => {
    const depthZero = await extract(
      setup(
        `import { T } from 'gt-vue';
         const registry = [[T]].flat(0);
         const index = getIndex();`,
        '<component :is="registry[index]">Ordinary</component>'
      )
    );
    const depthZeroNested = await extract(
      setup(
        `import { T } from 'gt-vue';
         const registry = [[T]].flat(0);
         const index = getIndex(); const nested = getIndex();`,
        '<component :is="registry[index][nested]">Hidden</component>'
      )
    );
    const depthTwo = await extract(
      setup(
        `import { T } from 'gt-vue';
         const registry = [[[T]]].flat(2);
         const index = getIndex();`,
        '<component :is="registry[index]">Hidden</component>'
      )
    );

    expect(depthZero.errors).toEqual([]);
    expect(depthZero.results).toEqual([]);
    expect(depthZeroNested.results).toEqual([]);
    expect(depthZeroNested.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
    expect(depthTwo.results).toEqual([]);
    expect(depthTwo.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
  });

  it.each([
    ['flat', '[[T]].flat()[index]'],
    ['map', '[String].map(() => T)[index]'],
    ['flatMap', '[String].flatMap(() => [T])[index]'],
    ['Object.values', 'Object.values({ translated: T })[index]'],
    ['Object.entries value', 'Object.entries({ translated: T })[index][1]'],
  ])('tracks T through an inline %s transform', async (_name, selector) => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue'; const index = getIndex();`,
        `<component :is="${selector}">Hidden</component>`
      )
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
  });

  it('does not retain T erased by an inline map', async () => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue'; const index = getIndex();`,
        '<component :is="[T].map(() => String)[index]">Ordinary</component>'
      )
    );

    expect(output.errors).toEqual([]);
    expect(output.results).toEqual([]);
  });

  it.each([
    ['map identity', 'Component in [T].map((value) => value)', 'Component'],
    [
      'flatMap wrapped identity',
      'Component in [T].flatMap((value) => [value])',
      'Component',
    ],
    ['flat', 'Component in [[T]].flat()', 'Component'],
    [
      'Array.from mapper',
      'Component in Array.from([String], () => T)',
      'Component',
    ],
    [
      'Object.entries tuple member',
      'entry in Object.entries({ translated: T })',
      'entry[1]',
    ],
    [
      'Object.entries destructuring',
      '[, Component] in Object.entries({ translated: T })',
      'Component',
    ],
    ['with insertion', 'Component in [String].with(0, T)', 'Component'],
    [
      'toSpliced insertion',
      'Component in [String].toSpliced(0, 0, T)',
      'Component',
    ],
  ])('tracks T through a v-for %s', async (_name, loop, selector) => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue';`,
        `<component v-for="${loop}" :is="${selector}">Hidden</component>`
      )
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
  });

  it.each([
    ['map wrapper', 'row in [T].map((value) => [value])', 'Component in row'],
    [
      'Object.values',
      'row in Object.values({ translated: [T] })',
      'Component in row',
    ],
    ['Array.from', 'row in Array.from([[T]])', 'Component in row'],
  ])(
    'tracks T through nested v-for aliases from %s',
    async (_name, outer, inner) => {
      const output = await extract(
        setup(
          `import { T } from 'gt-vue';`,
          `<template v-for="${outer}">
           <component v-for="${inner}" :is="Component">Hidden</component>
         </template>`
        )
      );

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        'Could not statically resolve possible gt-vue component alias'
      );
    }
  );

  it('tracks an inline T argument passed to concat', async () => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue';
         const source = [String]; const index = getIndex();`,
        '<component :is="source.concat(T)[index]">Hidden</component>'
      )
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
  });

  it.each([
    ['slice', "const registry = ['T', 'div'].slice();"],
    ['concat', "const registry = ['div'].concat('T');"],
    ['Array.from', "const registry = Array.from(['T', 'div']);"],
    ['push mutation', "const registry = ['div']; registry.push('T');"],
    ['reassignment', "let registry = ['div']; registry = ['T'];"],
    [
      'conditional arrays',
      "const registry = Boolean(Date.now()) ? ['T'] : ['div'];",
    ],
    [
      'computed conditional arrays',
      "const registry = computed(() => Boolean(Date.now()) ? ['T'] : ['div']);",
      "import { computed } from 'vue';",
    ],
    ['identity map', "const registry = ['T', 'div'].map((value) => value);"],
  ])(
    'tracks a registered T name through %s',
    async (_name, code, extraImport = '') => {
      const output = await extract(`
        <script>
        import { T } from 'gt-vue';
        export default { components: { T } };
        </script>
        <script setup>
        ${extraImport}
        ${code}
        const index = getIndex();
        </script>
        <template><component :is="registry[index]">Hidden</component></template>
      `);

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        'Could not statically resolve possible gt-vue component alias'
      );
    }
  );

  it.each([
    ['constant map', "const registry = ['div'].map(() => 'T');"],
    ['flat', "const registry = [['T']].flat();"],
    ['flatMap', "const registry = ['div'].flatMap(() => ['T']);"],
    [
      'copy after mutation',
      "const source = ['div']; source.push('T'); const registry = [...source];",
    ],
    [
      'Object.values binding',
      "const source = { translated: 'T' }; const registry = Object.values(source);",
    ],
    [
      'Object.entries binding',
      "const source = { translated: 'T' }; const registry = Object.entries(source);",
      'registry[index][1]',
    ],
    [
      'spread-copy function',
      "const copy = (value) => [...value]; const registry = copy(['T']);",
    ],
    [
      'unknown imported transform',
      "import { transform } from './transform'; const registry = transform(['T']);",
    ],
    [
      'Object.assign return',
      "const registry = Object.assign({}, { translated: 'T' });",
    ],
  ])(
    'tracks a registered T name through %s',
    async (_name, code, selector = 'registry[index]') => {
      const output = await extract(`
        <script>
        import { T } from 'gt-vue';
        export default { components: { T } };
        </script>
        <script setup>
        ${code}
        const index = getIndex();
        </script>
        <template><component :is="${selector}">Hidden</component></template>
      `);

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        'Could not statically resolve possible gt-vue component alias'
      );
    }
  );

  it.each([
    ['a singleton', '[T].reduce(() => String)'],
    ['the current value', '[String, T].reduce((_accumulator, value) => value)'],
    [
      'the first accumulator',
      '[T, String].reduce((accumulator) => accumulator)',
    ],
    [
      'the reverse current value',
      '[T, String].reduceRight((_accumulator, value) => value)',
    ],
  ])('evaluates inline reduce through %s', async (_name, selector) => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue';`,
        `<component :is="${selector}">Reduced</component>`
      )
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual(['Reduced']);
  });

  it('extracts T from an inline reduce callback-created container', async () => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue';`,
        '<component :is="[String].reduce(() => [T], [])[0]">Reduced</component>'
      )
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual(['Reduced']);
  });

  it.each([
    [
      'a concatenated container',
      '[[T]].reduce((accumulator, value) => accumulator.concat(value), [])[index]',
    ],
    ['copyWithin', '[String, T].copyWithin(0, 1)[index]'],
    ['fill', '[String].fill(T)[index]'],
    ['nested fill', '[String].fill([T])[index][nested]'],
    [
      'Object.entries with a bound source',
      'Object.entries(source)[index][1]',
      'const source = { translated: T };',
    ],
  ])(
    'does not silently lose T through inline %s',
    async (_name, selector, declaration = '') => {
      const output = await extract(
        setup(
          `import { T } from 'gt-vue'; ${declaration}
           const index = getIndex(); const nested = getIndex();`,
          `<component :is="${selector}">Hidden</component>`
        )
      );

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        'Could not statically resolve possible gt-vue component alias'
      );
    }
  );

  it.each([
    'Object.entries(source)[index]',
    'Object.entries(source)[index][0]',
  ])(
    'preserves the ordinary Object.entries tuple projection %s',
    async (selector) => {
      const output = await extract(
        setup(
          `import { T } from 'gt-vue';
           const source = { translated: T }; const index = getIndex();`,
          `<component :is="${selector}">Ordinary</component>`
        )
      );

      expect(output.errors).toEqual([]);
      expect(output.results).toEqual([]);
    }
  );

  it('does not retain an inline reduce initial value erased by its callback', async () => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue';`,
        '<component :is="[String].reduce(() => String, T)">Ordinary</component>'
      )
    );

    expect(output.errors).toEqual([]);
    expect(output.results).toEqual([]);
  });

  it.each([
    [
      'map rest source/index arguments',
      'const registry = [T].map((...args) => args[2][args[1]]);',
    ],
    [
      'flatMap rest source/index arguments',
      'const registry = [T].flatMap((...args) => [args[2][args[1]]]);',
    ],
    [
      'Array.from rest index arguments',
      'const source = [T]; const registry = Array.from(source, (...args) => source[args[1]]);',
    ],
    [
      'a map source alias',
      'const source = [T], alias = source; const registry = source.map((_value, index) => alias[index]);',
    ],
    [
      'a flatMap source alias',
      'const source = [T], alias = source; const registry = source.flatMap((_value, index) => [alias[index]]);',
    ],
    [
      'an Array.from source alias',
      'const source = [T], alias = source; const registry = Array.from(source, (_value, index) => alias[index]);',
    ],
    [
      'an Array.from rest source alias',
      'const source = [T], alias = source; const registry = Array.from(source, (...args) => alias[args[1]]);',
    ],
    [
      'a named source callback',
      'const source = [T]; function pick(_value, index) { return source[index]; } const registry = source.map(pick);',
    ],
  ])('tracks T through %s', async (_name, code) => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue'; ${code} const index = getIndex();`,
        '<component :is="registry[index]">Hidden</component>'
      )
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
  });

  it.each([
    [
      'map',
      'const registry = [String].map(function () { return this.Component; }, { Component: T });',
    ],
    [
      'flatMap',
      'const registry = [String].flatMap(function () { return [this.Component]; }, { Component: T });',
    ],
    [
      'Array.from',
      'const registry = Array.from([String], function () { return this.Component; }, { Component: T });',
    ],
  ])('tracks a mapper thisArg through %s', async (_name, code) => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue'; ${code} const index = getIndex();`,
        '<component :is="registry[index]">Hidden</component>'
      )
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
  });

  it('does not bind a mapper thisArg into an arrow function', async () => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue';
         const registry = [String].map(() => String, { Component: T });
         const index = getIndex();`,
        '<component :is="registry[index]">Ordinary</component>'
      )
    );

    expect(output.errors).toEqual([]);
    expect(output.results).toEqual([]);
  });

  it.each([
    ['slice', 'const registry = [T, String].slice(1);'],
    ['filter', 'const registry = [T].filter(() => false);'],
    ['splice return', 'const registry = [String, T].splice(0, 1);'],
    ['toSpliced deletion', 'const registry = [T, String].toSpliced(0, 1);'],
    ['toSpliced replacement', 'const registry = [T].toSpliced(0, 1, String);'],
    ['with replacement', 'const registry = [T].with(0, String);'],
    ['fill replacement', 'const registry = [T].fill(String);'],
  ])(
    'does not retain T deterministically erased by %s',
    async (_name, code) => {
      const output = await extract(
        setup(
          `import { T } from 'gt-vue'; ${code} const index = getIndex();`,
          '<component :is="registry[index]">Ordinary</component>'
        )
      );

      expect(output.errors).toEqual([]);
      expect(output.results).toEqual([]);
    }
  );

  it.each([
    [
      'array reassignment',
      'let registry = [T]; registry = [String]; const key = getIndex();',
    ],
    [
      'pop followed by an ordinary push',
      'const registry = [T]; registry.pop(); registry.push(String); const key = getIndex();',
    ],
    [
      'splice replacement',
      'const registry = [T]; registry.splice(0, 1, String); const key = getIndex();',
    ],
    [
      'object member replacement',
      'const registry = { x: T }; registry.x = String; const key = getKey();',
    ],
    [
      'Object.assign replacement',
      'const registry = { x: T }; Object.assign(registry, { x: String }); const key = getKey();',
    ],
    [
      'member replacement through an alias',
      'const registry = [T]; const alias = registry; alias[0] = String; const key = getIndex();',
    ],
    [
      'length truncation through an alias',
      'const registry = [T]; const alias = registry; alias.length = 0; const key = getIndex();',
    ],
    [
      'pop through an alias',
      'const registry = [T]; const alias = registry; alias.pop(); const key = getIndex();',
    ],
  ])('uses the final ordinary state after %s', async (_name, code) => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue'; ${code}`,
        '<component :is="registry[key]">Ordinary</component>'
      )
    );

    expect(output.errors).toEqual([]);
    expect(output.results).toEqual([]);
  });

  it('does not merge an alias identity across root reassignment', async () => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue';
         let registry = [T]; const retained = registry; registry = [String];
         const key = getIndex();`,
        '<component :is="retained[key]">Hidden</component>'
      )
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
  });

  it('uses a mutable binding value assigned before an alias is captured', async () => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue';
         let registry = [T]; registry = [String]; const retained = registry;
         const key = getIndex();`,
        '<component :is="retained[key]">Ordinary</component>'
      )
    );

    expect(output.errors).toEqual([]);
    expect(output.results).toEqual([]);
  });

  it('fails closed for a conditional write before an alias is captured', async () => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue';
         let registry = [String]; if (getFlag()) registry = [T];
         const retained = registry; const key = getIndex();`,
        '<component :is="retained[key]">Hidden</component>'
      )
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
  });

  it.each([
    [
      'readonly member assignment',
      'const registry = readonly([String]); registry[0] = T;',
    ],
    ['readonly push', 'const registry = readonly([String]); registry.push(T);'],
    [
      'readonly alias push',
      'const registry = readonly([String]); const alias = registry; alias.push(T);',
    ],
    [
      'shallowReadonly alias assignment',
      'const registry = shallowReadonly([String]); const alias = registry; alias[0] = T;',
    ],
  ])('ignores a blocked %s', async (_name, code) => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue'; import { readonly, shallowReadonly } from 'vue'; ${code} const key = getIndex();`,
        '<component :is="registry[key]">Ordinary</component>'
      )
    );

    expect(output.errors).toEqual([]);
    expect(output.results).toEqual([]);
  });

  it('retains T when readonly blocks its replacement', async () => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue'; import { readonly } from 'vue';
         const registry = readonly([T]); registry[0] = String; const key = getIndex();`,
        '<component :is="registry[key]">Hidden</component>'
      )
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
  });

  it('tracks writes through the raw source behind readonly', async () => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue'; import { readonly } from 'vue';
         const raw = [String]; const registry = readonly(raw); raw[0] = T; const key = getIndex();`,
        '<component :is="registry[key]">Hidden</component>'
      )
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
  });

  it.each(['alias[0] = String;', 'alias.length = 0;', 'alias.pop();'])(
    'replays raw alias erasure through readonly: %s',
    async (mutation) => {
      const output = await extract(
        setup(
          `import { T } from 'gt-vue'; import { readonly } from 'vue';
         const raw = [T]; const alias = raw; ${mutation}
         const registry = readonly(raw); const key = getIndex();`,
          '<component :is="registry[key]">Ordinary</component>'
        )
      );

      expect(output.errors).toEqual([]);
      expect(output.results).toEqual([]);
    }
  );

  it('preserves readonly copy timing for later raw mutation', async () => {
    const output = await extract(
      setup(
        `import { T } from 'gt-vue'; import { readonly } from 'vue';
         const raw = [String]; const registry = readonly(raw.slice());
         raw[0] = T; const key = getIndex();`,
        '<component :is="registry[key]">Ordinary</component>'
      )
    );

    expect(output.errors).toEqual([]);
    expect(output.results).toEqual([]);
  });

  it('preserves the exact leaf depth for flat(Infinity)', async () => {
    const script = `import { T } from 'gt-vue';
      const registry = [[[T]]].flat(Infinity);
      const index = getIndex(); const nested = getIndex();`;
    const exact = await extract(
      setup(script, '<component :is="registry[index]">Hidden</component>')
    );
    const belowLeaf = await extract(
      setup(
        script,
        '<component :is="registry[index][nested]">Ordinary</component>'
      )
    );

    expect(exact.results).toEqual([]);
    expect(exact.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
    expect(belowLeaf.errors).toEqual([]);
    expect(belowLeaf.results).toEqual([]);
  });

  it('coerces a NaN flat depth to zero', async () => {
    const script = `import { T } from 'gt-vue';
      const registry = [[[T]]].flat(NaN);
      const index = getIndex(); const nested = getIndex(); const leaf = getIndex();`;
    const depthOne = await extract(
      setup(script, '<component :is="registry[index]">Ordinary</component>')
    );
    const depthTwo = await extract(
      setup(
        script,
        '<component :is="registry[index][nested]">Ordinary</component>'
      )
    );
    const exact = await extract(
      setup(
        script,
        '<component :is="registry[index][nested][leaf]">Hidden</component>'
      )
    );

    expect(depthOne.errors).toEqual([]);
    expect(depthOne.results).toEqual([]);
    expect(depthTwo.errors).toEqual([]);
    expect(depthTwo.results).toEqual([]);
    expect(exact.results).toEqual([]);
    expect(exact.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
  });

  it('preserves inline flat(Infinity) leaf depth', async () => {
    const script = `import { T } from 'gt-vue';
      const index = getIndex(); const nested = getIndex();`;
    const exact = await extract(
      setup(
        script,
        '<component :is="[[[T]]].flat(Infinity)[index]">Hidden</component>'
      )
    );
    const belowLeaf = await extract(
      setup(
        script,
        '<component :is="[[[T]]].flat(Infinity)[index][nested]">Ordinary</component>'
      )
    );

    expect(exact.results).toEqual([]);
    expect(exact.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
    expect(belowLeaf.errors).toEqual([]);
    expect(belowLeaf.results).toEqual([]);
  });

  it('preserves inline flat(NaN) leaf depth', async () => {
    const script = `import { T } from 'gt-vue';
      const index = getIndex(); const nested = getIndex(); const leaf = getIndex();`;
    const depthOne = await extract(
      setup(
        script,
        '<component :is="[[[T]]].flat(NaN)[index]">Ordinary</component>'
      )
    );
    const depthTwo = await extract(
      setup(
        script,
        '<component :is="[[[T]]].flat(NaN)[index][nested]">Ordinary</component>'
      )
    );
    const exact = await extract(
      setup(
        script,
        '<component :is="[[[T]]].flat(NaN)[index][nested][leaf]">Hidden</component>'
      )
    );

    expect(depthOne.errors).toEqual([]);
    expect(depthOne.results).toEqual([]);
    expect(depthTwo.errors).toEqual([]);
    expect(depthTwo.results).toEqual([]);
    expect(exact.results).toEqual([]);
    expect(exact.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
  });

  it.each([
    ['map rest', 'Component in [T].map((...args) => args[0])', 'Component'],
    [
      'nested map rest',
      'row in [[T]].map((...args) => args[0])',
      'Component in row',
    ],
    [
      'reduce flatten',
      'Component in [[T]].reduce((accumulator, value) => accumulator.concat(value), [])',
      'Component',
    ],
    ['copyWithin', 'Component in [String, T].copyWithin(0, 1)', 'Component'],
    ['fill', 'Component in [String].fill(T)', 'Component'],
  ])('tracks T through a v-for %s', async (name, outerLoop, selector) => {
    const template =
      name === 'nested map rest'
        ? `<template v-for="${outerLoop}"><component v-for="${selector}" :is="Component">Hidden</component></template>`
        : `<component v-for="${outerLoop}" :is="${selector}">Hidden</component>`;
    const output = await extract(
      setup(`import { T } from 'gt-vue';`, template)
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
  });

  it('does not retain a registered T name erased by map', async () => {
    const output = await extract(`
      <script>
      import { T } from 'gt-vue';
      export default { components: { T } };
      </script>
      <script setup>
      const registry = ['T'].map(() => 'div');
      const index = getIndex();
      </script>
      <template><component :is="registry[index]">Ordinary</component></template>
    `);

    expect(output.errors).toEqual([]);
    expect(output.results).toEqual([]);
  });
});

function setup(script: string, template = '<div />'): string {
  return `<script setup>${script}</script><template>${template}</template>`;
}

function crossBlock(declaration: string): string {
  return `
    <script>
    import { T } from 'gt-vue';
    import { Suspense } from 'vue';
    ${declaration}
    </script>
    <script setup>const keepScriptSetup = true;</script>
    <template>
      <kit.T>Translated</kit.T>
      <T><kit.Suspense>Ready</kit.Suspense><kit.Card>Opaque</kit.Card></T>
    </template>
  `;
}

async function extract(source: string) {
  return extractFromVueSource(source, '/fixtures/SelectorProvenance.vue', {
    projectRoot: '/fixtures',
  });
}
