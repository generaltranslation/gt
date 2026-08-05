import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from '../../index.js';

const POSSIBLE_ALIAS_DIAGNOSTIC =
  'Could not statically resolve possible gt-vue component alias';

type RefComputedProbe = {
  /** Human-readable Vue identity rule exercised by the probe. */
  name: string;
  /** Statements inserted into the fixture's script setup block. */
  code: string;
  /** Whether Vue's top-level unwrapped value can contain `<T>`. */
  possibleT: boolean;
};

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
const refComputedProbes: RefComputedProbe[] = [
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
];

describe('Vue ref and computed identity semantics', () => {
  it.each(refComputedProbes)('$name', async ({ code, possibleT }) => {
    const output = await extractFromVueSource(
      createFixture(code),
      '/fixtures/RefComputedIdentity.vue',
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

/** Creates an SFC that relies on Vue's top-level template ref unwrapping. */
function createFixture(code: string): string {
  return `<script setup>
    import { T } from 'gt-vue';
    import {
      computed,
      markRaw,
      readonly,
      ref,
      shallowReadonly,
      shallowRef,
      unref,
    } from 'vue';
    ${code}
    const key = getIndex();
  </script>
  <template><component :is="registry[key]">Hidden</component></template>`;
}
