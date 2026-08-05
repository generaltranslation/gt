import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from './testVueCompiler.js';

const POSSIBLE_ALIAS_DIAGNOSTIC =
  'Could not statically resolve possible gt-vue component alias';

type NestedCopyProbe = {
  /** Human-readable shallow-copy rule exercised by the probe. */
  name: string;
  /** Statements inserted into the fixture's script setup block. */
  code: string;
  /** Dynamic component expression read by the template. */
  selector: string;
  /** Whether the selected nested object can contain `<T>` at runtime. */
  possibleT: boolean;
};

/**
 * Runtime-verified nested identity cases for JavaScript copy transforms.
 *
 * Array `slice`, spread, `Array.from`, identity `map`, `concat`, and the
 * non-mutating array transforms copy the outer array while retaining references
 * to nested values. Object spread and `Object.assign` behave the same way for
 * nested properties. A deliberate nested spread or nested slice creates a new
 * inner container and therefore detaches subsequent writes to the source.
 *
 * These are plain JavaScript identity rules, independently checked at runtime.
 * A shared nested write introducing `<T>` must fail closed; a shared erasure or
 * a write to a detached source must not leave a stale diagnostic.
 */
const nestedCopyProbes: NestedCopyProbe[] = [
  {
    name: 'slice shares a later nested T write',
    code: 'const raw = [[String]]; const registry = raw.slice(); raw[0][0] = T;',
    selector: 'registry[index][nested]',
    possibleT: true,
  },
  {
    name: 'slice shares a later nested T erasure',
    code: 'const raw = [[T]]; const registry = raw.slice(); raw[0][0] = String;',
    selector: 'registry[index][nested]',
    possibleT: false,
  },
  {
    name: 'array spread shares a later nested T write',
    code: 'const raw = [[String]]; const registry = [...raw]; raw[0][0] = T;',
    selector: 'registry[index][nested]',
    possibleT: true,
  },
  {
    name: 'array spread shares a later nested T erasure',
    code: 'const raw = [[T]]; const registry = [...raw]; raw[0][0] = String;',
    selector: 'registry[index][nested]',
    possibleT: false,
  },
  {
    name: 'Array.from shares a later nested T write',
    code: 'const raw = [[String]]; const registry = Array.from(raw); raw[0][0] = T;',
    selector: 'registry[index][nested]',
    possibleT: true,
  },
  {
    name: 'Array.from shares a later nested T erasure',
    code: 'const raw = [[T]]; const registry = Array.from(raw); raw[0][0] = String;',
    selector: 'registry[index][nested]',
    possibleT: false,
  },
  {
    name: 'identity map shares a later nested T write',
    code: 'const raw = [[String]]; const registry = raw.map((value) => value); raw[0][0] = T;',
    selector: 'registry[index][nested]',
    possibleT: true,
  },
  {
    name: 'identity map shares a later nested T erasure',
    code: 'const raw = [[T]]; const registry = raw.map((value) => value); raw[0][0] = String;',
    selector: 'registry[index][nested]',
    possibleT: false,
  },
  {
    name: 'concat shares a later nested T write',
    code: 'const raw = [[String]]; const registry = [].concat(raw); raw[0][0] = T;',
    selector: 'registry[index][nested]',
    possibleT: true,
  },
  {
    name: 'concat shares a later nested T erasure',
    code: 'const raw = [[T]]; const registry = [].concat(raw); raw[0][0] = String;',
    selector: 'registry[index][nested]',
    possibleT: false,
  },
  {
    name: 'toSpliced shares a later nested T write',
    code: 'const raw = [[String]]; const registry = raw.toSpliced(); raw[0][0] = T;',
    selector: 'registry[index][nested]',
    possibleT: true,
  },
  {
    name: 'toSpliced shares a later nested T erasure',
    code: 'const raw = [[T]]; const registry = raw.toSpliced(); raw[0][0] = String;',
    selector: 'registry[index][nested]',
    possibleT: false,
  },
  {
    name: 'toReversed shares a later nested T write',
    code: 'const raw = [[String]]; const registry = raw.toReversed(); raw[0][0] = T;',
    selector: 'registry[index][nested]',
    possibleT: true,
  },
  {
    name: 'toSorted shares a later nested T erasure',
    code: 'const raw = [[T]]; const registry = raw.toSorted(); raw[0][0] = String;',
    selector: 'registry[index][nested]',
    possibleT: false,
  },
  {
    name: 'a nested array spread detaches a later T write',
    code: 'const raw = [[String]]; const registry = raw.map((value) => [...value]); raw[0][0] = T;',
    selector: 'registry[index][nested]',
    possibleT: false,
  },
  {
    name: 'a nested array spread retains a pre-copy T',
    code: 'const raw = [[T]]; const registry = raw.map((value) => [...value]); raw[0][0] = String;',
    selector: 'registry[index][nested]',
    possibleT: true,
  },
  {
    name: 'a nested slice detaches a later T write',
    code: 'const raw = [[String]]; const registry = raw.map((value) => value.slice()); raw[0][0] = T;',
    selector: 'registry[index][nested]',
    possibleT: false,
  },
  {
    name: 'a nested slice retains a pre-copy T',
    code: 'const raw = [[T]]; const registry = raw.map((value) => value.slice()); raw[0][0] = String;',
    selector: 'registry[index][nested]',
    possibleT: true,
  },
  {
    name: 'object spread shares a later nested T write',
    code: 'const raw = { box: { value: String } }; const registry = { ...raw }; raw.box.value = T;',
    selector: 'registry.box[key]',
    possibleT: true,
  },
  {
    name: 'object spread shares a later nested T erasure',
    code: 'const raw = { box: { value: T } }; const registry = { ...raw }; raw.box.value = String;',
    selector: 'registry.box[key]',
    possibleT: false,
  },
  {
    name: 'Object.assign shares a later nested T write',
    code: 'const raw = { box: { value: String } }; const registry = Object.assign({}, raw); raw.box.value = T;',
    selector: 'registry.box[key]',
    possibleT: true,
  },
  {
    name: 'Object.assign shares a later nested T erasure',
    code: 'const raw = { box: { value: T } }; const registry = Object.assign({}, raw); raw.box.value = String;',
    selector: 'registry.box[key]',
    possibleT: false,
  },
  {
    name: 'a nested object spread detaches a later T write',
    code: 'const raw = { box: { value: String } }; const registry = { ...raw, box: { ...raw.box } }; raw.box.value = T;',
    selector: 'registry.box[key]',
    possibleT: false,
  },
  {
    name: 'a nested object spread retains a pre-copy T',
    code: 'const raw = { box: { value: T } }; const registry = { ...raw, box: { ...raw.box } }; raw.box.value = String;',
    selector: 'registry.box[key]',
    possibleT: true,
  },
];

describe('nested JavaScript copy identity semantics', () => {
  it.each(nestedCopyProbes)('$name', async ({ code, selector, possibleT }) => {
    const output = await extractFromVueSource(
      createFixture(code, selector),
      '/fixtures/NestedCopyIdentity.vue',
      { projectRoot: '/fixtures' }
    );

    expect(output.results).toEqual([]);
    if (possibleT) {
      expect(output.errors.join('\n')).toContain(POSSIBLE_ALIAS_DIAGNOSTIC);
    } else {
      expect(output.errors).toEqual([]);
    }
  });
});

/** Creates a minimal SFC that reads the copied container through unknown keys. */
function createFixture(code: string, selector: string): string {
  return `<script setup>
    import { T } from 'gt-vue';
    ${code}
    const index = getIndex();
    const nested = getIndex();
    const key = getKey();
  </script>
  <template><component :is="${selector}">Hidden</component></template>`;
}
