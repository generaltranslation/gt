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
  /** SHA-256 of React's complete canonical semantic wire. */
  reactWireFingerprint: string;
  /** Vue's exact runtime hash at this documented framework boundary. */
  vueHash: string;
  /** SHA-256 of Vue's complete canonical semantic wire. */
  vueWireFingerprint: string;
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
    reactWireFingerprint:
      'ee17e63c506b6403c3a55cc7916883b686b46cb735be38a912ad5837301466d9',
    vueHash: 'eff4cbedacb93209',
    vueWireFingerprint:
      'b46ccf96a517f87000ac40666bf7e376a10da4f9a8e6d4e28ef0ad72fcea4abe',
  },
  {
    id: 'complex-cases/deeply-nested-branch-components',
    reason: 'vue-text-coalescing',
    reactHash: 'a3bad22afc92233b',
    reactWireFingerprint:
      'f34eb201d07f59eb06ec74971a5de5c9475b7cd71af2d21fa49f0d23fd978fd8',
    vueHash: '106bf1290639a683',
    vueWireFingerprint:
      '8cf7cc44bf25b57b1a219c8fd45be27879da4f37d39eac8cfc306cb7e67f8024',
  },
  {
    id: 'complex-cases/duplicate-branches',
    reason: 'vue-text-coalescing',
    reactHash: 'bc1400bbcd8c5a7a',
    reactWireFingerprint:
      '6aac257b2328d31aa7d407b06a829e353d752de88256463fdd8d2f0c740af7e0',
    vueHash: '5a4d78a654b797d7',
    vueWireFingerprint:
      '960f52b9f83d547c02f06c36b3b957d0bbeb0659c94d4be9f7db9a2f634da76e',
  },
  {
    id: 'complex-cases/five-level-nesting',
    reason: 'unsupported-named-variable',
    reactHash: '9095e84edac4763a',
    reactWireFingerprint:
      'd6ea05ab8aaf67a3aa1121c9eef0769fb59bad81ad8384730b7fa60a4ded2b75',
    vueHash: '753b41fcf7deac7b',
    vueWireFingerprint:
      '4c3f137cda22915c5b350bffe36e4cd06b171f445d8845b5e0e0cafe1fd68a4c',
  },
  {
    id: 'complex-cases/long-content-string',
    reason: 'vue-text-coalescing',
    reactHash: 'd5fbcdfef5e87db1',
    reactWireFingerprint:
      'deaca7d51035bd50d31e6aabee331ba3d470b667fe6cd76d3d3b2dd3a7eb4aa5',
    vueHash: '9522a83f299f74ab',
    vueWireFingerprint:
      '1987c5bd1952a21daa3f1392ca3a468c1417dd8d14d1e6f43bf637995d546e30',
  },
  {
    id: 'complex-cases/many-edge-cases',
    reason: 'unsupported-named-variable',
    reactHash: '9975ce1096bddd02',
    reactWireFingerprint:
      '579eb97592b42d288bcfc4b34e99cffb6d64bc397bba37006bfb403e91e43e9b',
    vueHash: '10953a811b4b0004',
    vueWireFingerprint:
      '289d1f04942ddeb88d7385bfe0deff1136206261cceef80f0653ce80f5ebe531',
  },
  {
    id: 'complex-cases/mixed-component-types',
    reason: 'vue-text-coalescing',
    reactHash: '62b7f2d2a37f1bf9',
    reactWireFingerprint:
      '7d363765ed8ab4e110c62cf9a5a3e2ae7f03dd5914b83bedc6ea406960da8f87',
    vueHash: 'ab40f072d3b2c994',
    vueWireFingerprint:
      '345a5b1d0201651474c1305d486c59bfbeedade5d79e40584c06584417690b03',
  },
  {
    id: 'complex-cases/mixed-element-types-in-branches',
    reason: 'vue-text-coalescing',
    reactHash: '0278d0825cf63b05',
    reactWireFingerprint:
      '9943e9a7be440716771166adab7f402a006f31112c9a2f19bea980bfac7d7d79',
    vueHash: 'b69db633c9dff2c5',
    vueWireFingerprint:
      'd59dfc5aa5e4d6fa2a5ab11c378cddcab8e51787141287a1a6227a8efc6bb808',
  },
  {
    id: 'complex-cases/more-extreme-edge-cases',
    reason: 'unsupported-named-variable',
    reactHash: '6842ebd738b87f3a',
    reactWireFingerprint:
      '67801acb2b9e616240f1f69cd01ca8ad4539e6a41e420fbee60e82890b51c118',
    vueHash: '95eb43bc7e2793da',
    vueWireFingerprint:
      '59248b68b3d2cced3c7455f1ae1ef6382809ee5447cf9b2c37f933488ac956f6',
  },
  {
    id: 'complex-cases/multiple-variable-types-in-branch',
    reason: 'unsupported-named-variable',
    reactHash: '3147331853462b48',
    reactWireFingerprint:
      '4d4ad57869859068246c4cb7bb19f670b5727eab59c4e9e83c9b3a9b9ea72b48',
    vueHash: 'fe62b27903b6a493',
    vueWireFingerprint:
      'ac517725c4838068f78a12c3f7aa49a6e1b6effe8b34e32c4dde456a5e0da87f',
  },
  {
    id: 'complex-cases/whitespace',
    reason: 'vue-display-string-erasure',
    reactHash: '711b912bc06378a1',
    reactWireFingerprint:
      '005ad8e4229d9a88e46e02f86ef508a03daf70f09a73ce410ec8cab3012cd42e',
    vueHash: 'c22149da13c57a75',
    vueWireFingerprint:
      'a43e49231a2ec374eea6084a5d7925e9b172976f5389e7016e2a2341f8f772f5',
  },
  {
    id: 'complex-cases/whitespace-preservation-complex-structure',
    reason: 'vue-text-coalescing',
    reactHash: 'df2fcc8f82538d01',
    reactWireFingerprint:
      '280f3cfff41b49b6e37d12bda1ac58c11852bd5e0c62f46341975ace844c2fa8',
    vueHash: '6b60b0ab867926a4',
    vueWireFingerprint:
      'e8ba253eed4bbc7f78e725f86e115c03c4fff14cd536defcae67512faf522361',
  },
  {
    id: 't-component/simple/expressions/null/fragment-null',
    reason: 'vue-display-string-erasure',
    reactHash: 'a013c005483cdd19',
    reactWireFingerprint:
      '6621d181dede8e5066f8d89bf06c7daf4c2485427bc45babef15fc4e526d6004',
    vueHash: 'a013c005483cdd19',
    vueWireFingerprint:
      '17524aa1608c26ced68e84e3b0e61332620c62acc891363d275aec63c7b97599',
  },
  {
    id: 't-component/simple/expressions/null/plain-null',
    reason: 'vue-display-string-erasure',
    reactHash: '471b9124c31817e9',
    reactWireFingerprint:
      '2bc83fc825929a23351bb6c5966525d9e7eb8c548903ba20e1b5cbb384753706',
    vueHash: '5a72d4120af78654',
    vueWireFingerprint:
      '68531113e40fffcea6caa4b72302c47015bb82b9e9ff2ceb9f2c6953e5f9a2b0',
  },
  {
    id: 't-component/simple/expressions/static-boolean/array',
    reason: 'vue-display-string-erasure',
    reactHash: '9ff224ca1118e4df',
    reactWireFingerprint:
      '8b46a4209a3eb4202e062f4d195d8c79d99577bbe76e7323c5db84f75e5784c0',
    vueHash: '1ae5ad3f1db215c1',
    vueWireFingerprint:
      '98c5c5c5025dba315dce2932b8fee8782dd578c21f2f30caa02fd3be36ea3dfb',
  },
  {
    id: 't-component/simple/expressions/static-boolean/false',
    reason: 'vue-display-string-erasure',
    reactHash: 'd98d8886a31c98f3',
    reactWireFingerprint:
      'd7558fd9aaedfc894dc306ac51a78789346aa9bc93e6a7d3505decf02cedd0d7',
    vueHash: '87a04f81044aef74',
    vueWireFingerprint:
      '25224ee6dbae2679ad94961acd072c898cfbb39e6368d349b3b6f78ed798e74e',
  },
  {
    id: 't-component/simple/expressions/static-boolean/fragment-false',
    reason: 'vue-display-string-erasure',
    reactHash: 'a013c005483cdd19',
    reactWireFingerprint:
      '6621d181dede8e5066f8d89bf06c7daf4c2485427bc45babef15fc4e526d6004',
    vueHash: '3572f24bad84aee9',
    vueWireFingerprint:
      '685179d7fa0f8c717392974620b8122331f385760deaa8e0afe7dd0a0f518510',
  },
  {
    id: 't-component/simple/expressions/static-boolean/fragment-true',
    reason: 'vue-display-string-erasure',
    reactHash: '200db4fbcabc7d06',
    reactWireFingerprint:
      'bf850d0fd943301423da438bd0fb89720677d65ee16d2b10e4f7abb8705471dc',
    vueHash: '6d6d11f10ff17065',
    vueWireFingerprint:
      '49eb25a34b986b188f4246503f7adb2d27598d085553666b6b422d7bd42d9a28',
  },
  {
    id: 't-component/simple/expressions/static-boolean/true',
    reason: 'vue-display-string-erasure',
    reactHash: '73b6b211a4122ba8',
    reactWireFingerprint:
      'eff89c1a51a4b18c86475e15ed50a721accaf1f8a8afbd6fa841df8ab45ad34a',
    vueHash: '6d23edcaf7dc34aa',
    vueWireFingerprint:
      '42068042447429e8f994b96325398419ee24bd19b088c66e53a237f6f4a845e1',
  },
  {
    id: 't-component/simple/expressions/static-special-identifiers',
    reason: 'vue-display-string-erasure',
    reactHash: '4f82a98ad0b111d9',
    reactWireFingerprint:
      '04a7c51d9be6f295c808f14d3a43041cca6504e0c9c40db5a75c333135ab16c6',
    vueHash: 'f758c211b552cd3e',
    vueWireFingerprint:
      '8269e5a8a9ace211905c3ccf9c8007a920d6d1acb7abaaa2e87d5e6d583f9ae9',
  },
  {
    id: 'variable-components/static/branches',
    reason: 'unsupported-derive',
    reactHash: '151c5ea756354da4',
    reactWireFingerprint:
      '3be85713219205ae75819cc53f681e2f8b62b4504d1d24bb84f891c3ea3078cd',
    vueHash: 'fd88ed0e98e2d8ee',
    vueWireFingerprint:
      '73d8e59419439f9048bc5f896b97d3b99e6bd08751c0ff0c8fb7c0b2800bb550',
  },
  {
    id: 'variable-components/static/simple',
    reason: 'unsupported-derive',
    reactHash: '4b9fdc8e2a028557',
    reactWireFingerprint:
      'f2d65eef00ececabdfbdb1e8284039f34f0dd723221b9d12c71f78e6b6a8a399',
    vueHash: '287448edce495a71',
    vueWireFingerprint:
      '60b6d835b704a777d66f364c92ce737c2cba644e64d3736f07f4e90c4887007d',
  },
  {
    id: 'variable-components/static/ternaries',
    reason: 'unsupported-derive',
    reactHash: 'b504e6005f6d2aad',
    reactWireFingerprint:
      '3e8be2ea97083ce46b66635d86f3067b0e24af42265bd51547b1393deff1523d',
    vueHash: '28da75b7c45137da',
    vueWireFingerprint:
      'e827b9be85bce5998f0f6ec661e370ec36d672cdf1d48c3d1cb3db7bbb412a00',
  },
  {
    id: 'variable-components/var/simple/name',
    reason: 'unsupported-named-variable',
    reactHash: '5313ec64034eb6b2',
    reactWireFingerprint:
      '50bc703891f62d647fc73f8f1ce5d119d1020049cbeb815c0c546dbcf0c80ecc',
    vueHash: '2271a4ba8a2d5cfd',
    vueWireFingerprint:
      '54a3dc0f361913aa2ba6813cb47013e3a574f5e61216411939c097241925cdc6',
  },
] as const satisfies readonly NonPortableSeed[];

/** Exact parity cannot regress below the first complete Vue seed port. */
export const MINIMUM_EXACT_SEED_COUNT = 60;
