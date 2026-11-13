import { describe, expect, it } from 'vitest';
import { collectAnalyzerStats } from './analyzerPerformance.js';
import { extractFromVueSource } from './testVueCompiler.js';

const POSSIBLE_COMPONENT_ALIAS =
  'Could not statically resolve possible gt-vue component alias';
const POSSIBLE_STRING_ALIAS =
  'Could not statically resolve possible gt-vue string function alias';

type ComponentProbe = {
  /** Human-readable JavaScript or Vue identity rule exercised by the probe. */
  name: string;
  /** Statements inserted into the fixture's script-setup block. */
  code: string;
  /** Dynamic component expression read by the template. */
  selector?: string;
  /** Whether the selector can resolve to `<T>` in the final runtime state. */
  possibleT: boolean;
};

type ComponentProbeFixture = {
  /** Statements placed between the gt-vue import and the probe code. */
  before?: string;
  /** Statements placed after the probe code. */
  after?: string;
  /**
   * `diagnosed` (default): a possible `<T>` must fail closed with the alias
   * diagnostic and extract nothing. `detected`: exact extraction of the hidden
   * child or the alias diagnostic are both acceptable; silence is not.
   */
  possibleT?: 'diagnosed' | 'detected';
  /**
   * `silent` (default): an ordinary final state yields no result and no
   * diagnostic. `unextracted`: a conservative diagnostic is tolerated.
   */
  ordinary?: 'silent' | 'unextracted';
  /** Whether the alias diagnostic must quote the probe's selector. */
  diagnosticNamesSelector?: boolean;
};

/**
 * Runs one table of dynamic-component provenance probes. Every probe renders
 * `<component :is="selector">Hidden</component>` from a script-setup block.
 */
function describeComponentProbes(
  title: string,
  fixture: ComponentProbeFixture,
  probes: ComponentProbe[]
): void {
  describe(title, () => {
    it.each(probes)(
      '$name',
      async ({ code, selector = 'registry[key]', possibleT }) => {
        const output = await extractFromVueSource(
          `<script setup>
    import { T } from 'gt-vue';
    ${fixture.before ?? ''}
    ${code}
    ${fixture.after ?? ''}
  </script>
  <template><component :is="${selector}">Hidden</component></template>`,
          '/fixtures/ComponentProbe.vue',
          { projectRoot: '/fixtures' }
        );
        const diagnostics = output.errors.join('\n');

        if (!possibleT) {
          expect(output.results).toEqual([]);
          if (fixture.ordinary !== 'unextracted') {
            expect(output.errors).toEqual([]);
          }
        } else if (fixture.possibleT === 'detected') {
          const extracted = output.results.some(
            ({ source }) => source === 'Hidden'
          );
          expect(
            extracted || diagnostics.includes(POSSIBLE_COMPONENT_ALIAS)
          ).toBe(true);
        } else {
          expect(output.results).toEqual([]);
          expect(diagnostics).toContain(POSSIBLE_COMPONENT_ALIAS);
          if (fixture.diagnosticNamesSelector) {
            expect(diagnostics).toContain(`"${selector}"`);
          }
        }
      }
    );
  });
}

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
describeComponentProbes(
  'Vue container identity semantics',
  {
    before: "import { reactive, readonly, shallowReadonly, toRaw } from 'vue';",
    after: 'const key = getIndex();',
  },
  [
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
  ]
);

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
describeComponentProbes(
  'nested JavaScript copy identity semantics',
  {
    after:
      'const index = getIndex(); const nested = getIndex(); const key = getKey();',
  },
  [
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
  ]
);

/**
 * Runtime-verified identity cases for Vue refs, computed refs, and identity APIs.
 *
 * A ref, shallowRef, unref result, markRaw result, or ordinary function result
 * captures its value object at the call or assignment point. Rebinding the
 * source variable does not retarget that object, although later writes through
 * a shared object remain visible. A computed getter instead closes over a live
 * binding and evaluates lazily, so it observes the final binding at render time.
 * Vue templates top-level-unwrap these values. `readonly(ref(...))` deeply
 * blocks nested writes, while `shallowReadonly(ref(...))` blocks `.value`
 * replacement but permits writes inside the returned reactive value.
 *
 * These expectations were checked with Vue 3.5.40. A possible `<T>` must fail
 * closed with the standard alias diagnostic; an ordinary final value is silent.
 */
