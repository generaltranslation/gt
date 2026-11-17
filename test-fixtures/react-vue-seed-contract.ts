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
    reactHash: '7ea6fcb733e12e9b',
    reactWireFingerprint:
      'daa2e12cae39e9603be51cd1886f974423f5297c75d0d5aaaff66bb39ebca974',
    vueHash: '91b4112135f7a910',
    vueWireFingerprint:
      '3c98e72de90360b9dc52e296a443cd9e650df98e9d62b70a0f0960dfc6c65c00',
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
    reactHash: 'a26e6d6f63ba42ad',
    reactWireFingerprint:
      '5099ce4ab7ffdf9f590b07fb08f28bfa414abda9fdf4e00729b65c2a3e395579',
    vueHash: '36f831a5d0cf4a2b',
    vueWireFingerprint:
      '8a63c1066ed7bb0585c7955ce7e1b24cebb194b0bb1b2605b225505305e279d0',
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
    reactHash: 'f73e372f65a7f3f6',
    reactWireFingerprint:
      'e5b373cc85c5df4e4b6917d4cc43ae61613c6150f5537b68522322f788b1e0d2',
    vueHash: 'ff7fc1557139c3df',
    vueWireFingerprint:
      '87a8f6b320cdb1d0036505e6ccfeaf294c00d833de7bd29108f3bea8e863e665',
  },
  {
    id: 'complex-cases/mixed-component-types',
    reason: 'vue-text-coalescing',
    reactHash: '7797f8953eed8465',
    reactWireFingerprint:
      '865ac58771958c9725b74eb1ec9753137b2dcd99e100567928f1878815e2afc6',
    vueHash: 'd98310449b8d0b06',
    vueWireFingerprint:
      'a3ea16cbec0d9cfc2fdc13ea1f8a5860573dbaa170e637a87a7a2e9863968f54',
  },
  {
    id: 'complex-cases/mixed-element-types-in-branches',
    reason: 'vue-text-coalescing',
    reactHash: '539b5549fea0a070',
    reactWireFingerprint:
      'dd9560afd9ccf742763b4eab549873c40f93ee3173df5cd78fd4de15ecbaebaa',
    vueHash: '91b9f48a84f435eb',
    vueWireFingerprint:
      'f9ef6a4cb655baecb26fc039bd21706c56f86251901aee8dcfa686f67e2ade90',
  },
  {
    id: 'complex-cases/more-extreme-edge-cases',
    reason: 'unsupported-named-variable',
    reactHash: '062813d53f023f94',
    reactWireFingerprint:
      'cb0a7beceae6562bc75055f57dc6a0373d8ef177587f2d9ebe5c6a2c19bfa901',
    vueHash: 'd50f668ecd2c1e7b',
    vueWireFingerprint:
      '70c740f55cb9a05f8adfa2561e6801c49e6b7caeebe49f165d22fe1472c8c9ed',
  },
  {
    id: 'complex-cases/multiple-variable-types-in-branch',
    reason: 'unsupported-named-variable',
    reactHash: 'a48b2e3ce736190b',
    reactWireFingerprint:
      'f806a380f74eeb594beeb41203096aad74d9fe40a7845bb87ecd4ec6bc7d7669',
    vueHash: '55afbe10270e6e5b',
    vueWireFingerprint:
      '385da4e255487cab7b63000e4b5a6b931ae9bb940c1bc25b6656f5dcfd731df1',
  },
  {
    id: 'complex-cases/whitespace',
    reason: 'vue-display-string-erasure',
    reactHash: '58ee060a346fa9e4',
    reactWireFingerprint:
      '81bc354befd6e24b2dd9b066f90173a3706a82427cbbb14158771285250cbeba',
    vueHash: 'baa1535a8df0761a',
    vueWireFingerprint:
      'a827bae09e3dbaa030cbad5f79e1b40046808b4036f527017a4caa13fe2c9663',
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
