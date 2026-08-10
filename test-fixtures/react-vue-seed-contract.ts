/**
 * Closed reasons why a React seed cannot participate in exact Vue parity yet.
 *
 * This list intentionally describes capabilities, never an alternate Vue
 * source or hash. Every paired seed not listed here must match React exactly.
 */
export type NonPortableSeed =
  | {
      id: string;
      reason: 'unsupported-derive';
    }
  | {
      id: string;
      reason: 'unsupported-named-variable';
    }
  | {
      id: string;
      reason: 'vue-display-string-erasure';
    };

/**
 * Exhaustive allowlist of presently non-portable React seeds.
 *
 * Keep this list narrow. Adding an entry removes a seed from exact runtime and
 * extractor parity, so each reason is independently proven against its source
 * fixture by the test harness. Implementing one of these capabilities should
 * remove entries from this list and increase the exact-parity count.
 */
export const NON_PORTABLE_SEEDS = [
  {
    id: 'complex-cases/five-level-nesting',
    reason: 'unsupported-named-variable',
  },
  {
    id: 'complex-cases/many-edge-cases',
    reason: 'unsupported-named-variable',
  },
  {
    id: 'complex-cases/more-extreme-edge-cases',
    reason: 'unsupported-named-variable',
  },
  {
    id: 'complex-cases/multiple-variable-types-in-branch',
    reason: 'unsupported-named-variable',
  },
  {
    id: 'complex-cases/whitespace',
    reason: 'vue-display-string-erasure',
  },
  {
    id: 't-component/simple/expressions/null/fragment-null',
    reason: 'vue-display-string-erasure',
  },
  {
    id: 't-component/simple/expressions/null/plain-null',
    reason: 'vue-display-string-erasure',
  },
  {
    id: 't-component/simple/expressions/static-boolean/array',
    reason: 'vue-display-string-erasure',
  },
  {
    id: 't-component/simple/expressions/static-boolean/false',
    reason: 'vue-display-string-erasure',
  },
  {
    id: 't-component/simple/expressions/static-boolean/fragment-false',
    reason: 'vue-display-string-erasure',
  },
  {
    id: 't-component/simple/expressions/static-boolean/fragment-true',
    reason: 'vue-display-string-erasure',
  },
  {
    id: 't-component/simple/expressions/static-boolean/true',
    reason: 'vue-display-string-erasure',
  },
  {
    id: 't-component/simple/expressions/static-special-identifiers',
    reason: 'vue-display-string-erasure',
  },
  {
    id: 'variable-components/static/branches',
    reason: 'unsupported-derive',
  },
  {
    id: 'variable-components/static/simple',
    reason: 'unsupported-derive',
  },
  {
    id: 'variable-components/static/ternaries',
    reason: 'unsupported-derive',
  },
  {
    id: 'variable-components/var/simple/name',
    reason: 'unsupported-named-variable',
  },
] as const satisfies readonly NonPortableSeed[];

/** Exact parity cannot regress below the first complete Vue seed port. */
export const MINIMUM_EXACT_SEED_COUNT = 67;
