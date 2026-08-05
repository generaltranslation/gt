import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from './testVueCompiler.js';

const POSSIBLE_ALIAS_DIAGNOSTIC =
  'Could not statically resolve possible gt-vue component alias';

type SafetyProbe = {
  /** Human-readable provenance path exercised by the probe. */
  name: string;
  /** Statements inserted into the fixture's script setup block. */
  code: string;
  /** Dynamic component expression read by the template. */
  selector: string;
  /** Whether the expression can select `<T>` at runtime. */
  possibleT: boolean;
};

/**
 * Safety cases for valid JavaScript containers beyond direct arrays and objects.
 *
 * Precise evaluation of every JavaScript abstraction is optional, but silence
 * is unsound when a statically imported `<T>` visibly reaches a dynamic Vue
 * component through a Map, Set, reflection, prototype, Proxy, class accessor,
 * or nested alias. Those paths must at minimum emit the existing possible-alias
 * diagnostic so catalog generation fails closed. Exact ordinary final states
 * remain silent to prevent stale false positives from blocking extraction.
 */
const safetyProbes: SafetyProbe[] = [
  {
    name: 'an object root rebind detaches its old T alias',
    code: 'let registry = { x: T }; const alias = registry; registry = { x: String };',
    selector: 'registry[key]',
    possibleT: false,
  },
  {
    name: 'an object old alias retains T after a root rebind',
    code: 'let registry = { x: T }; const alias = registry; registry = { x: String };',
    selector: 'alias[key]',
    possibleT: true,
  },
  {
    name: 'an ordinary object alias is not retargeted by a T rebind',
    code: 'let registry = { x: String }; const alias = registry; registry = { x: T };',
    selector: 'alias[key]',
    possibleT: false,
  },
  {
    name: 'an object rebound registry contains its new T value',
    code: 'let registry = { x: String }; const alias = registry; registry = { x: T };',
    selector: 'registry[key]',
    possibleT: true,
  },
  {
    name: 'a nested property replacement detaches an old T alias',
    code: 'const registry = { box: { x: T } }; const box = registry.box; registry.box = { x: String };',
    selector: 'registry.box[key]',
    possibleT: false,
  },
  {
    name: 'a nested old alias retains T after property replacement',
    code: 'const registry = { box: { x: T } }; const box = registry.box; registry.box = { x: String };',
    selector: 'box[key]',
    possibleT: true,
  },
  {
    name: 'a nested ordinary alias is not retargeted',
    code: 'const registry = { box: { x: String } }; const box = registry.box; registry.box = { x: T };',
    selector: 'box[key]',
    possibleT: false,
  },
  {
    name: 'a detached nested write does not taint its replacement',
    code: 'const registry = { box: { x: String } }; const box = registry.box; registry.box = { x: String }; box.x = T;',
    selector: 'registry.box[key]',
    possibleT: false,
  },
  {
    name: 'delete erases T from a detached nested alias',
    code: 'const registry = { box: { x: T } }; const box = registry.box; registry.box = { x: String }; delete box.x;',
    selector: 'box[key]',
    possibleT: false,
  },
  {
    name: 'readonly captures an old raw object containing T',
    code: 'let raw = { x: T }; const registry = readonly(raw); raw = { x: String };',
    selector: 'registry[key]',
    possibleT: true,
  },
  {
    name: 'readonly is not retargeted by a raw object T rebind',
    code: 'let raw = { x: String }; const registry = readonly(raw); raw = { x: T };',
    selector: 'registry[key]',
    possibleT: false,
  },
  {
    name: 'a toRaw object write introduces T behind readonly',
    code: 'const registry = readonly({ x: String }); const raw = toRaw(registry); raw.x = T;',
    selector: 'registry[key]',
    possibleT: true,
  },
  {
    name: 'a toRaw object write erases T behind readonly',
    code: 'const registry = readonly({ x: T }); const raw = toRaw(registry); raw.x = String;',
    selector: 'registry[key]',
    possibleT: false,
  },
  {
    name: 'readonly of shallowReadonly permits a nested object write',
    code: 'const registry = readonly(shallowReadonly({ box: { x: String } })); registry.box.x = T;',
    selector: 'registry.box[key]',
    possibleT: true,
  },
  {
    name: 'shallowReadonly of readonly blocks a nested object write',
    code: 'const registry = shallowReadonly(readonly({ box: { x: String } })); registry.box.x = T;',
    selector: 'registry.box[key]',
    possibleT: false,
  },
  {
    name: 'a Map literal may select T',
    code: "const registry = new Map([['x', T]]);",
    selector: 'registry.get(key)',
    possibleT: true,
  },
  {
    name: 'Map.set may introduce T',
    code: "const registry = new Map([['x', String]]); registry.set('y', T);",
    selector: 'registry.get(key)',
    possibleT: true,
  },
  {
    name: 'Map.set replacement erases T',
    code: "const registry = new Map([['x', T]]); registry.set('x', String);",
    selector: 'registry.get(key)',
    possibleT: false,
  },
  {
    name: 'Map.delete erases T',
    code: "const registry = new Map([['x', T]]); registry.delete('x');",
    selector: 'registry.get(key)',
    possibleT: false,
  },
  {
    name: 'a Map alias may receive T',
    code: "const registry = new Map([['x', String]]); const alias = registry; alias.set('y', T);",
    selector: 'registry.get(key)',
    possibleT: true,
  },
  {
    name: 'an array copied from Map values may select T',
    code: "const source = new Map([['x', T]]); const registry = Array.from(source.values());",
    selector: 'registry[index]',
    possibleT: true,
  },
  {
    name: 'an array copied from Set values may select T',
    code: 'const source = new Set([T]); const registry = Array.from(source);',
    selector: 'registry[index]',
    possibleT: true,
  },
  {
    name: 'Set.delete erases T before an array copy',
    code: 'const source = new Set([T]); source.delete(T); const registry = Array.from(source);',
    selector: 'registry[index]',
    possibleT: false,
  },
  {
    name: 'Reflect.get may select T',
    code: 'const registry = { x: T };',
    selector: 'Reflect.get(registry, key)',
    possibleT: true,
  },
  {
    name: 'Object.create may expose inherited T',
    code: 'const registry = Object.create({ x: T });',
    selector: 'registry[key]',
    possibleT: true,
  },
  {
    name: 'Object.setPrototypeOf may expose inherited T',
    code: 'const registry = {}; Object.setPrototypeOf(registry, { x: T });',
    selector: 'registry[key]',
    possibleT: true,
  },
  {
    name: 'a transparent Proxy may expose target T',
    code: 'const target = { x: T }; const registry = new Proxy(target, {});',
    selector: 'registry[key]',
    possibleT: true,
  },
  {
    name: 'a Proxy get trap may return T',
    code: 'const registry = new Proxy({}, { get() { return T; } });',
    selector: 'registry[key]',
    possibleT: true,
  },
  {
    name: 'an object getter may return T',
    code: 'const registry = { get x() { return T; } };',
    selector: 'registry[key]',
    possibleT: true,
  },
  {
    name: 'a class getter may return T',
    code: 'class Registry { get x() { return T; } } const registry = new Registry();',
    selector: 'registry[key]',
    possibleT: true,
  },
  {
    name: 'a symbol-keyed object may select T',
    code: 'const token = Symbol(); const registry = { [token]: T };',
    selector: 'registry[token]',
    possibleT: true,
  },
  {
    name: 'an optional member may select T',
    code: 'const registry = { x: T };',
    selector: 'registry?.[key]',
    possibleT: true,
  },
  {
    name: 'a nullish member fallback may select T',
    code: 'const registry = { x: undefined };',
    selector: 'registry[key] ?? T',
    possibleT: true,
  },
  {
    name: 'a logical member fallback may select T',
    code: 'const registry = { x: null };',
    selector: 'registry[key] || T',
    possibleT: true,
  },
];

describe('dynamic component container safety', () => {
  it.each(safetyProbes)('$name', async ({ code, selector, possibleT }) => {
    const output = await extractFromVueSource(
      createFixture(code, selector),
      '/fixtures/ExoticContainerSafety.vue',
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

/** Creates a minimal SFC that selects a component through the tested path. */
function createFixture(code: string, selector: string): string {
  return `<script setup>
    import { T } from 'gt-vue';
    import { readonly, shallowReadonly, toRaw } from 'vue';
    ${code}
    const key = getKey();
    const index = getIndex();
  </script>
  <template><component :is="${selector}">Hidden</component></template>`;
}
