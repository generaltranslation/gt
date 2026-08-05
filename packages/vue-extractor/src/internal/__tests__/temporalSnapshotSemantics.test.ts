import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from './testVueCompiler.js';

const POSSIBLE_ALIAS_DIAGNOSTIC =
  'Could not statically resolve possible gt-vue component alias';

type TemporalSnapshotProbe = {
  /** Human-readable snapshot or shared-identity behavior under test. */
  name: string;
  /** Statements inserted into the fixture's script-setup block. */
  code: string;
  /** Dynamic component expression read after setup completes. */
  selector: string;
  /** Whether the selector resolves to `<T>` in the final runtime state. */
  possibleT: boolean;
};

/**
 * Shallow copies capture top-level entries immediately but preserve references
 * to nested containers. Getter, member, and Map reads likewise capture their
 * result at the moment of the read. Later writes must affect shared identities
 * without retroactively changing earlier value snapshots.
 */
const temporalSnapshotProbes: TemporalSnapshotProbe[] = [
  {
    name: 'an array spread before an escaped mutation stays ordinary',
    code: `
      const registry = [String];
      const copy = [...registry];
      function mutate(value) { if (flag) value[0] = T; }
      mutate(registry);
    `,
    selector: 'copy[key]',
    possibleT: false,
  },
  {
    name: 'an array member snapshot before an escaped mutation stays ordinary',
    code: `
      const registry = [String];
      const selected = registry[0];
      function mutate(value) { if (flag) value[0] = T; }
      mutate(registry);
    `,
    selector: 'selected',
    possibleT: false,
  },
  {
    name: 'an object spread before an escaped mutation stays ordinary',
    code: `
      const registry = { x: String };
      const copy = { ...registry };
      function mutate(value) { if (flag) value.x = T; }
      mutate(registry);
    `,
    selector: 'copy[key]',
    possibleT: false,
  },
  {
    name: 'a Map get before an escaped mutation stays ordinary',
    code: `
      const registry = new Map([['x', String]]);
      const selected = registry.get('x');
      function mutate(value) { if (flag) value.set('x', T); }
      mutate(registry);
    `,
    selector: 'selected',
    possibleT: false,
  },
  {
    name: 'a shallow object copy preserves its shared nested identity',
    code: `
      const root = { box: [String] };
      const copy = { ...root };
      function mutate(value) { if (flag) value.box[0] = T; }
      mutate(root);
    `,
    selector: 'copy.box[key]',
    possibleT: true,
  },
  {
    name: 'a nested array spread before mutation stays ordinary',
    code: `
      const root = { box: [String] };
      const copy = [...root.box];
      function mutate(value) { if (flag) value.box[0] = T; }
      mutate(root);
    `,
    selector: 'copy[key]',
    possibleT: false,
  },
  {
    name: 'an ordinary getter snapshot remains ordinary after a later T write',
    code: `
      let value = String;
      const registry = { get x() { return value; } };
      const selected = registry.x;
      value = T;
    `,
    selector: 'selected',
    possibleT: false,
  },
  {
    name: 'a T getter snapshot survives a later ordinary write',
    code: `
      let value = T;
      const registry = { get x() { return value; } };
      const selected = registry.x;
      value = String;
    `,
    selector: 'selected',
    possibleT: true,
  },
  {
    name: 'an ordinary inherited snapshot remains ordinary after a T write',
    code: `
      const prototype = { x: String };
      const registry = Object.create(prototype);
      const selected = registry.x;
      prototype.x = T;
    `,
    selector: 'selected',
    possibleT: false,
  },
  {
    name: 'an inherited T snapshot survives a later ordinary write',
    code: `
      const prototype = { x: T };
      const registry = Object.create(prototype);
      const selected = registry.x;
      prototype.x = String;
    `,
    selector: 'selected',
    possibleT: true,
  },
  {
    name: 'an object spread excludes an inherited T property',
    code: `
      const prototype = { x: T };
      const registry = Object.create(prototype);
      const copy = { ...registry };
    `,
    selector: 'copy[key]',
    possibleT: false,
  },
  {
    name: 'Object.assign excludes an inherited T property',
    code: `
      const prototype = { x: T };
      const registry = Object.create(prototype);
      const copy = Object.assign({}, registry);
    `,
    selector: 'copy[key]',
    possibleT: false,
  },
  {
    name: 'an object setter writes T through its receiver',
    code: `
      const registry = { value: String, set x(next) { this.value = next; } };
      registry.x = T;
    `,
    selector: 'registry.value',
    possibleT: true,
  },
  {
    name: 'an object setter overwrites T through its receiver',
    code: `
      const registry = { value: T, set x(next) { this.value = next; } };
      registry.x = String;
    `,
    selector: 'registry.value',
    possibleT: false,
  },
  {
    name: 'a class setter writes T through its receiver',
    code: `
      class Registry { value = String; set x(next) { this.value = next; } }
      const registry = new Registry();
      registry.x = T;
    `,
    selector: 'registry.value',
    possibleT: true,
  },
  {
    name: 'a class setter overwrites T through its receiver',
    code: `
      class Registry { value = T; set x(next) { this.value = next; } }
      const registry = new Registry();
      registry.x = String;
    `,
    selector: 'registry.value',
    possibleT: false,
  },
  {
    name: 'an inherited method reads T through the derived receiver',
    code: `
      const prototype = { read() { return this.value; } };
      const registry = Object.create(prototype);
      registry.value = T;
    `,
    selector: 'registry.read()',
    possibleT: true,
  },
  {
    name: 'an inherited method observes a derived receiver mutation',
    code: `
      const prototype = { read() { return this.value; } };
      const registry = Object.create(prototype);
      registry.value = T;
      registry.value = String;
    `,
    selector: 'registry.read()',
    possibleT: false,
  },
];

describe('temporal snapshots and shared nested identities', () => {
  it.each(temporalSnapshotProbes)(
    '$name',
    async ({ code, selector, possibleT }) => {
      const output = await extractFromVueSource(
        createFixture(code, selector),
        '/fixtures/TemporalSnapshotSemantics.vue',
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

/** Creates an SFC containing one snapshot or shared-identity scenario. */
function createFixture(code: string, selector: string): string {
  return `<script setup>
    import { T } from 'gt-vue';
    const flag = Boolean(Date.now());
    const key = getKey();
    ${code}
  </script>
  <template><component :is="${selector}">Hidden</component></template>`;
}