describeComponentProbes(
  'Vue ref and computed identity semantics',
  {
    before:
      "import { computed, markRaw, readonly, ref, shallowReadonly, shallowRef, unref } from 'vue';",
    after: 'const key = getIndex();',
  },
  [
    {
      name: 'a nested ref write adds T',
      code: 'const registry = ref([String]); registry.value[0] = T;',
      possibleT: true,
    },
    {
      name: 'a nested ref write erases T',
      code: 'const registry = ref([T]); registry.value[0] = String;',
      possibleT: false,
    },
    {
      name: 'a ref value replacement adds T',
      code: 'const registry = ref([String]); registry.value = [T];',
      possibleT: true,
    },
    {
      name: 'a ref value replacement erases T',
      code: 'const registry = ref([T]); registry.value = [String];',
      possibleT: false,
    },
    {
      name: 'ref captures an old raw T object across a source rebind',
      code: 'let raw = [T]; const registry = ref(raw); raw = [String];',
      possibleT: true,
    },
    {
      name: 'ref is not retargeted by a later raw T rebind',
      code: 'let raw = [String]; const registry = ref(raw); raw = [T];',
      possibleT: false,
    },
    {
      name: 'shallowRef captures an old T object across a source rebind',
      code: 'let raw = [T]; const registry = shallowRef(raw); raw = [String];',
      possibleT: true,
    },
    {
      name: 'shallowRef is not retargeted by a later raw T rebind',
      code: 'let raw = [String]; const registry = shallowRef(raw); raw = [T];',
      possibleT: false,
    },
    {
      name: 'ref observes a later nested raw T write',
      code: 'const raw = [String]; const registry = ref(raw); raw[0] = T;',
      possibleT: true,
    },
    {
      name: 'ref observes a later nested raw T erasure',
      code: 'const raw = [T]; const registry = ref(raw); raw[0] = String;',
      possibleT: false,
    },
    {
      name: 'computed reads the final ordinary source binding',
      code: 'let raw = [T]; const registry = computed(() => raw); raw = [String];',
      possibleT: false,
    },
    {
      name: 'computed reads the final T source binding',
      code: 'let raw = [String]; const registry = computed(() => raw); raw = [T];',
      possibleT: true,
    },
    {
      name: 'computed observes a later nested T write',
      code: 'const raw = [String]; const registry = computed(() => raw); raw[0] = T;',
      possibleT: true,
    },
    {
      name: 'computed observes a later nested T erasure',
      code: 'const raw = [T]; const registry = computed(() => raw); raw[0] = String;',
      possibleT: false,
    },
    {
      name: 'a writable computed getter reads the final T binding',
      code: 'let raw = [String]; const registry = computed({ get: () => raw, set() {} }); raw = [T];',
      possibleT: true,
    },
    {
      name: 'a writable computed getter reads the final ordinary binding',
      code: 'let raw = [T]; const registry = computed({ get: () => raw, set() {} }); raw = [String];',
      possibleT: false,
    },
    {
      name: 'an unref result captures its old T value object',
      code: 'const holder = ref([T]); const registry = unref(holder); holder.value = [String];',
      possibleT: true,
    },
    {
      name: 'an unref result is not retargeted to a later T value',
      code: 'const holder = ref([String]); const registry = unref(holder); holder.value = [T];',
      possibleT: false,
    },
    {
      name: 'an unref result shares a nested T write through its old value',
      code: 'const holder = ref([String]); const registry = unref(holder); holder.value[0] = T;',
      possibleT: true,
    },
    {
      name: 'an unref result shares a nested erasure through its old value',
      code: 'const holder = ref([T]); const registry = unref(holder); holder.value[0] = String;',
      possibleT: false,
    },
    {
      name: 'markRaw captures its old T object across a source rebind',
      code: 'let raw = [T]; const registry = markRaw(raw); raw = [String];',
      possibleT: true,
    },
    {
      name: 'markRaw is not retargeted by a later raw T rebind',
      code: 'let raw = [String]; const registry = markRaw(raw); raw = [T];',
      possibleT: false,
    },
    {
      name: 'markRaw shares a later nested T write',
      code: 'const raw = [String]; const registry = markRaw(raw); raw[0] = T;',
      possibleT: true,
    },
    {
      name: 'markRaw shares a later nested T erasure',
      code: 'const raw = [T]; const registry = markRaw(raw); raw[0] = String;',
      possibleT: false,
    },
    {
      name: 'a local identity call captures its old T argument object',
      code: 'let raw = [T]; const identity = (value) => value; const registry = identity(raw); raw = [String];',
      possibleT: true,
    },
    {
      name: 'a local identity call is not retargeted by a later T rebind',
      code: 'let raw = [String]; const identity = (value) => value; const registry = identity(raw); raw = [T];',
      possibleT: false,
    },
    {
      name: 'a zero-argument local call captures the old T object',
      code: 'let raw = [T]; const read = () => raw; const registry = read(); raw = [String];',
      possibleT: true,
    },
    {
      name: 'a zero-argument local call is not retargeted by a later T rebind',
      code: 'let raw = [String]; const read = () => raw; const registry = read(); raw = [T];',
      possibleT: false,
    },
    {
      name: 'readonly ref blocks a T value replacement',
      code: 'const registry = readonly(ref([String])); registry.value = [T];',
      possibleT: false,
    },
    {
      name: 'readonly ref deeply blocks a nested T write',
      code: 'const registry = readonly(ref([String])); registry.value[0] = T;',
      possibleT: false,
    },
    {
      name: 'shallowReadonly ref blocks a T value replacement',
      code: 'const registry = shallowReadonly(ref([String])); registry.value = [T];',
      possibleT: false,
    },
    {
      name: 'shallowReadonly ref permits a nested T write',
      code: 'const registry = shallowReadonly(ref([String])); registry.value[0] = T;',
      possibleT: true,
    },
  ]
);

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
describeComponentProbes(
  'dynamic component container safety',
  {
    before: "import { readonly, shallowReadonly, toRaw } from 'vue';",
    after: 'const key = getKey(); const index = getIndex();',
  },
  [
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
  ]
);

