import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from '../../index.js';

const POSSIBLE_ALIAS_DIAGNOSTIC =
  'Could not statically resolve possible gt-vue component alias';

type LocalCallProbe = {
  /** Human-readable local-call data flow exercised by the probe. */
  name: string;
  /** Statements inserted into the fixture's script setup block. */
  code: string;
  /** Dynamic component expression read by the template. */
  selector: string;
  /** Whether the selector resolves to `<T>` at runtime. */
  possibleT: boolean;
};

/**
 * Local function calls substitute arguments before resolving returned members.
 * Nested member and rest paths must retain an imported `<T>` possibility. The
 * safe requirement is detection: exact rich extraction or the conservative
 * possible-alias diagnostic are both valid, while complete silence is not.
 */
const localCallProbes: LocalCallProbe[] = [
  {
    name: 'a direct local-call member return selects T at an exact index',
    code: 'const read = (value) => value.registry; const selected = read({ registry: [T] });',
    selector: 'selected[0]',
    possibleT: true,
  },
  {
    name: 'a direct local-call member return selects T at a dynamic index',
    code: 'const read = (value) => value.registry; const selected = read({ registry: [T] });',
    selector: 'selected[index]',
    possibleT: true,
  },
  {
    name: 'a nested local-call member return selects T',
    code: 'const read = (value) => value.nested.registry; const selected = read({ nested: { registry: [T] } });',
    selector: 'selected[index]',
    possibleT: true,
  },
  {
    name: 'a deeply nested local-call member return selects T',
    code: 'const read = (value) => value.first.second.registry; const selected = read({ first: { second: { registry: [T] } } });',
    selector: 'selected[index]',
    possibleT: true,
  },
  {
    name: 'an ordinary local-call member return stays silent',
    code: 'const read = (value) => value.registry; const selected = read({ registry: [String] });',
    selector: 'selected[index]',
    possibleT: false,
  },
  {
    name: 'a rest parameter return selects nested T at an exact index',
    code: 'const read = (...values) => values[0]; const selected = read([T]);',
    selector: 'selected[0]',
    possibleT: true,
  },
  {
    name: 'a rest parameter return selects nested T at a dynamic index',
    code: 'const read = (...values) => values[0]; const selected = read([T]);',
    selector: 'selected[index]',
    possibleT: true,
  },
  {
    name: 'an ordinary rest parameter return stays silent',
    code: 'const read = (...values) => values[0]; const selected = read([String]);',
    selector: 'selected[index]',
    possibleT: false,
  },
];

describe('local-call component materialization', () => {
  it.each(localCallProbes)('$name', async ({ code, selector, possibleT }) => {
    const output = await extractFromVueSource(
      createComponentFixture(code, selector),
      '/fixtures/LocalCallMaterialization.vue',
      { projectRoot: '/fixtures' }
    );

    if (possibleT) {
      const extracted = output.results.some(
        ({ source }) => source === 'Hidden'
      );
      const diagnosed = output.errors
        .join('\n')
        .includes(POSSIBLE_ALIAS_DIAGNOSTIC);
      expect(extracted || diagnosed).toBe(true);
    } else {
      expect(output.results).toEqual([]);
      expect(output.errors).toEqual([]);
    }
  });
});

describe('string-function bindings at each call position', () => {
  it('extracts a useGT call made before the binding becomes ordinary', async () => {
    const output = await extractScript(`
      import { useGT } from 'gt-vue';
      let translate = useGT();
      translate('Before useGT reassignment');
      translate = String;
      translate('Ordinary after useGT');
    `);

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      'Before useGT reassignment',
    ]);
  });

  it('extracts a useGT call made after an ordinary binding is replaced', async () => {
    const output = await extractScript(`
      import { useGT } from 'gt-vue';
      let translate = String;
      translate('Ordinary before useGT');
      translate = useGT();
      translate('After useGT reassignment');
    `);

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      'After useGT reassignment',
    ]);
  });

  it('extracts a msg call made before the binding becomes ordinary', async () => {
    const output = await extractScript(`
      import { msg } from 'gt-vue';
      let message = msg;
      message('Before msg reassignment');
      message = String;
      message('Ordinary after msg');
    `);

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      'Before msg reassignment',
    ]);
  });

  it('extracts a msg call made after an ordinary binding is replaced', async () => {
    const output = await extractScript(`
      import { msg } from 'gt-vue';
      let message = String;
      message('Ordinary before msg');
      message = msg;
      message('After msg reassignment');
    `);

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      'After msg reassignment',
    ]);
  });
});

/** Creates an SFC that resolves a local-call result in the template. */
function createComponentFixture(code: string, selector: string): string {
  return `<script setup>
    import { T } from 'gt-vue';
    ${code}
    const index = getIndex();
  </script>
  <template><component :is="${selector}">Hidden</component></template>`;
}

/** Extracts a script-only SFC for source-position string-call assertions. */
function extractScript(script: string) {
  return extractFromVueSource(
    `<script setup>${script}</script><template><div /></template>`,
    '/fixtures/StringFunctionSourcePosition.vue',
    { projectRoot: '/fixtures' }
  );
}
