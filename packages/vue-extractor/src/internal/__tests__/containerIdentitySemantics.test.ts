import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from './testVueCompiler.js';

const POSSIBLE_ALIAS_DIAGNOSTIC =
  'Could not statically resolve possible gt-vue component alias';

type IdentityProbe = {
  /** Human-readable JavaScript or Vue identity rule exercised by the probe. */
  name: string;
  /** Statements inserted after the shared gt-vue and Vue imports. */
  code: string;
  /** Dynamic component expression read by the template. */
  selector?: string;
  /** Whether the runtime-selected container can still contain `<T>`. */
  possibleT: boolean;
};

/**
 * Runtime-verified identity cases for aliases, Vue proxies, and array copies.
 *
 * JavaScript aliases retain the object captured at assignment time, while a
 * later root assignment changes only the mutable binding. Vue proxies likewise
 * retain their original raw target. `toRaw()` returns that target, so writes
 * through it remain visible through every proxy view. Vue also returns an
 * existing proxy from incompatible nested wrappers: readonly proxies remain
 * readonly, and a shallow-readonly proxy remains shallow when passed to
 * `readonly()`. Array copy transforms capture their source values at call time.
 *
 * These expectations were checked against Vue 3.5 before being encoded here.
 * A possible `<T>` selected through an unknown key must fail closed with the
 * extractor diagnostic; an ordinary final value must remain completely silent.
 */