/**
 * Safety cases for self-referential and mutually referential containers.
 *
 * Static analysis must terminate for every cycle depth. When a cycle contains
 * an imported `<T>`, truncating recursion must conservatively preserve that
 * possibility rather than silently treating a deeper path as ordinary. Exact
 * resolution is optional: the existing possible-alias diagnostic is the safe
 * minimum. Matching String-only cycles remain silent termination controls.
 */
describeComponentProbes(
  'cyclic dynamic-component container safety',
  { diagnosticNamesSelector: true },
  [
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
  ]
);

/**
 * Shallow copies capture top-level entries immediately but preserve references
 * to nested containers. Getter, member, and Map reads likewise capture their
 * result at the moment of the read. Later writes must affect shared identities
 * without retroactively changing earlier value snapshots.
 */
describeComponentProbes(
  'temporal snapshots and shared nested identities',
  {
    before: 'const flag = Boolean(Date.now()); const key = getKey();',
    possibleT: 'detected',
  },
  [
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
  ]
);

/**
 * Getters and prototype chains are live views, not construction-time copies.
 * The extractor must use the same final identity state that Vue observes when
 * rendering a template. Shadowing and deletion must likewise expose exactly
 * the own or inherited member JavaScript would read at render time.
 */
describeComponentProbes(
  'live getter and prototype identity semantics',
  { before: 'const key = getKey();', possibleT: 'detected' },
  [
    {
      name: 'an object getter reads a later T binding',
      code: `
      let value = String;
      const registry = { get x() { return value; } };
      value = T;
    `,
      selector: 'registry[key]',
      possibleT: true,
    },
    {
      name: 'an object getter reads a later ordinary binding',
      code: `
      let value = T;
      const registry = { get x() { return value; } };
      value = String;
    `,
      selector: 'registry[key]',
      possibleT: false,
    },
    {
      name: 'a class getter reads a later T binding',
      code: `
      let value = String;
      class Registry { get x() { return value; } }
      const registry = new Registry();
      value = T;
    `,
      selector: 'registry[key]',
      possibleT: true,
    },
    {
      name: 'a class getter reads a later ordinary binding',
      code: `
      let value = T;
      class Registry { get x() { return value; } }
      const registry = new Registry();
      value = String;
    `,
      selector: 'registry[key]',
      possibleT: false,
    },
    {
      name: 'a class field retains T',
      code: `
      class Registry { x = T; }
      const registry = new Registry();
    `,
      selector: 'registry[key]',
      possibleT: true,
    },
    {
      name: 'an ordinary class field stays silent',
      code: `
      class Registry { x = String; }
      const registry = new Registry();
    `,
      selector: 'registry[key]',
      possibleT: false,
    },
    {
      name: 'a class constructor assignment retains T',
      code: `
      class Registry { constructor() { this.x = T; } }
      const registry = new Registry();
    `,
      selector: 'registry[key]',
      possibleT: true,
    },
    {
      name: 'an ordinary class constructor assignment stays silent',
      code: `
      class Registry { constructor() { this.x = String; } }
      const registry = new Registry();
    `,
      selector: 'registry[key]',
      possibleT: false,
    },
    {
      name: 'Object.create observes a later T prototype write',
      code: `
      const prototype = { x: String };
      const registry = Object.create(prototype);
      prototype.x = T;
    `,
      selector: 'registry[key]',
      possibleT: true,
    },
    {
      name: 'Object.create observes a later ordinary prototype write',
      code: `
      const prototype = { x: T };
      const registry = Object.create(prototype);
      prototype.x = String;
    `,
      selector: 'registry[key]',
      possibleT: false,
    },
    {
      name: 'setPrototypeOf observes a later T prototype write',
      code: `
      const prototype = { x: String };
      const registry = {};
      Object.setPrototypeOf(registry, prototype);
      prototype.x = T;
    `,
      selector: 'registry[key]',
      possibleT: true,
    },
    {
      name: 'setPrototypeOf observes a later ordinary prototype write',
      code: `
      const prototype = { x: T };
      const registry = {};
      Object.setPrototypeOf(registry, prototype);
      prototype.x = String;
    `,
      selector: 'registry[key]',
      possibleT: false,
    },
    {
      name: 'an ordinary own property shadows an inherited T',
      code: `
      const prototype = { x: T };
      const registry = Object.create(prototype);
      registry.x = String;
    `,
      selector: 'registry[key]',
      possibleT: false,
    },
    {
      name: 'deleting an ordinary own property reveals inherited T',
      code: `
      const prototype = { x: T };
      const registry = Object.create(prototype);
      registry.x = String;
      delete registry.x;
    `,
      selector: 'registry[key]',
      possibleT: true,
    },
    {
      name: 'deleting a T own property reveals an ordinary inherited value',
      code: `
      const prototype = { x: String };
      const registry = Object.create(prototype);
      registry.x = T;
      delete registry.x;
    `,
      selector: 'registry[key]',
      possibleT: false,
    },
    {
      name: 'deleting through a detached nested alias removes T',
      code: `
      const registry = { box: { x: T } };
      const box = registry.box;
      registry.box = { x: String };
      delete box.x;
    `,
      selector: 'box[key]',
      possibleT: false,
    },
    {
      name: 'an object getter reads T through its receiver',
      code: `
      const registry = { value: T, get x() { return this.value; } };
    `,
      selector: 'registry.x',
      possibleT: true,
    },
    {
      name: 'an object getter observes a receiver mutation',
      code: `
      const registry = { value: T, get x() { return this.value; } };
      registry.value = String;
    `,
      selector: 'registry.x',
      possibleT: false,
    },
    {
      name: 'an object method reads T through its receiver',
      code: `
      const registry = { value: T, read() { return this.value; } };
    `,
      selector: 'registry.read()',
      possibleT: true,
    },
    {
      name: 'an object method observes a receiver mutation',
      code: `
      const registry = { value: T, read() { return this.value; } };
      registry.value = String;
    `,
      selector: 'registry.read()',
      possibleT: false,
    },
    {
      name: 'a class getter reads T through its receiver',
      code: `
      class Registry {
        value = T;
        get x() { return this.value; }
      }
      const registry = new Registry();
    `,
      selector: 'registry.x',
      possibleT: true,
    },
    {
      name: 'a class getter observes a receiver mutation',
      code: `
      class Registry {
        value = T;
        get x() { return this.value; }
      }
      const registry = new Registry();
      registry.value = String;
    `,
      selector: 'registry.x',
      possibleT: false,
    },
    {
      name: 'a class method reads T through its receiver',
      code: `
      class Registry {
        value = T;
        read() { return this.value; }
      }
      const registry = new Registry();
    `,
      selector: 'registry.read()',
      possibleT: true,
    },
    {
      name: 'a class method observes a receiver mutation',
      code: `
      class Registry {
        value = T;
        read() { return this.value; }
      }
      const registry = new Registry();
      registry.value = String;
    `,
      selector: 'registry.read()',
      possibleT: false,
    },
  ]
);

