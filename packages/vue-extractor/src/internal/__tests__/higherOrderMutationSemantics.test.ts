import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from '../../index.js';

const POSSIBLE_ALIAS_DIAGNOSTIC =
  'Could not statically resolve possible gt-vue component alias';

type HigherOrderMutationProbe = {
  /** Human-readable function flow exercised by the probe. */
  name: string;
  /** Statements inserted into the fixture's script-setup block. */
  code: string;
  /** Whether the final registry can contain `<T>`. */
  possibleT: boolean;
};

/**
 * JavaScript functions can retain mutable arguments in closures or invoke a
 * callback supplied by another function. If the finite replay cannot execute
 * one of these higher-order flows exactly, it must preserve the possibility
 * that the captured registry was changed rather than silently treating the
 * original snapshot as final.
 */
const higherOrderMutationProbes: HigherOrderMutationProbe[] = [
  {
    name: 'a factory returns an arrow that writes T',
    code: `
      const registry = [String];
      const make = (value) => () => { value[0] = T; };
      const mutate = make(registry);
      mutate();
    `,
    possibleT: true,
  },
  {
    name: 'a factory returns a named closure that writes T',
    code: `
      const registry = [String];
      function make(value) { return function mutate() { value[0] = T; }; }
      const mutate = make(registry);
      mutate();
    `,
    possibleT: true,
  },
  {
    name: 'an immediately invoked returned closure writes T',
    code: `
      const registry = [String];
      const make = (value) => () => { value[0] = T; };
      make(registry)();
    `,
    possibleT: true,
  },
  {
    name: 'a factory object method writes T through its closure',
    code: `
      const registry = [String];
      const make = (value) => ({ mutate() { value[0] = T; } });
      const helper = make(registry);
      helper.mutate();
    `,
    possibleT: true,
  },
  {
    name: 'a destructured factory method writes T through its closure',
    code: `
      const registry = [String];
      const make = (value) => ({ mutate() { value[0] = T; } });
      const { mutate } = make(registry);
      mutate();
    `,
    possibleT: true,
  },
  {
    name: 'a bound function writes T through its captured argument',
    code: `
      const registry = [String];
      function replace(value) { value[0] = T; }
      const mutate = replace.bind(null, registry);
      mutate();
    `,
    possibleT: true,
  },
  {
    name: 'Function call writes T through its argument',
    code: `
      const registry = [String];
      function mutate(value) { value[0] = T; }
      mutate.call(null, registry);
    `,
    possibleT: true,
  },
  {
    name: 'Function apply writes T through its argument',
    code: `
      const registry = [String];
      function mutate(value) { value[0] = T; }
      mutate.apply(null, [registry]);
    `,
    possibleT: true,
  },
  {
    name: 'Reflect apply writes T through its argument',
    code: `
      const registry = [String];
      function mutate(value) { value[0] = T; }
      Reflect.apply(mutate, null, [registry]);
    `,
    possibleT: true,
  },
  {
    name: 'a local executor invokes a callback that captures the registry',
    code: `
      const registry = [String];
      function run(callback) { callback(); }
      run(() => { registry[0] = T; });
    `,
    possibleT: true,
  },
  {
    name: 'a local executor supplies the registry to a callback',
    code: `
      const registry = [String];
      function run(callback, value) { callback(value); }
      run((value) => { value[0] = T; }, registry);
    `,
    possibleT: true,
  },
  {
    name: 'a factory closure deterministically erases T',
    code: `
      const registry = [T];
      const make = (value) => () => { value[0] = String; };
      const mutate = make(registry);
      mutate();
    `,
    possibleT: false,
  },
  {
    name: 'Function call deterministically erases T',
    code: `
      const registry = [T];
      function mutate(value) { value[0] = String; }
      mutate.call(null, registry);
    `,
    possibleT: false,
  },
  {
    name: 'a local executor deterministically erases T',
    code: `
      const registry = [T];
      function run(callback) { callback(); }
      run(() => { registry[0] = String; });
    `,
    possibleT: false,
  },
];

describe('higher-order mutation semantics', () => {
  it.each(higherOrderMutationProbes)('$name', async ({ code, possibleT }) => {
    const output = await extractFromVueSource(
      createFixture(code),
      '/fixtures/HigherOrderMutationSemantics.vue',
      { projectRoot: '/fixtures' }
    );
    const extracted = output.results.some(({ source }) => source === 'Hidden');
    const diagnosed = output.errors.some((error) =>
      error.includes(POSSIBLE_ALIAS_DIAGNOSTIC)
    );

    if (possibleT) {
      expect(extracted || diagnosed).toBe(true);
    } else {
      // Higher-order calls may remain outside the exact replay subset. A
      // conservative diagnostic is acceptable, but publishing the erased T
      // as a translation is not.
      expect(output.results).toEqual([]);
    }
  });
});

/** Creates an SFC with one higher-order mutation and dynamic selector. */
function createFixture(code: string): string {
  return `<script setup>
    import { T } from 'gt-vue';
    const key = getKey();
    ${code}
  </script>
  <template><component :is="registry[key]">Hidden</component></template>`;
}
