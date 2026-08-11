/**
 * Closed reasons why a React seed cannot participate in exact Vue parity yet.
 *
 * This list intentionally describes the primary framework boundary exercised
 * by each seed, never an alternate Vue source or hash. A large stress seed can
 * cross more than one boundary; every paired seed not listed here must still
 * match React exactly.
 */
export type NonPortableSeed = {
  id: string;
  /** React's exact runtime hash at this documented framework boundary. */
  reactHash: string;
  /** Vue's exact runtime hash at this documented framework boundary. */
  vueHash: string;
} & (
  | { reason: 'unsupported-derive' }
  | { reason: 'unsupported-named-variable' }
  | { reason: 'vue-display-string-erasure' }
  | { reason: 'vue-text-coalescing' }
);

/**
 * Exhaustive allowlist of presently non-portable React seeds.
 *
 * Keep this list narrow. Adding an entry removes a seed only from cross-runtime
 * React/Vue parity. The test harness still requires the Vue extractor to match
 * the Vue runtime for all 84 seeds. Each primary reason is evidenced against
 * its source fixture; implementing it should remove entries from this list and
 * increase the exact cross-runtime parity count.
 */
export const NON_PORTABLE_SEEDS = [
  {
    id: 'complex-cases/complex-fragment-nesting',
    reason: 'vue-text-coalescing',
    reactHash: '6c901a520d542fa8',
    vueHash: 'eff4cbedacb93209',
  },
  {
    id: 'complex-cases/deeply-nested-branch-components',
    reason: 'vue-text-coalescing',
    reactHash: 'a3bad22afc92233b',
    vueHash: '106bf1290639a683',
  },
  {
    id: 'complex-cases/duplicate-branches',
    reason: 'vue-text-coalescing',
    reactHash: 'bc1400bbcd8c5a7a',
    vueHash: '5a4d78a654b797d7',
  },
  {
    id: 'complex-cases/five-level-nesting',
    reason: 'unsupported-named-variable',
    reactHash: '9095e84edac4763a',
    vueHash: '753b41fcf7deac7b',
  },
  {
    id: 'complex-cases/long-content-string',
    reason: 'vue-text-coalescing',
    reactHash: 'd5fbcdfef5e87db1',
    vueHash: '9522a83f299f74ab',
  },
  {
    id: 'complex-cases/many-edge-cases',
    reason: 'unsupported-named-variable',
    reactHash: '9975ce1096bddd02',
    vueHash: '10953a811b4b0004',
  },
  {
    id: 'complex-cases/mixed-component-types',
    reason: 'vue-text-coalescing',
    reactHash: '62b7f2d2a37f1bf9',
    vueHash: 'ab40f072d3b2c994',
  },
  {
    id: 'complex-cases/mixed-element-types-in-branches',
    reason: 'vue-text-coalescing',
    reactHash: '0278d0825cf63b05',
    vueHash: 'b69db633c9dff2c5',
  },
  {
    id: 'complex-cases/more-extreme-edge-cases',
    reason: 'unsupported-named-variable',
    reactHash: '6842ebd738b87f3a',
    vueHash: '95eb43bc7e2793da',
  },
  {
    id: 'complex-cases/multiple-variable-types-in-branch',
    reason: 'unsupported-named-variable',
    reactHash: '3147331853462b48',
    vueHash: 'fe62b27903b6a493',
  },
  {
    id: 'complex-cases/whitespace',
    reason: 'vue-display-string-erasure',
    reactHash: '711b912bc06378a1',
    vueHash: 'c22149da13c57a75',
  },
  {
    id: 'complex-cases/whitespace-preservation-complex-structure',
    reason: 'vue-text-coalescing',
    reactHash: 'df2fcc8f82538d01',
    vueHash: '6b60b0ab867926a4',
  },
  {
    id: 't-component/simple/expressions/null/fragment-null',
    reason: 'vue-display-string-erasure',
    reactHash: 'a013c005483cdd19',
    vueHash: 'a013c005483cdd19',
  },
  {
    id: 't-component/simple/expressions/null/plain-null',
    reason: 'vue-display-string-erasure',
    reactHash: '471b9124c31817e9',
    vueHash: '5a72d4120af78654',
  },
  {
    id: 't-component/simple/expressions/static-boolean/array',
    reason: 'vue-display-string-erasure',
    reactHash: '9ff224ca1118e4df',
    vueHash: '1ae5ad3f1db215c1',
  },
  {
    id: 't-component/simple/expressions/static-boolean/false',
    reason: 'vue-display-string-erasure',
    reactHash: 'd98d8886a31c98f3',
    vueHash: '87a04f81044aef74',
  },
  {
    id: 't-component/simple/expressions/static-boolean/fragment-false',
    reason: 'vue-display-string-erasure',
    reactHash: 'a013c005483cdd19',
    vueHash: '3572f24bad84aee9',
  },
  {
    id: 't-component/simple/expressions/static-boolean/fragment-true',
    reason: 'vue-display-string-erasure',
    reactHash: '200db4fbcabc7d06',
    vueHash: '6d6d11f10ff17065',
  },
  {
    id: 't-component/simple/expressions/static-boolean/true',
    reason: 'vue-display-string-erasure',
    reactHash: '73b6b211a4122ba8',
    vueHash: '6d23edcaf7dc34aa',
  },
  {
    id: 't-component/simple/expressions/static-special-identifiers',
    reason: 'vue-display-string-erasure',
    reactHash: '4f82a98ad0b111d9',
    vueHash: 'f758c211b552cd3e',
  },
  {
    id: 'variable-components/static/branches',
    reason: 'unsupported-derive',
    reactHash: '151c5ea756354da4',
    vueHash: 'fd88ed0e98e2d8ee',
  },
  {
    id: 'variable-components/static/simple',
    reason: 'unsupported-derive',
    reactHash: '4b9fdc8e2a028557',
    vueHash: '287448edce495a71',
  },
  {
    id: 'variable-components/static/ternaries',
    reason: 'unsupported-derive',
    reactHash: 'b504e6005f6d2aad',
    vueHash: '28da75b7c45137da',
  },
  {
    id: 'variable-components/var/simple/name',
    reason: 'unsupported-named-variable',
    reactHash: '5313ec64034eb6b2',
    vueHash: '2271a4ba8a2d5cfd',
  },
] as const satisfies readonly NonPortableSeed[];

/** Exact parity cannot regress below the first complete Vue seed port. */
export const MINIMUM_EXACT_SEED_COUNT = 60;