/**
 * An unsupported branch makes a mutable value unsafe because the branch may
 * replace an ordinary component with `<T>`. Values subsequently read or copied
 * from that identity must retain the uncertainty; otherwise a spread, slice,
 * destructure, or member read can silently launder a runtime `<T>` possibility.
 */
describeComponentProbes(
  'escaped container provenance',
  {
    before:
      "import { ref } from 'vue'; const flag = Boolean(Date.now()); const key = getKey();",
    possibleT: 'detected',
  },
  [
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
  ]
);

/**
 * Local function calls substitute arguments before resolving returned members.
 * Nested member and rest paths must retain an imported `<T>` possibility. The
 * safe requirement is detection: exact rich extraction or the conservative
 * possible-alias diagnostic are both valid, while complete silence is not.
 */
describeComponentProbes(
  'local-call component materialization',
  { after: 'const index = getIndex();', possibleT: 'detected' },
  [
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
  ]
);

/**
 * JavaScript functions can retain mutable arguments in closures or invoke a
 * callback supplied by another function. If the finite replay cannot execute
 * one of these higher-order flows exactly, it must preserve the possibility
 * that the captured registry was changed rather than silently treating the
 * original snapshot as final.
 */
describeComponentProbes(
  'higher-order mutation semantics',
  {
    before: 'const key = getKey();',
    possibleT: 'detected',
    ordinary: 'unextracted',
  },
  [
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
  ]
);

type StringFactoryProbe = {
  /** Human-readable string-function factory flow under test. */
  name: string;
  /** Statements inserted into the fixture's script-setup block. */
  script: string;
  /** Source passed to the resulting function call. */
  source: string;
  /** Whether the called value can be a gt-vue string function. */
  possibleGT: boolean;
};

/**
 * Local factories and identity functions can return `useGT()`,
 * `useMessages()`, or `msg` without changing the function's GT provenance.
 * Conditional factory results need a diagnostic when exact extraction is not
 * possible, while an entirely ordinary factory must stay silent.
 */
