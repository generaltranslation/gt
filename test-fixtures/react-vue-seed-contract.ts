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
    reactHash: '956e7cba6e2ade16',
    reactWireFingerprint:
      '86c3e27297268d70d9e2e9fb85415760203cbf0502f86a9d623512d3e5c3402d',
    vueHash: '25ee935e49220263',
    vueWireFingerprint:
      'f7630dfb94b97353ce2062f6afdf8bfcdab55e3222e428dcc82267e034921b17',
  },
  {
    id: 'complex-cases/deeply-nested-branch-components',
    reason: 'vue-text-coalescing',
    reactHash: 'e2d2bfa3d3281af2',
    reactWireFingerprint:
      'd3d880339946116798bb7e9d3ff7edb7fd56aa3041f5a24047477ede3f3e9291',
    vueHash: 'aabf0b1d4a550db1',
    vueWireFingerprint:
      'eb1c27e7b3bd0cea1b937619668d4a9280fc6dde7a87acf32e8353e1947914d0',
  },
  {
    id: 'complex-cases/duplicate-branches',
    reason: 'vue-text-coalescing',
    reactHash: 'd16f07aa91ff3ce3',
    reactWireFingerprint:
      '266d8f28d4ccf4a16cbe3ce320fdd94f8216fa11cfec8b461c540197863312a9',
    vueHash: '1e5da9934e4e228d',
    vueWireFingerprint:
      '28e1f5038ef0570e61f357ead1f761db90b8ef7cf58aae6908cd13ca304f3546',
  },
  {
    id: 'complex-cases/five-level-nesting',
    reason: 'unsupported-named-variable',
    reactHash: 'd95c37b8713a162a',
    reactWireFingerprint:
      '44ddcc31c525a48c1562e706427a1e758ba08b1f701f7a85e4e3eb07c942efd3',
    vueHash: '22d47431e86965d7',
    vueWireFingerprint:
      '28c410361d98c3245d5df978e9e1fc197fcfe2d344577c9020aa9e6203f98c8b',
  },
  {
    id: 'complex-cases/long-content-string',
    reason: 'vue-text-coalescing',
    reactHash: 'b6f724279e2928ee',
    reactWireFingerprint:
      '92d6d8ec04dfcb361b3886e211e2f2f33bacbcddedc47f815f82aedb229dd207',
    vueHash: '08c78ffe201a7ce7',
    vueWireFingerprint:
      '6045ef7706f5b5b80d4544295db7e8e5e4b0941a9b6fdc01b10d601f23ec2b6e',
  },
  {
    id: 'complex-cases/many-edge-cases',
    reason: 'unsupported-named-variable',
    reactHash: '62e75a0353daf47d',
    reactWireFingerprint:
      '7a4ea1900ebe00c14a8a04a196b0c8303b359bcca0edafb64ba3a4db1e738790',
    vueHash: '477589c8e27b73eb',
    vueWireFingerprint:
      '19700b6e8ac60debee959413771f4c640b2fc8b0dc821714b0ed8b3b4b260773',
  },
  {
    id: 'complex-cases/mixed-component-types',
    reason: 'vue-text-coalescing',
    reactHash: '390c787264b35a73',
    reactWireFingerprint:
      'b18c8f9e9dde3175ed7f37ba20154ab47c5da178894a3d8f08c9433816e2ffcc',
    vueHash: '42f55dc5b21770ef',
    vueWireFingerprint:
      '64e058b6919552a93c0098f72fabe22e2192a1b686243d4c11f9a9c3292893a5',
  },
  {
    id: 'complex-cases/mixed-element-types-in-branches',
    reason: 'vue-text-coalescing',
    reactHash: '81849ed8eee80afa',
    reactWireFingerprint:
      'f8220ccc334213a4b9764c9fb6ca4b122fffb47aad4d623fe6aeb0da7aba2a05',
    vueHash: 'e318c44be48081d8',
    vueWireFingerprint:
      '5dcf7b74401f17c9c6f2bece60976468406c9b887393e92e1a30eeb7b679b609',
  },
  {
    id: 'complex-cases/more-extreme-edge-cases',
    reason: 'unsupported-named-variable',
    reactHash: '1ea13bd33e3b353e',
    reactWireFingerprint:
      'c9f1cf46d1ec20cc4336fbc44ec479233803ffd85d1e8b9ec40a6e0104c7b1ca',
    vueHash: 'e10cb2cf28acfbc9',
    vueWireFingerprint:
      '873fd741a9c8546659eaa06f2ec286049127b9f536698f1afedefc7911d83507',
  },
  {
    id: 'complex-cases/multiple-variable-types-in-branch',
    reason: 'unsupported-named-variable',
    reactHash: 'd244021848d879cf',
    reactWireFingerprint:
      '96f93f8d9c6bc9a52c80b229e8115bb16dca2dd4fc93203f4a34a8b4b5583bbd',
    vueHash: 'bcb76782676a1afb',
    vueWireFingerprint:
      '12fd5ffd7e8ec9ce8e78fb78be5226dc93249e16b1478db91d1649e52726c839',
  },
  {
    id: 'complex-cases/whitespace',
    reason: 'vue-display-string-erasure',
    reactHash: '9adbbb3db2f03ded',
    reactWireFingerprint:
      '82e8d5de22990a3908e283e3b092f8b1d1a509e7d6d0079467245f70ff38025f',
    vueHash: '70a4c197fa7e34d0',
    vueWireFingerprint:
      '427be441f971737021c9e06d7653a4c43e8ddd971f268e642790811c3f91c623',
  },
  {
    id: 'complex-cases/whitespace-preservation-complex-structure',
    reason: 'vue-text-coalescing',
    reactHash: 'c85228176b5e13b1',
    reactWireFingerprint:
      '2cde8c422b40a4a9aed12347691c11a4f581c8080d2f3674fbaf8292c5784c88',
    vueHash: '1893612cc8632dba',
    vueWireFingerprint:
      'b7b1190224632e619d3047f27f4f3edbf5b91181191d8ac7e4f88e98f957df58',
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
    reactHash: '46c75eba89924e88',
    reactWireFingerprint:
      '20ef6672c2e488602d7bca8f62aeb4a0cdbefb26233cc56e9e5818adfa51475f',
    vueHash: 'd6d6a275f1469411',
    vueWireFingerprint:
      '56eb7a56eb6c42f60647445deb8fa9de485d91d0970da7e1e4b3a4d67125c20e',
  },
  {
    id: 'variable-components/static/simple',
    reason: 'unsupported-derive',
    reactHash: 'c9923cb1cd39ee77',
    reactWireFingerprint:
      'c882f2e72be7ab745fb7b7004fe0d2a7649ce0493682fffc9c031a73f747f1fb',
    vueHash: 'abbc40433f7da1ca',
    vueWireFingerprint:
      '1415bf885b13d573216dae62417bc3c9b6c75e0166525ff8178459e564637cbd',
  },
  {
    id: 'variable-components/static/ternaries',
    reason: 'unsupported-derive',
    reactHash: 'b504e6005f6d2aad',
    reactWireFingerprint:
      'c5c43e261d8d12668327a0c9605166e8d23d7eee613a7fcdd1a0fff1fa7aa8c7',
    vueHash: 'a09e122863356cfa',
    vueWireFingerprint:
      'b0a152107f6ceafa97b2484a83985cbe90cbbb3383f10bc6b2a1bab8b1283c24',
  },
  {
    id: 'variable-components/var/simple/name',
    reason: 'unsupported-named-variable',
    reactHash: '5313ec64034eb6b2',
    reactWireFingerprint:
      '7c6a5b2059e3b9e476d34008f66f700f7c662f5db0b007a164cf62b63cef06d7',
    vueHash: 'bf3ca885fc9ed8b6',
    vueWireFingerprint:
      '86559330bd3911c6db7375a9b9296eb39411ecc09e091f92686fc04eb6d7d631',
  },
] as const satisfies readonly NonPortableSeed[];

/** Exact parity cannot regress below the first complete Vue seed port. */
export const MINIMUM_EXACT_SEED_COUNT = 60;
