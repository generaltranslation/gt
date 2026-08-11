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
      '2b907fe7033e78c2a55d1e8820212ff575bb8c812d54c9dd700726286aacd8f4',
    vueHash: 'eff4cbedacb93209',
    vueWireFingerprint:
      'faa927dd260620196c6c4146ef11267ea336da7f593a1c8004c3d7a6e4276737',
  },
  {
    id: 'complex-cases/deeply-nested-branch-components',
    reason: 'vue-text-coalescing',
    reactHash: 'a3bad22afc92233b',
    reactWireFingerprint:
      '2d5e9902f1082b568cb7f442d7a87d8dea15d1211440c08bd89848299029c618',
    vueHash: '106bf1290639a683',
    vueWireFingerprint:
      '62968a6026197f9fc03ca3787c27ce7ed3638e81f3f5badf34e90abd017d68cc',
  },
  {
    id: 'complex-cases/duplicate-branches',
    reason: 'vue-text-coalescing',
    reactHash: 'bc1400bbcd8c5a7a',
    reactWireFingerprint:
      '32107475fc754ef6e6f0bb8341adf139928e427c7f228d31e8f6319f95465013',
    vueHash: '5a4d78a654b797d7',
    vueWireFingerprint:
      '6c395203131f7635a2828b89e2e3baa52d5d38aa28f35d386334b76a0b3f5e8f',
  },
  {
    id: 'complex-cases/five-level-nesting',
    reason: 'unsupported-named-variable',
    reactHash: '9095e84edac4763a',
    reactWireFingerprint:
      '03f1d5029cc94dcbc3cb8a6abc1d8d7e296841e5ac013d1f406eac7b32f593af',
    vueHash: '753b41fcf7deac7b',
    vueWireFingerprint:
      '279145048f27fe82972cb6137e70672471e617fd4e2640575b0d72ec0bb78f15',
  },
  {
    id: 'complex-cases/long-content-string',
    reason: 'vue-text-coalescing',
    reactHash: 'd5fbcdfef5e87db1',
    reactWireFingerprint:
      '9a2ec011e7e8b996963c615bf6c267b3e42951bd873934394932e7a40ebb8312',
    vueHash: '9522a83f299f74ab',
    vueWireFingerprint:
      '718a9d356e106ebca7db3f94c541726ff891217555d91d13611e73dce71df9e4',
  },
  {
    id: 'complex-cases/many-edge-cases',
    reason: 'unsupported-named-variable',
    reactHash: '9975ce1096bddd02',
    reactWireFingerprint:
      '108e3c5b744acbd3ffd154d441d1613781d5422fba145d41a92d2060d67692eb',
    vueHash: '10953a811b4b0004',
    vueWireFingerprint:
      '2d3ba50475f138fff7faf4634cd7f5c82bd763d57776e428ca0d40c434206c4f',
  },
  {
    id: 'complex-cases/mixed-component-types',
    reason: 'vue-text-coalescing',
    reactHash: '62b7f2d2a37f1bf9',
    reactWireFingerprint:
      '90ed972763973ee2082f3cd61d2dfadfcfd4e4df7dc2aa0f7731421771ab4df8',
    vueHash: 'ab40f072d3b2c994',
    vueWireFingerprint:
      '3f4d24cd2733ae9b19314e98611a9f54d4a1b3f8766aef83ec2316aaf6db6e63',
  },
  {
    id: 'complex-cases/mixed-element-types-in-branches',
    reason: 'vue-text-coalescing',
    reactHash: '0278d0825cf63b05',
    reactWireFingerprint:
      '1cb71f00098bda4bd4084cee210a78666c8615a24f39cb64cba8743e0c675fb2',
    vueHash: 'b69db633c9dff2c5',
    vueWireFingerprint:
      '67a7d3c54fc1c52a4751106fb09c59efca64f52a691cf40ffd2cd12621d5dfef',
  },
  {
    id: 'complex-cases/more-extreme-edge-cases',
    reason: 'unsupported-named-variable',
    reactHash: '6842ebd738b87f3a',
    reactWireFingerprint:
      '6348c174a908f2cb8fedb241a8251fcf44764bb574c5aa08a5743fea834db691',
    vueHash: '95eb43bc7e2793da',
    vueWireFingerprint:
      'cb2d2e56fd145452d7881ffb381e8bdc402bdd3c5464817aa0eafb0c202989f7',
  },
  {
    id: 'complex-cases/multiple-variable-types-in-branch',
    reason: 'unsupported-named-variable',
    reactHash: '3147331853462b48',
    reactWireFingerprint:
      'daba5ddbff32e08ea5f927a7bd27d8140d4b64bdaf30f21a21f4f0604bdf5812',
    vueHash: 'fe62b27903b6a493',
    vueWireFingerprint:
      'b4fbfc3847bb61c16514075bee08e4ff13bdf0c20c80c0d022344b41365e8fc3',
  },
  {
    id: 'complex-cases/whitespace',
    reason: 'vue-display-string-erasure',
    reactHash: '711b912bc06378a1',
    reactWireFingerprint:
      '84199319c1db80b07da86e1b0e34ce041495c8dfc7062c54edd14bdd2cc85c06',
    vueHash: 'c22149da13c57a75',
    vueWireFingerprint:
      '4aaccb63133eba0459bfd1fe41cba6c61f998b2380c206f5b354189595465731',
  },
  {
    id: 'complex-cases/whitespace-preservation-complex-structure',
    reason: 'vue-text-coalescing',
    reactHash: 'df2fcc8f82538d01',
    reactWireFingerprint:
      '6e577c042f5dacc3caa6dbaed9de10eb27b011017bac911c80a775bf0cb1fdf6',
    vueHash: '6b60b0ab867926a4',
    vueWireFingerprint:
      '5cc52e4f0a1f6336cf31a12351bc5ea14662cc698ad721a44e7b3250221557ff',
  },
  {
    id: 't-component/simple/expressions/null/fragment-null',
    reason: 'vue-display-string-erasure',
    reactHash: 'a013c005483cdd19',
    reactWireFingerprint:
      '071c14c7253e4f2cfdb905ab57d1ac1ebe37ee6feecbf1bd7fbdae8311aa0cc0',
    vueHash: 'a013c005483cdd19',
    vueWireFingerprint:
      'e21816c878794165363221e4291698a9e9b1f04200fec555a6db9012a4a5d2ca',
  },
  {
    id: 't-component/simple/expressions/null/plain-null',
    reason: 'vue-display-string-erasure',
    reactHash: '471b9124c31817e9',
    reactWireFingerprint:
      '718510af2d06865175f266a92aa01cee14dd583238b449218698195d59f611a9',
    vueHash: '5a72d4120af78654',
    vueWireFingerprint:
      '59b723d56c59dbc0655db897fc9d2986cfceee0fb0738a70eb6593ce47aced3a',
  },
  {
    id: 't-component/simple/expressions/static-boolean/array',
    reason: 'vue-display-string-erasure',
    reactHash: '9ff224ca1118e4df',
    reactWireFingerprint:
      '64e49e0804deba86b921abb1ff001e867cc85404b1a07cef9d5ee5160731d1d4',
    vueHash: '1ae5ad3f1db215c1',
    vueWireFingerprint:
      '141b0fb70e0e2f83d598975f37163a1fc1e8ee5b87aff585bda5ba94f435f71d',
  },
  {
    id: 't-component/simple/expressions/static-boolean/false',
    reason: 'vue-display-string-erasure',
    reactHash: 'd98d8886a31c98f3',
    reactWireFingerprint:
      'f894a19150e48bb39b5daaccd413e94b9568fa09be2c7b6f795992faf859de24',
    vueHash: '87a04f81044aef74',
    vueWireFingerprint:
      '188f8451d7cba75e21432f4b9c151c5e801e11a54ba0ff0b11d8443be138e73c',
  },
  {
    id: 't-component/simple/expressions/static-boolean/fragment-false',
    reason: 'vue-display-string-erasure',
    reactHash: 'a013c005483cdd19',
    reactWireFingerprint:
      '071c14c7253e4f2cfdb905ab57d1ac1ebe37ee6feecbf1bd7fbdae8311aa0cc0',
    vueHash: '3572f24bad84aee9',
    vueWireFingerprint:
      '33e6af382a1382c9448469e031daf7b9cd84f9eb018b0e5f3600a0fe1a9f1524',
  },
  {
    id: 't-component/simple/expressions/static-boolean/fragment-true',
    reason: 'vue-display-string-erasure',
    reactHash: '200db4fbcabc7d06',
    reactWireFingerprint:
      '37421d0a8ad9b231489dbdd578eb25d0a2a385eb563ad30444839b15e83d5a9f',
    vueHash: '6d6d11f10ff17065',
    vueWireFingerprint:
      '6e19521ed2457c59508401f87dfb4d8dbe978b995171cd0b9ece75c31527521d',
  },
  {
    id: 't-component/simple/expressions/static-boolean/true',
    reason: 'vue-display-string-erasure',
    reactHash: '73b6b211a4122ba8',
    reactWireFingerprint:
      '8cd434f976b549e52d6e788d5b385f1a9b3e00063253ac10ea139ae0425d1baa',
    vueHash: '6d23edcaf7dc34aa',
    vueWireFingerprint:
      '76bf6c6a3cf717c766119b5dbc85aaaae92e76fb5fcb4d9b82b1807bfcb1900d',
  },
  {
    id: 't-component/simple/expressions/static-special-identifiers',
    reason: 'vue-display-string-erasure',
    reactHash: '4f82a98ad0b111d9',
    reactWireFingerprint:
      '252ab59c74a6b9f4b0c206874dcb96c37227c5ced7b202e3f11ed9d9256a49a2',
    vueHash: 'f758c211b552cd3e',
    vueWireFingerprint:
      '9a9319090df4cec6a6f1d526429b1ddf9b22829658b194d3a6388304dba1d78a',
  },
  {
    id: 'variable-components/static/branches',
    reason: 'unsupported-derive',
    reactHash: '151c5ea756354da4',
    reactWireFingerprint:
      '4719bbe59e4de1608be3fa4a3a7d8c01ae2f6f198a46fdb8f26c9a005776e51e',
    vueHash: 'fd88ed0e98e2d8ee',
    vueWireFingerprint:
      '4737ba27575cfa2ed3e4ab61c89a9a89ea64c82b19f5cb6c11eeb935f6304110',
  },
  {
    id: 'variable-components/static/simple',
    reason: 'unsupported-derive',
    reactHash: '4b9fdc8e2a028557',
    reactWireFingerprint:
      '406adffbcd6784a8701928fc7295fe8b71bfa69a5ca197b496a7effed5afbb18',
    vueHash: '287448edce495a71',
    vueWireFingerprint:
      '9b58ecc15713c62fd5000d975e7fed53205b6790db7a850f951ea8954fc32f3d',
  },
  {
    id: 'variable-components/static/ternaries',
    reason: 'unsupported-derive',
    reactHash: 'b504e6005f6d2aad',
    reactWireFingerprint:
      'c5c43e261d8d12668327a0c9605166e8d23d7eee613a7fcdd1a0fff1fa7aa8c7',
    vueHash: '28da75b7c45137da',
    vueWireFingerprint:
      'bae51dade912d0339dcbcc2512ec7ca96914af1eb7a349db1f726b0504efdc74',
  },
  {
    id: 'variable-components/var/simple/name',
    reason: 'unsupported-named-variable',
    reactHash: '5313ec64034eb6b2',
    reactWireFingerprint:
      '7c6a5b2059e3b9e476d34008f66f700f7c662f5db0b007a164cf62b63cef06d7',
    vueHash: '2271a4ba8a2d5cfd',
    vueWireFingerprint:
      'f9083abef8e21d4beb072d7b7dae702c2b1eafa43fc71bea9c5211eaddd2d9a9',
  },
] as const satisfies readonly NonPortableSeed[];

/** Exact parity cannot regress below the first complete Vue seed port. */
export const MINIMUM_EXACT_SEED_COUNT = 60;