const stringFactoryProbes: StringFactoryProbe[] = [
  {
    name: 'an arrow factory returns a useGT result',
    script: `
      import { useGT } from 'gt-vue';
      const make = () => useGT();
      const gt = make();
      gt('Arrow factory');
    `,
    source: 'Arrow factory',
    possibleGT: true,
  },
  {
    name: 'a function factory returns msg',
    script: `
      import { msg } from 'gt-vue';
      function make() { return msg; }
      const message = make();
      message('Function factory');
    `,
    source: 'Function factory',
    possibleGT: true,
  },
  {
    name: 'an identity function returns a useGT result',
    script: `
      import { useGT } from 'gt-vue';
      const identity = (value) => value;
      const gt = identity(useGT());
      gt('Identity factory');
    `,
    source: 'Identity factory',
    possibleGT: true,
  },
  {
    name: 'a factory returns an object containing a useGT result',
    script: `
      import { useGT } from 'gt-vue';
      const make = () => ({ fn: useGT() });
      const holder = make();
      holder.fn('Object factory');
    `,
    source: 'Object factory',
    possibleGT: true,
  },
  {
    name: 'a function selects a useGT argument',
    script: `
      import { useGT } from 'gt-vue';
      function select(value) { return value; }
      const gt = select(useGT());
      gt('Argument selector');
    `,
    source: 'Argument selector',
    possibleGT: true,
  },
  {
    name: 'a conditional binding may be a useGT result',
    script: `
      import { useGT } from 'gt-vue';
      const gt = flag ? useGT() : String;
      gt('Conditional binding');
    `,
    source: 'Conditional binding',
    possibleGT: true,
  },
  {
    name: 'a factory may return a useGT result',
    script: `
      import { useGT } from 'gt-vue';
      const make = () => flag ? useGT() : String;
      const gt = make();
      gt('Conditional factory');
    `,
    source: 'Conditional factory',
    possibleGT: true,
  },
  {
    name: 'a factory returns a useMessages result',
    script: `
      import { useMessages } from 'gt-vue';
      const make = () => useMessages();
      const m = make();
      m('Messages factory');
    `,
    source: 'Messages factory',
    possibleGT: true,
  },
  {
    name: 'an ordinary factory stays silent',
    script: `
      const make = () => String;
      const ordinary = make();
      ordinary('Ordinary factory');
    `,
    source: 'Ordinary factory',
    possibleGT: false,
  },
];

describe('string-function factory semantics', () => {
  it.each(stringFactoryProbes)(
    '$name',
    async ({ script, source, possibleGT }) => {
      const output = await extractFromVueSource(
        `<script setup>
          const flag = Boolean(Date.now());
          ${script}
        </script><template><div /></template>`,
        '/fixtures/StringFactorySemantics.vue',
        { projectRoot: '/fixtures' }
      );
      const extracted = output.results.some(
        (result) => result.source === source
      );
      const diagnosed = output.errors.some((error) =>
        error.includes(POSSIBLE_STRING_ALIAS)
      );

      if (possibleGT) {
        expect(extracted || diagnosed).toBe(true);
      } else {
        expect(output.results).toEqual([]);
        expect(output.errors).toEqual([]);
      }
    }
  );

  it.each([
    {
      name: 'mutable assignment',
      source: `import { msg } from 'gt-vue'; let candidate = {}; candidate = msg; const alias = candidate; alias('Mutable translator');`,
      translation: 'Mutable translator',
    },
    {
      name: 'local callback return',
      source: `import { msg } from 'gt-vue'; const factory = () => msg; const alias = factory(); alias('Callback translator');`,
      translation: 'Callback translator',
    },
  ])('does not hide translator provenance through $name', async (testCase) => {
    const output = await extractFromVueSource(
      testCase.source,
      `/fixtures/${testCase.name}.ts`,
      { projectRoot: '/fixtures' }
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      testCase.translation,
    ]);
  });
});

type SourcePositionProbe = {
  /** Human-readable JavaScript data flow exercised by the probe. */
  name: string;
  /** Statements inserted into a TypeScript script-setup block. */
  script: string;
  /** Sources that execute through a GT string function at that call site. */
  sources: string[];
};

/**
 * Mutable string-function aliases are resolved at each call's source position.
 * A later write must neither erase an earlier GT call nor retroactively turn an
 * earlier ordinary call into a translation.
 */
