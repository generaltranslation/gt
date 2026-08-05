import type { GTComponentName, VueBuiltinName } from '../types.js';
import type { KnownValue } from './model.js';

/** Public gt-vue component exports recognized by script analysis. */
export const COMPONENT_IMPORTS = new Set<GTComponentName>([
  'T',
  'Var',
  'Num',
  'DateTime',
  'Currency',
  'Plural',
  'Branch',
]);

/** Vue exports whose exact runtime identity changes rich traversal. */
export const VUE_BUILTIN_IMPORTS = new Set<VueBuiltinName>([
  'Fragment',
  'Suspense',
]);

/** Array methods that do not mutate the receiver's retained identity. */
export const READONLY_ARRAY_TRANSFORMS = new Set([
  'at',
  'concat',
  'entries',
  'every',
  'filter',
  'find',
  'findIndex',
  'findLast',
  'findLastIndex',
  'flat',
  'flatMap',
  'forEach',
  'includes',
  'indexOf',
  'join',
  'keys',
  'lastIndexOf',
  'map',
  'reduce',
  'reduceRight',
  'slice',
  'some',
  'toReversed',
  'toSorted',
  'toSpliced',
  'values',
  'with',
]);

/** Unbound globals whose values cannot be gt-vue translation identities. */
export const ORDINARY_GLOBAL_VALUES = new Set([
  'Array',
  'BigInt',
  'Boolean',
  'Date',
  'Error',
  'Map',
  'Number',
  'Object',
  'RegExp',
  'Set',
  'String',
  'Symbol',
  'WeakMap',
  'WeakSet',
  'undefined',
]);

/** Returns the recognized identity of one gt-vue or Vue export. */
export function knownExport(
  source: 'gt-vue' | 'vue',
  name: string
): KnownValue | undefined {
  if (source === 'vue') {
    if (name === 'defineComponent') return { type: 'defineComponent' };
    if (name === 'markRaw') return { type: 'identity' };
    if (name === 'unref') {
      return {
        type: 'container-wrapper',
        kind: 'unref',
        writePolicy: 'forward',
      };
    }
    if (name === 'toRaw') {
      return {
        type: 'container-wrapper',
        kind: 'to-raw',
        writePolicy: 'forward',
      };
    }
    if (name === 'computed') return { type: 'vue-wrapper', kind: 'computed' };
    if (name === 'ref' || name === 'shallowRef') {
      return { type: 'vue-wrapper', kind: 'ref' };
    }
    if (name === 'readonly') {
      return {
        type: 'container-wrapper',
        kind: 'readonly',
        writePolicy: 'readonly-deep',
      };
    }
    if (name === 'shallowReadonly') {
      return {
        type: 'container-wrapper',
        kind: 'shallow-readonly',
        writePolicy: 'readonly-shallow',
      };
    }
    if (name === 'reactive') {
      return {
        type: 'container-wrapper',
        kind: 'reactive',
        writePolicy: 'forward',
      };
    }
    if (name === 'shallowReactive') {
      return {
        type: 'container-wrapper',
        kind: 'shallow-reactive',
        writePolicy: 'forward',
      };
    }
    return VUE_BUILTIN_IMPORTS.has(name as VueBuiltinName)
      ? { type: 'vue-builtin', name: name as VueBuiltinName }
      : undefined;
  }
  if (COMPONENT_IMPORTS.has(name as GTComponentName)) {
    return { type: 'component', name: name as GTComponentName };
  }
  if (name === 'msg') return { type: 'string', kind: 'msg' };
  if (name === 'useGT') return { type: 'hook', kind: 'gt' };
  if (name === 'useMessages') return { type: 'hook', kind: 'messages' };
  return undefined;
}

/** Produces a stable equality key for recognized runtime identities. */
export function knownValueKey(value: KnownValue): string {
  if (value.type === 'component') return `component:${value.name}`;
  if (value.type === 'hook') return `hook:${value.kind}`;
  if (value.type === 'string') return `string:${value.kind}`;
  if (value.type === 'namespace') return `namespace:${value.source}`;
  if (value.type === 'vue-builtin') return `vue-builtin:${value.name}`;
  if (value.type === 'vue-wrapper') return `vue-wrapper:${value.kind}`;
  if (value.type === 'container-wrapper') {
    return `container-wrapper:${value.kind}`;
  }
  if (value.type === 'identity') return 'identity';
  return 'defineComponent';
}
