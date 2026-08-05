import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from '../../index.js';

describe('Vue script provenance soundness', () => {
  it('extracts nested translators and script-side ref/computed msg aliases', async () => {
    const output = await extract(`
      <script setup>
      import { computed, ref } from 'vue';
      import { msg, useGT, useMessages } from 'gt-vue';
      const baseGT = useGT();
      const baseM = useMessages();
      const nested = { deep: { gt: baseGT, m: baseM, msg } };
      const msgRef = ref(msg);
      const msgComputed = computed(() => msg);
      msgRef.value('Ref msg', { $context: 'ref-msg' });
      msgComputed.value('Computed msg', { $context: 'computed-msg' });
      </script>
      <template>
        {{ nested.deep.gt('Nested gt', { $context: 'nested-gt' }) }}
        {{ nested.deep.m('Nested raw m', { $context: 'nested-m' }) }}
      </template>
    `);

    expect(output.errors).toEqual([]);
    expect(
      output.results.map(({ metadata, source }) => [source, metadata.context])
    ).toEqual([
      ['Ref msg', 'ref-msg'],
      ['Computed msg', 'computed-msg'],
      ['Nested gt', 'nested-gt'],
      ['Nested raw m', 'nested-m'],
    ]);
  });

  it('preserves sibling translators after calling a known nested msg leaf', async () => {
    const output = await extract(`
      <script setup>
      import { msg, useGT, useMessages } from 'gt-vue';
      const baseGT = useGT();
      const baseM = useMessages();
      const nested = { deep: { gt: baseGT, m: baseM, msg } };
      const messages = { nested: nested.deep.msg('Nested msg') };
      </script>
      <template>
        {{ nested.deep.gt('Nested gt') }}
        {{ nested.deep.m('Nested m') }}
        {{ messages.nested }}
      </template>
    `);

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      'Nested msg',
      'Nested gt',
      'Nested m',
    ]);
  });

  it('still invalidates siblings after calling an arbitrary mutating method', async () => {
    const output = await extract(`
      <script setup>
      import { useGT } from 'gt-vue';
      const baseGT = useGT();
      const nested = {
        deep: {
          gt: baseGT,
          mutate() { nested.deep.gt = String; },
        },
      };
      nested.deep.mutate();
      </script>
      <template>{{ nested.deep.gt('Not translated') }}</template>
    `);

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue translation function alias'
    );
  });

  it('recognizes an ordinary replacement of a ref-held msg function', async () => {
    const output = await extract(`
      <script setup>
        import { ref } from 'vue';
        import { msg } from 'gt-vue';
        const msgRef = ref(msg);
        msgRef.value = String;
        msgRef.value('Not a message');
      </script>
    `);

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
  });

  it('extracts a ref-held msg call that precedes a later replacement', async () => {
    const output = await extract(`
      <script setup>
      import { ref } from 'vue';
      import { msg } from 'gt-vue';
      const msgRef = ref(msg);
      msgRef.value('Before replacement');
      msgRef.value = String;
      </script>
    `);

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      'Before replacement',
    ]);
  });

  it.each([
    ['gt', 'useGT()', 'Getter gt'],
    ['m', 'useMessages()', 'Getter messages'],
    ['message', 'msg', 'Getter msg'],
  ])(
    'fails closed for a getter-returned %s function',
    async (name, value, source) => {
      const output = await extract(
        setup(
          `
          import { msg, useGT, useMessages } from 'gt-vue';
          const kit = { get ${name}() { return ${value}; } };
          `,
          `{{ kit.${name}('${source}') }}`
        )
      );

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        'Could not statically resolve possible gt-vue translation function alias'
      );
    }
  );

  it.each([
    ['gt', 'useGT()', 'Getter gt'],
    ['m', 'useMessages()', 'Getter messages'],
    ['message', 'msg', 'Getter msg'],
  ])(
    'fails closed for a script-called getter-returned %s function',
    async (name, value, source) => {
      const output = await extract(`
        <script setup>
        import { msg, useGT, useMessages } from 'gt-vue';
        const kit = { get ${name}() { return ${value}; } };
        kit.${name}('${source}');
        </script>
      `);

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        'Could not statically resolve possible gt-vue string function alias'
      );
    }
  );

  it.each([
    {
      name: 'template msg getter snapshot',
      importName: 'msg',
      initial: 'msg',
      member: 'message',
      template: `{{ kit.message('Template msg snapshot') }}`,
    },
    {
      name: 'template gt getter snapshot',
      importName: 'useGT',
      initial: 'useGT()',
      member: 'gt',
      template: `{{ kit.gt('Template gt snapshot') }}`,
    },
  ])('fails closed for a $name', async (testCase) => {
    const output = await extract(
      setup(
        `
        import { ${testCase.importName} } from 'gt-vue';
        let current = ${testCase.initial};
        const kit = {
          get ${testCase.member}() {
            const selected = current;
            current = String;
            return selected;
          },
        };
        `,
        testCase.template
      )
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue translation function alias'
    );
  });

  it('fails closed for a script-called stateful getter snapshot', async () => {
    const output = await extract(`
      <script setup>
      import { useGT } from 'gt-vue';
      let current = useGT();
      const kit = {
        get gt() {
          const selected = current;
          current = String;
          return selected;
        },
      };
      kit.gt('Script gt snapshot');
      kit.gt('Ordinary second call');
      </script>
    `);

    expect(output.results).toEqual([]);
    expect(output.errors).toHaveLength(1);
    expect(output.errors[0]).toContain(
      'Could not statically resolve possible gt-vue string function alias "kit.gt"'
    );
  });

  it.each([
    [
      'reactive object',
      'reactive',
      'reactive({ translated: T, ordinary: String })',
    ],
    [
      'shallowReactive object',
      'shallowReactive',
      'shallowReactive({ translated: T, ordinary: String })',
    ],
    ['readonly array', 'readonly', 'readonly([T, String])'],
    [
      'shallowReadonly array',
      'shallowReadonly',
      'shallowReadonly([T, String])',
    ],
    ['ref array', 'ref', 'ref([T, String])'],
    ['shallowRef array', 'shallowRef', 'shallowRef([T, String])'],
    ['computed array', 'computed', 'computed(() => [T, String])'],
  ])(
    'keeps a %s non-component root while tracking its selected members',
    async (_name, wrapper, initializer) => {
      const script = `
        import { ${wrapper} } from 'vue';
        import { T } from 'gt-vue';
        const registry = ${initializer};
        const key = Number(Date.now());
      `;
      const direct = await extract(
        setup(script, '<component :is="registry">Ordinary</component>')
      );
      const selected = await extract(
        setup(script, '<component :is="registry[key]">Possible</component>')
      );

      expect(direct.errors).toEqual([]);
      expect(direct.results).toEqual([]);
      expect(selected.results).toEqual([]);
      expect(selected.errors.join('\n')).toContain(
        'Could not statically resolve possible gt-vue component alias'
      );
    }
  );

  it.each([
    [
      'computed key',
      `const key = String(Date.now());
       const registry = { translated: 'T', [key]: 'div' };`,
    ],
    [
      'unknown spread',
      `const unknown = getRegistry();
       const registry = { translated: 'T', ...unknown };`,
    ],
  ])(
    'downgrades a string selector overwritten by an unresolved %s',
    async (_name, declaration) => {
      const output = await extract(
        optionsAndSetup(
          `import { T } from 'gt-vue';
           export default { components: { T } };`,
          declaration,
          '<component :is="registry.translated">Possible</component>'
        )
      );

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        'Could not statically resolve possible gt-vue component alias'
      );
    }
  );

  it.each([
    `const key = String(Date.now());
     const registry = { translated: 'T', [key]: 'span', translated: 'div' };`,
    `const unknown = getRegistry();
     const registry = { translated: 'T', ...unknown, translated: 'div' };`,
  ])(
    'lets a later explicit property restore selector certainty',
    async (code) => {
      const output = await extract(
        optionsAndSetup(
          `import { T } from 'gt-vue';
         export default { components: { T } };`,
          code,
          '<component :is="registry.translated">Ordinary</component>'
        )
      );

      expect(output.errors).toEqual([]);
      expect(output.results).toEqual([]);
    }
  );

  it.each([
    {
      name: 'script-setup binding',
      source: optionsAndSetup(
        `import { T } from 'gt-vue';
         export default { components: { T } };`,
        `const flag = Boolean(Date.now());
         const choice = flag ? 'T' : 'div';`,
        '<component :is="choice">Possible</component>'
      ),
    },
    {
      name: 'Options setup return',
      source: options(
        `import { T } from 'gt-vue';
         export default {
           components: { T },
           setup() {
             const flag = Boolean(Date.now());
             return { choice: flag ? 'T' : 'div' };
           },
         };`,
        '<component :is="choice">Possible</component>'
      ),
    },
    {
      name: 'Options computed getter',
      source: options(
        `import { T } from 'gt-vue';
         export default {
           components: { T },
           computed: {
             choice() { return Boolean(Date.now()) ? 'T' : 'div'; },
           },
         };`,
        '<component :is="choice">Possible</component>'
      ),
    },
  ])('does not lose a registered T behind a $name', async ({ source }) => {
    const output = await extract(source);

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
  });

  it('preserves object spread copy timing', async () => {
    const output = await extract(
      setup(
        `
        import { useGT } from 'gt-vue';
        const source = { gt: useGT() };
        const copy = { ...source };
        source.gt = String;
        `,
        `{{ copy.gt('Copied translator') }}`
      )
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      'Copied translator',
    ]);
  });

  it('extracts an immutable GT namespace rest member', async () => {
    const output = await extract(
      setup(
        `import * as GT from 'gt-vue'; const { ...rest } = GT;`,
        '<component :is="rest.T">Possible</component>'
      )
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual(['Possible']);
  });

  it.each([
    [
      'object rest',
      `const { ordinary, ...rest } = { ordinary: String, translated: T };`,
    ],
    ['array rest', `const [ordinary, ...rest] = [String, T, String];`],
  ])(
    'keeps a %s root ordinary while tracking copied members',
    async (_name, declaration) => {
      const script = `import { T } from 'gt-vue';
        ${declaration}
        const key = String(Date.now());`;
      const direct = await extract(
        setup(script, '<component :is="rest">Ordinary</component>')
      );
      const selected = await extract(
        setup(script, '<component :is="rest[key]">Possible</component>')
      );

      expect(direct.errors).toEqual([]);
      expect(direct.results).toEqual([]);
      expect(selected.results).toEqual([]);
      expect(selected.errors.join('\n')).toContain(
        'Could not statically resolve possible gt-vue component alias'
      );
    }
  );

  it('extracts translator members copied through object rest', async () => {
    const output = await extract(
      setup(
        `import { msg, useGT, useMessages } from 'gt-vue';
         const source = { unused: String, gt: useGT(), m: useMessages(), msg };
         const { unused, ...rest } = source;`,
        `{{ rest.gt('Rest gt') }}
         {{ rest.m('Rest messages') }}
         {{ rest.msg('Rest msg') }}`
      )
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      'Rest gt',
      'Rest messages',
      'Rest msg',
    ]);
  });
});

function setup(script: string, template = '<div />'): string {
  return `<script setup>${script}</script><template>${template}</template>`;
}

function options(script: string, template: string): string {
  return `<script>${script}</script><template>${template}</template>`;
}

function optionsAndSetup(
  normalScript: string,
  scriptSetup: string,
  template: string
): string {
  return `<script>${normalScript}</script><script setup>${scriptSetup}</script><template>${template}</template>`;
}

async function extract(source: string) {
  return extractFromVueSource(source, '/fixtures/ScriptProvenance.vue', {
    projectRoot: '/fixtures',
  });
}