const sourcePositionProbes: SourcePositionProbe[] = [
  {
    name: 'extracts a useGT call made before the binding becomes ordinary',
    script: `
      import { useGT } from 'gt-vue';
      let translate = useGT();
      translate('Before useGT reassignment');
      translate = String;
      translate('Ordinary after useGT');
    `,
    sources: ['Before useGT reassignment'],
  },
  {
    name: 'extracts a useGT call made after an ordinary binding is replaced',
    script: `
      import { useGT } from 'gt-vue';
      let translate = String;
      translate('Ordinary before useGT');
      translate = useGT();
      translate('After useGT reassignment');
    `,
    sources: ['After useGT reassignment'],
  },
  {
    name: 'extracts a msg call made before the binding becomes ordinary',
    script: `
      import { msg } from 'gt-vue';
      let message = msg;
      message('Before msg reassignment');
      message = String;
      message('Ordinary after msg');
    `,
    sources: ['Before msg reassignment'],
  },
  {
    name: 'extracts a msg call made after an ordinary binding is replaced',
    script: `
      import { msg } from 'gt-vue';
      let message = String;
      message('Ordinary before msg');
      message = msg;
      message('After msg reassignment');
    `,
    sources: ['After msg reassignment'],
  },
  {
    name: 'extracts an object-member useGT call before reassignment',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { fn: useGT() };
      holder.fn('member GT before ordinary');
      holder.fn = String;
      holder.fn('member ordinary after GT');
    `,
    sources: ['member GT before ordinary'],
  },
  {
    name: 'extracts an object-member useGT call after reassignment',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { fn: String };
      holder.fn('member ordinary before GT');
      holder.fn = useGT();
      holder.fn('member GT after ordinary');
    `,
    sources: ['member GT after ordinary'],
  },
  {
    name: 'extracts an object-member msg call before reassignment',
    script: `
      import { msg } from 'gt-vue';
      const holder = { fn: msg };
      holder.fn('member msg before ordinary');
      holder.fn = String;
      holder.fn('member ordinary after msg');
    `,
    sources: ['member msg before ordinary'],
  },
  {
    name: 'extracts an object-member msg call after reassignment',
    script: `
      import { msg } from 'gt-vue';
      const holder = { fn: String };
      holder.fn('member ordinary before msg');
      holder.fn = msg;
      holder.fn('member msg after ordinary');
    `,
    sources: ['member msg after ordinary'],
  },
  {
    name: 'extracts an object-member useMessages call before reassignment',
    script: `
      import { useMessages } from 'gt-vue';
      const holder = { fn: useMessages() };
      holder.fn('member messages before ordinary');
      holder.fn = String;
      holder.fn('member ordinary after messages');
    `,
    sources: ['member messages before ordinary'],
  },
  {
    name: 'extracts an object-member useMessages call after reassignment',
    script: `
      import { useMessages } from 'gt-vue';
      const holder = { fn: String };
      holder.fn('member ordinary before messages');
      holder.fn = useMessages();
      holder.fn('member messages after ordinary');
    `,
    sources: ['member messages after ordinary'],
  },
  {
    name: 'resolves a computed member at each call position',
    script: `
      import { useGT } from 'gt-vue';
      const key = 'fn';
      const holder = { [key]: useGT() };
      holder[key]('computed GT before ordinary');
      holder[key] = String;
      holder[key]('computed ordinary after GT');
    `,
    sources: ['computed GT before ordinary'],
  },
  {
    name: 'resolves a nested member at each call position',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { api: { fn: String } };
      holder.api.fn('nested ordinary before GT');
      holder.api.fn = useGT();
      holder.api.fn('nested GT after ordinary');
    `,
    sources: ['nested GT after ordinary'],
  },
  {
    name: 'preserves object identity through an alias when a member changes',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { fn: useGT() };
      const alias = holder;
      alias.fn('aliased member GT before ordinary');
      holder.fn = String;
      alias.fn('aliased member ordinary after GT');
    `,
    sources: ['aliased member GT before ordinary'],
  },
  {
    name: 'observes a GT member write through an object alias',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { fn: String };
      const alias = holder;
      alias.fn('aliased member ordinary before GT');
      holder.fn = useGT();
      alias.fn('aliased member GT after ordinary');
    `,
    sources: ['aliased member GT after ordinary'],
  },
  {
    name: 'keeps a detached member value after the object member changes',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { fn: useGT() };
      const detached = holder.fn;
      holder.fn = String;
      detached('detached GT snapshot');
      holder.fn('mutated ordinary member');
    `,
    sources: ['detached GT snapshot'],
  },
  {
    name: 'does not retroactively change an ordinary detached member',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { fn: String };
      const detached = holder.fn;
      holder.fn = useGT();
      detached('detached ordinary snapshot');
      holder.fn('mutated GT member');
    `,
    sources: ['mutated GT member'],
  },
  {
    name: 'keeps an aliased old object when its root binding is replaced',
    script: `
      import { useGT } from 'gt-vue';
      let holder = { fn: useGT() };
      const oldHolder = holder;
      holder = { fn: String };
      oldHolder.fn('old root GT member');
      holder.fn('new root ordinary member');
    `,
    sources: ['old root GT member'],
  },
  {
    name: 'uses the replacement object after its root binding changes',
    script: `
      import { useGT } from 'gt-vue';
      let holder = { fn: String };
      const oldHolder = holder;
      holder = { fn: useGT() };
      oldHolder.fn('old root ordinary member');
      holder.fn('new root GT member');
    `,
    sources: ['new root GT member'],
  },
  {
    name: 'extracts an optional object-member call',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { fn: useGT() };
      holder.fn?.('optional member call');
    `,
    sources: ['optional member call'],
  },
  {
    name: 'extracts through an optional object member',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { fn: useGT() };
      holder?.fn('optional object member call');
    `,
    sources: ['optional object member call'],
  },
  {
    name: 'extracts an optional computed-member call',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { fn: useGT() };
      holder?.['fn']?.('optional computed member call');
    `,
    sources: ['optional computed member call'],
  },
  {
    name: 'extracts a non-null object-member call',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { fn: useGT() };
      holder.fn!('non-null member call');
    `,
    sources: ['non-null member call'],
  },
  {
    name: 'extracts a type-wrapped object-member call',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { fn: useGT() };
      (holder.fn as typeof holder.fn)('type-wrapped member call');
    `,
    sources: ['type-wrapped member call'],
  },
  {
    name: 'resolves an uninitialized translator through successive writes',
    script: `
      import { useGT } from 'gt-vue';
      let translate;
      translate = useGT();
      translate('uninitialized binding GT phase');
      translate = String;
      translate('uninitialized binding ordinary phase');
    `,
    sources: ['uninitialized binding GT phase'],
  },
  {
    name: 'resolves an uninitialized msg alias through successive writes',
    script: `
      import { msg } from 'gt-vue';
      let message;
      message = String;
      message('uninitialized msg ordinary phase');
      message = msg;
      message('uninitialized msg GT phase');
    `,
    sources: ['uninitialized msg GT phase'],
  },
  {
    name: 'preserves a detached alias from an uninitialized translator',
    script: `
      import { useGT } from 'gt-vue';
      let translate;
      translate = useGT();
      const alias = translate;
      translate = String;
      alias?.('uninitialized detached translator');
    `,
    sources: ['uninitialized detached translator'],
  },
  {
    name: 'preserves a detached alias from an initialized translator',
    script: `
      import { useGT } from 'gt-vue';
      let translate = useGT();
      const alias = translate;
      translate = String;
      alias('initialized detached translator');
    `,
    sources: ['initialized detached translator'],
  },
  {
    name: 'does not retroactively change an ordinary detached alias',
    script: `
      import { useGT } from 'gt-vue';
      let translate = String;
      const alias = translate;
      translate = useGT();
      alias('initialized detached ordinary alias');
      translate('initialized reassigned translator');
    `,
    sources: ['initialized reassigned translator'],
  },
  {
    name: 'resolves an optional member call before reassignment',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { fn: useGT() };
      holder.fn?.('optional mutable member GT phase');
      holder.fn = String;
      holder.fn?.('optional mutable member ordinary phase');
    `,
    sources: ['optional mutable member GT phase'],
  },
  {
    name: 'resolves an optional member call after reassignment',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { fn: String };
      holder.fn?.('optional mutable member ordinary phase');
      holder.fn = useGT();
      holder.fn?.('optional mutable member GT phase');
    `,
    sources: ['optional mutable member GT phase'],
  },
  {
    name: 'resolves a non-null member call before reassignment',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { fn: useGT() };
      holder.fn!('non-null mutable member GT phase');
      holder.fn = String;
      holder.fn!('non-null mutable member ordinary phase');
    `,
    sources: ['non-null mutable member GT phase'],
  },
  {
    name: 'resolves a non-null member call after reassignment',
    script: `
      import { useGT } from 'gt-vue';
      const holder = { fn: String };
      holder.fn!('non-null mutable member ordinary phase');
      holder.fn = useGT();
      holder.fn!('non-null mutable member GT phase');
    `,
    sources: ['non-null mutable member GT phase'],
  },
];

describe('string-function calls at each source position', () => {
  it.each(sourcePositionProbes)('$name', async ({ script, sources }) => {
    const output = await extractFromVueSource(
      `<script setup lang="ts">${script}</script><template><div /></template>`,
      '/fixtures/CallSourcePosition.vue',
      { projectRoot: '/fixtures' }
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual(sources);
  });
});

type RenderSafetyProbe = {
  /** Human-readable unsupported rich-render path exercised by the probe. */
  name: string;
  /** Complete SFC source for the render path. */
  source: string;
  /** Diagnostic fragment proving that extraction failed closed. */
  diagnostic: string;
};

/**
 * Safety cases for programmatic rich `<T>` rendering.
 *
 * Rich translation extraction supports declarative SFC templates and Vue
 * JSX/TSX. Programmatic `h()` and `createVNode()` calls, plus async component
 * wrappers that visibly receive imported `<T>`, must still fail closed instead
 * of silently producing an empty catalog.
 */
const renderSafetyProbes: RenderSafetyProbe[] = [
  {
    name: 'an Options API render function calls h with T',
    source: `<script>
      import { h } from 'vue';
      import { T } from 'gt-vue';
      export default { render() { return h(T, null, 'Hello'); } };
    </script>`,
    diagnostic: 'gt-vue',
  },
  {
    name: 'an Options API render function calls createVNode with T',
    source: `<script>
      import { createVNode } from 'vue';
      import { T } from 'gt-vue';
      export default { render() { return createVNode(T, null, 'Hello'); } };
    </script>`,
    diagnostic: 'gt-vue',
  },
  {
    name: 'an Options API setup function returns a render function with T',
    source: `<script>
      import { h } from 'vue';
      import { T } from 'gt-vue';
      export default { setup() { return () => h(T, null, 'Hello'); } };
    </script>`,
    diagnostic: 'gt-vue',
  },
  {
    name: 'a defineComponent render function calls h with T',
    source: `<script>
      import { defineComponent, h } from 'vue';
      import { T } from 'gt-vue';
      export default defineComponent({
        render() { return h(T, null, 'Hello'); },
      });
    </script>`,
    diagnostic: 'gt-vue',
  },
  {
    name: 'script setup passes T to createVNode used as a component',
    source: `<script setup>
      import { createVNode } from 'vue';
      import { T } from 'gt-vue';
      const vnode = createVNode(T, null, 'Hello');
    </script>
    <template><component :is="vnode" /></template>`,
    diagnostic: 'possible gt-vue component alias',
  },
  {
    name: 'resolveDynamicComponent receives T',
    source: `<script setup>
      import { resolveDynamicComponent } from 'vue';
      import { T } from 'gt-vue';
      const selected = resolveDynamicComponent(T);
    </script>
    <template><component :is="selected">Hello</component></template>`,
    diagnostic: 'possible gt-vue component alias',
  },
  {
    name: 'defineAsyncComponent resolves to T',
    source: `<script setup>
      import { defineAsyncComponent } from 'vue';
      import { T } from 'gt-vue';
      const selected = defineAsyncComponent(() => Promise.resolve(T));
    </script>
    <template><component :is="selected">Hello</component></template>`,
    diagnostic: 'gt-vue',
  },
];

describe('programmatic rich translation safety', () => {
  it.each(renderSafetyProbes)('$name', async ({ source, diagnostic }) => {
    const output = await extractFromVueSource(
      source,
      '/fixtures/RenderFunctionSafety.vue',
      { projectRoot: '/fixtures' }
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(diagnostic);
  });
});

/**
 * Alias chains guard the analyzer against super-linear re-analysis and deep
 * recursion. Growth is measured with the analyzer's deterministic visit
 * counters, never wall-clock time, so the assertions are stable under load.
 */
describe.each([
  {
    kind: 'immutable container',
    selector: (length: number) => `components${length}[selected]`,
    visitsPerAlias: 4,
    script(length: number): string {
      const declarations = [
        "import { T } from 'gt-vue';",
        'const components0 = [T];',
      ];
      for (let index = 1; index <= length; index += 1) {
        declarations.push(`const components${index} = components${index - 1};`);
      }
      declarations.push('const selected = getIndex();');
      return declarations.join('\n');
    },
  },
  {
    kind: 'scalar component',
    selector: () => 'registry[key]',
    visitsPerAlias: 10,
    script(length: number): string {
      const declarations = [
        "import { T } from 'gt-vue';",
        'const Component0 = T;',
      ];
      for (let index = 1; index <= length; index += 1) {
        declarations.push(`const Component${index} = Component${index - 1};`);
      }
      declarations.push(`const registry = [Component${length}];`);
      declarations.push('const key = getIndex();');
      return declarations.join('\n');
    },
  },
])('$kind alias chains', ({ script, selector, visitsPerAlias }) => {
  it('keeps analyzer visits linear in the chain length', () => {
    const smaller = collectAnalyzerStats(script(100));
    const larger = collectAnalyzerStats(script(200));

    for (const key of Object.keys(larger) as Array<keyof typeof larger>) {
      expect(larger[key], key).toBeLessThanOrEqual(smaller[key] * 2 + 10);
    }
    expect(
      Object.values(larger).reduce((total, visits) => total + visits, 0)
    ).toBeLessThanOrEqual(200 * visitsPerAlias);
  });

  it('fails closed for a thousand aliases', async () => {
    const output = await extractFromVueSource(
      `<script setup>${script(1_000)}</script>
        <template>
          <component :is="${selector(1_000)}">Hidden</component>
        </template>`,
      '/fixtures/AliasChain.vue',
      { projectRoot: '/fixtures' }
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(POSSIBLE_COMPONENT_ALIAS);
  });
});