const identityProbes: IdentityProbe[] = [
  {
    name: 'a rebound registry is detached from its old T alias',
    code: 'let registry = [T]; const alias = registry; registry = [String];',
    possibleT: false,
  },
  {
    name: 'an old alias retains T after its binding is rebound',
    code: 'let registry = [T]; const alias = registry; registry = [String];',
    selector: 'alias[key]',
    possibleT: true,
  },
  {
    name: 'an old ordinary alias is not retargeted by a T rebind',
    code: 'let registry = [String]; const alias = registry; registry = [T];',
    selector: 'alias[key]',
    possibleT: false,
  },
  {
    name: 'a rebound registry contains its new T value',
    code: 'let registry = [String]; const alias = registry; registry = [T];',
    possibleT: true,
  },
  {
    name: 'a write to a detached alias does not taint a rebound registry',
    code: 'let registry = [String]; const alias = registry; registry = [String]; alias[0] = T;',
    possibleT: false,
  },
  {
    name: 'a write to a detached alias remains visible through that alias',
    code: 'let registry = [String]; const alias = registry; registry = [String]; alias[0] = T;',
    selector: 'alias[key]',
    possibleT: true,
  },
  {
    name: 'a later root replacement detaches a previously mutated alias',
    code: 'let registry = [String]; const alias = registry; alias[0] = T; registry = [String];',
    possibleT: false,
  },
  {
    name: 'a later root replacement leaves the old alias mutated',
    code: 'let registry = [String]; const alias = registry; alias[0] = T; registry = [String];',
    selector: 'alias[key]',
    possibleT: true,
  },
  {
    name: 'pop erases T from a detached alias',
    code: 'let registry = [T]; const alias = registry; registry = [String]; alias.pop();',
    selector: 'alias[key]',
    possibleT: false,
  },
  {
    name: 'a detached pop does not taint the rebound registry',
    code: 'let registry = [T]; const alias = registry; registry = [String]; alias.pop();',
    possibleT: false,
  },
  {
    name: 'an erased old alias stays ordinary beside a fresh T alias',
    code: 'let registry = [T]; const oldAlias = registry; oldAlias[0] = String; registry = [T]; const freshAlias = registry;',
    selector: 'oldAlias[key]',
    possibleT: false,
  },
  {
    name: 'a fresh alias sees the new T identity',
    code: 'let registry = [T]; const oldAlias = registry; oldAlias[0] = String; registry = [T]; const freshAlias = registry;',
    selector: 'freshAlias[key]',
    possibleT: true,
  },
  {
    name: 'readonly captures an old T target across a raw binding rebind',
    code: 'let raw = [T]; const registry = readonly(raw); raw = [String];',
    possibleT: true,
  },
  {
    name: 'shallowReadonly captures an old T target across a raw rebind',
    code: 'let raw = [T]; const registry = shallowReadonly(raw); raw = [String];',
    possibleT: true,
  },
  {
    name: 'reactive captures an old T target across a raw binding rebind',
    code: 'let raw = [T]; const registry = reactive(raw); raw = [String];',
    possibleT: true,
  },
  {
    name: 'readonly is not retargeted when its raw binding gains T',
    code: 'let raw = [String]; const registry = readonly(raw); raw = [T];',
    possibleT: false,
  },
  {
    name: 'shallowReadonly is not retargeted when its raw binding gains T',
    code: 'let raw = [String]; const registry = shallowReadonly(raw); raw = [T];',
    possibleT: false,
  },
  {
    name: 'reactive is not retargeted when its raw binding gains T',
    code: 'let raw = [String]; const registry = reactive(raw); raw = [T];',
    possibleT: false,
  },
  {
    name: 'a raw mutation after readonly creation adds T',
    code: 'const raw = [String]; const registry = readonly(raw); raw[0] = T;',
    possibleT: true,
  },
  {
    name: 'a raw mutation after readonly creation erases T',
    code: 'const raw = [T]; const registry = readonly(raw); raw[0] = String;',
    possibleT: false,
  },
  {
    name: 'a raw alias mutation after readonly creation erases T',
    code: 'const raw = [T]; const registry = readonly(raw); const alias = raw; alias[0] = String;',
    possibleT: false,
  },
  {
    name: 'a toRaw alias adds T behind readonly',
    code: 'const registry = readonly([String]); const raw = toRaw(registry); raw[0] = T;',
    possibleT: true,
  },
  {
    name: 'an inline toRaw mutation adds T behind readonly',
    code: 'const registry = readonly([String]); toRaw(registry)[0] = T;',
    possibleT: true,
  },
  {
    name: 'a toRaw alias adds T behind shallowReadonly',
    code: 'const registry = shallowReadonly([String]); const raw = toRaw(registry); raw[0] = T;',
    possibleT: true,
  },
  {
    name: 'a toRaw alias adds T behind reactive',
    code: 'const registry = reactive([String]); const raw = toRaw(registry); raw[0] = T;',
    possibleT: true,
  },
  {
    name: 'a toRaw alias erases T behind readonly',
    code: 'const registry = readonly([T]); const raw = toRaw(registry); raw[0] = String;',
    possibleT: false,
  },
  {
    name: 'an inline toRaw mutation erases T behind readonly',
    code: 'const registry = readonly([T]); toRaw(registry)[0] = String;',
    possibleT: false,
  },
  {
    name: 'a nested toRaw mutation adds T behind shallowReadonly',
    code: 'const registry = shallowReadonly([[String]]); const raw = toRaw(registry); raw[0][0] = T;',
    selector: 'registry[key][key]',
    possibleT: true,
  },
  {
    name: 'a nested toRaw mutation adds T behind readonly',
    code: 'const registry = readonly([[String]]); const raw = toRaw(registry); raw[0][0] = T;',
    selector: 'registry[key][key]',
    possibleT: true,
  },
  {
    name: 'a nested toRaw mutation adds T behind reactive',
    code: 'const registry = reactive([[String]]); const raw = toRaw(registry); raw[0][0] = T;',
    selector: 'registry[key][key]',
    possibleT: true,
  },
  {
    name: 'reactive of readonly stays readonly at the root',
    code: 'const registry = reactive(readonly([String])); registry[0] = T;',
    possibleT: false,
  },
  {
    name: 'shallowReadonly of readonly stays deeply readonly',
    code: 'const registry = shallowReadonly(readonly([[String]])); registry[0][0] = T;',
    selector: 'registry[key][key]',
    possibleT: false,
  },
  {
    name: 'reactive of shallowReadonly stays readonly at the root',
    code: 'const registry = reactive(shallowReadonly([String])); registry[0] = T;',
    possibleT: false,
  },
  {
    name: 'readonly of shallowReadonly stays shallow',
    code: 'const registry = readonly(shallowReadonly([[String]])); registry[0][0] = T;',
    selector: 'registry[key][key]',
    possibleT: true,
  },
  {
    name: 'readonly of reactive blocks a root write',
    code: 'const registry = readonly(reactive([String])); registry[0] = T;',
    possibleT: false,
  },
  {
    name: 'shallowReadonly of reactive permits a nested write',
    code: 'const registry = shallowReadonly(reactive([[String]])); registry[0][0] = T;',
    selector: 'registry[key][key]',
    possibleT: true,
  },
  {
    name: 'reactive of readonly retains T after a blocked erasure',
    code: 'const registry = reactive(readonly([T])); registry[0] = String;',
    possibleT: true,
  },
  {
    name: 'a readonly slice excludes a later T raw mutation',
    code: 'const raw = [String]; const registry = readonly(raw.slice()); raw[0] = T;',
    possibleT: false,
  },
  {
    name: 'a readonly slice retains T after later raw erasure',
    code: 'const raw = [T]; const registry = readonly(raw.slice()); raw[0] = String;',
    possibleT: true,
  },
  {
    name: 'a spread copy excludes a later T raw mutation',
    code: 'const raw = [String]; const registry = [...raw]; raw[0] = T;',
    possibleT: false,
  },
  {
    name: 'a spread copy retains T after later raw erasure',
    code: 'const raw = [T]; const registry = [...raw]; raw[0] = String;',
    possibleT: true,
  },
  {
    name: 'a map copy excludes a later T raw mutation',
    code: 'const raw = [String]; const registry = raw.map((value) => value); raw[0] = T;',
    possibleT: false,
  },
  {
    name: 'a concat copy retains T after later raw erasure',
    code: 'const raw = [T]; const registry = [].concat(raw); raw[0] = String;',
    possibleT: true,
  },
  {
    name: 'an Array.from copy excludes a later T raw mutation',
    code: 'const raw = [String]; const registry = Array.from(raw); raw[0] = T;',
    possibleT: false,
  },
  {
    name: 'a toSpliced copy retains T after later raw erasure',
    code: 'const raw = [T]; const registry = raw.toSpliced(); raw[0] = String;',
    possibleT: true,
  },
];

describe('Vue container identity semantics', () => {
  it.each(identityProbes)(
    '$name',
    async ({ code, selector = 'registry[key]', possibleT }) => {
      const output = await extractFromVueSource(
        createFixture(code, selector),
        '/fixtures/ContainerIdentity.vue',
        { projectRoot: '/fixtures' }
      );

      expect(output.results).toEqual([]);
      if (possibleT) {
        expect(output.errors.join('\n')).toContain(POSSIBLE_ALIAS_DIAGNOSTIC);
      } else {
        expect(output.errors).toEqual([]);
      }
    }
  );
});

/** Creates a minimal SFC whose unknown key exercises container provenance. */
function createFixture(code: string, selector: string): string {
  return `<script setup>
    import { T } from 'gt-vue';
    import { reactive, readonly, shallowReadonly, toRaw } from 'vue';
    ${code}
    const key = getIndex();
  </script>
  <template><component :is="${selector}">Hidden</component></template>`;
}
