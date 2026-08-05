import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from './testVueCompiler.js';

const POSSIBLE_ALIAS_DIAGNOSTIC =
  'Could not statically resolve possible gt-vue component alias';

type EscapeProvenanceProbe = {
  /** Human-readable escape and copy operation exercised by the probe. */
  name: string;
  /** Statements inserted into the fixture's script-setup block. */
  code: string;
  /** Dynamic component expression read by the template. */
  selector: string;
  /** Whether the selector can resolve to `<T>` when the fixture executes. */
  possibleT: boolean;
};

/**
 * An unsupported branch makes a mutable value unsafe because the branch may
 * replace an ordinary component with `<T>`. Values subsequently read or copied
 * from that identity must retain the uncertainty; otherwise a spread, slice,
 * destructure, or member read can silently launder a runtime `<T>` possibility.
 */
const escapeProvenanceProbes: EscapeProvenanceProbe[] = [
  {
    name: 'retains uncertainty on the escaped array itself',
    code: `
      const registry = [String];
      function mutate(value) { if (flag) value[0] = T; }
      mutate(registry);
    `,
    selector: 'registry[key]',
    possibleT: true,
  },
  {
    name: 'retains uncertainty through an array spread',
    code: `
      const registry = [String];
      function mutate(value) { if (flag) value[0] = T; }
      mutate(registry);
      const copy = [...registry];
    `,
    selector: 'copy[key]',
    possibleT: true,
  },
  {
    name: 'retains uncertainty through slice',
    code: `
      const registry = [String];
      function mutate(value) { if (flag) value[0] = T; }
      mutate(registry);
      const copy = registry.slice();
    `,
    selector: 'copy[key]',
    possibleT: true,
  },
  {
    name: 'retains uncertainty through Array.from',
    code: `
      const registry = [String];
      function mutate(value) { if (flag) value[0] = T; }
      mutate(registry);
      const copy = Array.from(registry);
    `,
    selector: 'copy[key]',
    possibleT: true,
  },
  {
    name: 'retains uncertainty through array destructuring',
    code: `
      const registry = [String];
      function mutate(value) { if (flag) value[0] = T; }
      mutate(registry);
      const [selected] = registry;
    `,
    selector: 'selected',
    possibleT: true,
  },
  {
    name: 'retains uncertainty through an array member snapshot',
    code: `
      const registry = [String];
      function mutate(value) { if (flag) value[0] = T; }
      mutate(registry);
      const selected = registry[0];
    `,
    selector: 'selected',
    possibleT: true,
  },
  {
    name: 'retains uncertainty through an object spread',
    code: `
      const registry = { x: String };
      function mutate(value) { if (flag) value.x = T; }
      mutate(registry);
      const copy = { ...registry };
    `,
    selector: 'copy[key]',
    possibleT: true,
  },
  {
    name: 'retains uncertainty through Object.assign',
    code: `
      const registry = { x: String };
      function mutate(value) { if (flag) value.x = T; }
      mutate(registry);
      const copy = Object.assign({}, registry);
    `,
    selector: 'copy[key]',
    possibleT: true,
  },
  {
    name: 'retains uncertainty through an aliased array copy',
    code: `
      const registry = [String];
      const alias = registry;
      function mutate(value) { if (flag) value[0] = T; }
      mutate(registry);
      const copy = alias.slice();
    `,
    selector: 'copy[key]',
    possibleT: true,
  },
  {
    name: 'retains uncertainty through a nested array spread',
    code: `
      const root = { box: [String] };
      function mutate(value) { if (flag) value.box[0] = T; }
      mutate(root);
      const copy = [...root.box];
    `,
    selector: 'copy[key]',
    possibleT: true,
  },
  {
    name: 'retains uncertainty through a ref value spread',
    code: `
      const registry = ref([String]);
      function mutate(value) { if (flag) value.value[0] = T; }
      mutate(registry);
      const copy = [...registry.value];
    `,
    selector: 'copy[key]',
    possibleT: true,
  },
  {
    name: 'retains uncertainty through an escaped Map get',
    code: `
      const registry = new Map([['x', String]]);
      function mutate(value) { if (flag) value.set('x', T); }
      mutate(registry);
      const selected = registry.get('x');
    `,
    selector: 'selected',
    possibleT: true,
  },
  {
    name: 'keeps a finite ordinary mutation precise after array spread',
    code: `
      const registry = [T];
      function mutate(value) { value[0] = String; }
      mutate(registry);
      const copy = [...registry];
    `,
    selector: 'copy[key]',
    possibleT: false,
  },
  {
    name: 'keeps a finite ordinary mutation precise after a member snapshot',
    code: `
      const registry = [T];
      function mutate(value) { value[0] = String; }
      mutate(registry);
      const selected = registry[0];
    `,
    selector: 'selected',
    possibleT: false,
  },
];

describe('escaped container provenance', () => {
  it.each(escapeProvenanceProbes)(
    '$name',
    async ({ code, selector, possibleT }) => {
      const output = await extractFromVueSource(
        createFixture(code, selector),
        '/fixtures/EscapedContainerProvenance.vue',
        { projectRoot: '/fixtures' }
      );
      const extracted = output.results.some(
        ({ source }) => source === 'Hidden'
      );
      const diagnosed = output.errors.some((error) =>
        error.includes(POSSIBLE_ALIAS_DIAGNOSTIC)
      );

      if (possibleT) {
        expect(extracted || diagnosed).toBe(true);
      } else {
        expect(output.results).toEqual([]);
        expect(output.errors).toEqual([]);
      }
    }
  );
});

/** Creates an SFC containing one escaped-container selector scenario. */
function createFixture(code: string, selector: string): string {
  return `<script setup>
    import { T } from 'gt-vue';
    import { ref } from 'vue';
    const flag = Boolean(Date.now());
    const key = getKey();
    ${code}
  </script>
  <template><component :is="${selector}">Hidden</component></template>`;
}
