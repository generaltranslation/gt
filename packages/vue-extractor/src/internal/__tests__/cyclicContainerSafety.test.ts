import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from './testVueCompiler.js';

const POSSIBLE_ALIAS_DIAGNOSTIC =
  'Could not statically resolve possible gt-vue component alias';

type CycleProbe = {
  /** Human-readable cyclic provenance path exercised by the probe. */
  name: string;
  /** Statements inserted into the fixture's script setup block. */
  code: string;
  /** Dynamic component expression read by the template. */
  selector: string;
  /** Whether the selected component is `<T>` at runtime. */
  possibleT: boolean;
};

/**
 * Safety cases for self-referential and mutually referential containers.
 *
 * Static analysis must terminate for every cycle depth. When a cycle contains
 * an imported `<T>`, truncating recursion must conservatively preserve that
 * possibility rather than silently treating a deeper path as ordinary. Exact
 * resolution is optional: the existing possible-alias diagnostic is the safe
 * minimum. Matching String-only cycles remain silent termination controls.
 */
const cycleProbes: CycleProbe[] = [
  {
    name: 'a self-object exposes T through one cycle edge',
    code: 'const cyclic = { component: T }; cyclic.self = cyclic;',
    selector: 'cyclic.self.component',
    possibleT: true,
  },
  {
    name: 'a self-object exposes T through two cycle edges',
    code: 'const cyclic = { component: T }; cyclic.self = cyclic;',
    selector: 'cyclic.self.self.component',
    possibleT: true,
  },
  {
    name: 'a self-object exposes T through four cycle edges',
    code: 'const cyclic = { component: T }; cyclic.self = cyclic;',
    selector: 'cyclic.self.self.self.self.component',
    possibleT: true,
  },
  {
    name: 'an ordinary self-object terminates silently at one edge',
    code: 'const cyclic = { component: String }; cyclic.self = cyclic;',
    selector: 'cyclic.self.component',
    possibleT: false,
  },
  {
    name: 'an ordinary self-object terminates silently at four edges',
    code: 'const cyclic = { component: String }; cyclic.self = cyclic;',
    selector: 'cyclic.self.self.self.self.component',
    possibleT: false,
  },
  {
    name: 'a mutual object cycle exposes T after one hop',
    code: 'const first = {}; const second = { component: T }; first.next = second; second.next = first;',
    selector: 'first.next.component',
    possibleT: true,
  },
  {
    name: 'a mutual object cycle exposes T after three hops',
    code: 'const first = {}; const second = { component: T }; first.next = second; second.next = first;',
    selector: 'first.next.next.next.component',
    possibleT: true,
  },
  {
    name: 'an ordinary mutual object cycle terminates silently',
    code: 'const first = {}; const second = { component: String }; first.next = second; second.next = first;',
    selector: 'first.next.next.next.component',
    possibleT: false,
  },
  {
    name: 'a self-array exposes T through one cycle edge',
    code: 'const cyclic = [T]; cyclic.push(cyclic);',
    selector: 'cyclic[1][0]',
    possibleT: true,
  },
  {
    name: 'a self-array exposes T through two cycle edges',
    code: 'const cyclic = [T]; cyclic.push(cyclic);',
    selector: 'cyclic[1][1][0]',
    possibleT: true,
  },
  {
    name: 'an ordinary self-array terminates silently at one edge',
    code: 'const cyclic = [String]; cyclic.push(cyclic);',
    selector: 'cyclic[1][0]',
    possibleT: false,
  },
  {
    name: 'an ordinary self-array terminates silently at two edges',
    code: 'const cyclic = [String]; cyclic.push(cyclic);',
    selector: 'cyclic[1][1][0]',
    possibleT: false,
  },
];

describe('cyclic dynamic-component container safety', () => {
  it.each(cycleProbes)('$name', async ({ code, selector, possibleT }) => {
    const output = await extractFromVueSource(
      createFixture(code, selector),
      '/fixtures/CyclicContainer.vue',
      { projectRoot: '/fixtures' }
    );

    expect(output.results).toEqual([]);
    if (possibleT) {
      expect(output.errors.join('\n')).toContain(POSSIBLE_ALIAS_DIAGNOSTIC);
      expect(output.errors.join('\n')).toContain(`"${selector}"`);
    } else {
      expect(output.errors).toEqual([]);
    }
  });
});

/** Creates a minimal SFC whose selector follows a cyclic container path. */
function createFixture(code: string, selector: string): string {
  return `<script setup>
    import { T } from 'gt-vue';
    ${code}
  </script>
  <template><component :is="${selector}">Hidden</component></template>`;
}
