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
    reactHash: 'lW58um4q3hY',
    reactWireFingerprint:
      '86c3e27297268d70d9e2e9fb85415760203cbf0502f86a9d623512d3e5c3402d',
    vueHash: 'Je6TXkkiAmM',
    vueWireFingerprint:
      'f7630dfb94b97353ce2062f6afdf8bfcdab55e3222e428dcc82267e034921b17',
  },
  {
    id: 'complex-cases/deeply-nested-branch-components',
    reason: 'vue-text-coalescing',
    reactHash: 'H2bdMX_WuHI',
    reactWireFingerprint:
      '8db6bc4da03910fb79f6ea6118a619c7b04f8d9bfde29cd959d541a6afa8980a',
    vueHash: 'jKnKKFPqPCA',
    vueWireFingerprint:
      'd672ef588efdbfaaeddedb2a9fb296fba2ab93ddfecf8897a851eba350effdbe',
  },
  {
    id: 'complex-cases/duplicate-branches',
    reason: 'vue-text-coalescing',
    reactHash: 'vp0Hkf_QWl8',
    reactWireFingerprint:
      'a21c3b6f2afb66a4af879126d9d53d14216d3a9f2854ba405cf6f9c62cbc401b',
    vueHash: 'O3trk2npq9g',
    vueWireFingerprint:
      '65cc033075dfaa6352a2ec7c37acf45b953e5ba40b1fa1a3f1b5c4b8c0089e98',
  },
  {
    id: 'complex-cases/five-level-nesting',
    reason: 'unsupported-named-variable',
    reactHash: 'om5tb2O6Qq0',
    reactWireFingerprint:
      '5099ce4ab7ffdf9f590b07fb08f28bfa414abda9fdf4e00729b65c2a3e395579',
    vueHash: 'MP2nrO9odQg',
    vueWireFingerprint:
      'a86c58be3b2ef298e3c84d24a4c1d013c1c45becc135f2783246ed4010d77b84',
  },
  {
    id: 'complex-cases/long-content-string',
    reason: 'vue-text-coalescing',
    reactHash: 'MIzVsPxo86o',
    reactWireFingerprint:
      'aa346e37b39806334095d0df93afc7df12075804d190a03a0dfecb3c3659d3dc',
    vueHash: 'QZ5ypmBDpKc',
    vueWireFingerprint:
      '0fe3b30a7483af2e54f762c6e1488a04153fc937aaf4c47ef1dcc40d55a8da21',
  },
  {
    id: 'complex-cases/many-edge-cases',
    reason: 'unsupported-named-variable',
    reactHash: 'b3ucAKtc9VY',
    reactWireFingerprint:
      'a4c4d70dc85800d8814c1c1427ed23806bbaa5e5cb6e9dbdaf2ccf200a50a335',
    vueHash: 'Itbss1srWg0',
    vueWireFingerprint:
      'b0a2783b36b3829f982522e12fbd0c48ad3d54dabac54c1ca5d85aa016e7fef2',
  },
  {
    id: 'complex-cases/mixed-component-types',
    reason: 'vue-text-coalescing',
    reactHash: 'vp4RIlqCdYQ',
    reactWireFingerprint:
      'e848e85b53673fc3c57ede02e7b47a6f52a84a31fdd984faa969a529555fde7c',
    vueHash: 'Z644uuskNP8',
    vueWireFingerprint:
      'd4b7445cb5a6538a27cde55ff2b01129c8012cb1b4a4175b8d6ca3fa7a339fd9',
  },
  {
    id: 'complex-cases/mixed-element-types-in-branches',
    reason: 'vue-text-coalescing',
    reactHash: 'gYSe2O7oCvo',
    reactWireFingerprint:
      'f8220ccc334213a4b9764c9fb6ca4b122fffb47aad4d623fe6aeb0da7aba2a05',
    vueHash: '4xjES-SAgdg',
    vueWireFingerprint:
      '5dcf7b74401f17c9c6f2bece60976468406c9b887393e92e1a30eeb7b679b609',
  },
  {
    id: 'complex-cases/more-extreme-edge-cases',
    reason: 'unsupported-named-variable',
    reactHash: 'uKN7J_IOwOY',
    reactWireFingerprint:
      'ecb772422ae00092ef7cefb8f797d623d2af6eff0a8b8a13b12227c419ec7dd2',
    vueHash: 'sGTtBF_tmhQ',
    vueWireFingerprint:
      '357361caecb47e8cbe82c56faeca823dc73524f53ab5824d34d2cacdfd7f2171',
  },
  {
    id: 'complex-cases/multiple-variable-types-in-branch',
    reason: 'unsupported-named-variable',
    reactHash: '0kQCGEjYec8',
    reactWireFingerprint:
      '96f93f8d9c6bc9a52c80b229e8115bb16dca2dd4fc93203f4a34a8b4b5583bbd',
    vueHash: 'vLdngmdqGvs',
    vueWireFingerprint:
      '12fd5ffd7e8ec9ce8e78fb78be5226dc93249e16b1478db91d1649e52726c839',
  },
  {
    id: 'complex-cases/whitespace',
    reason: 'vue-display-string-erasure',
    reactHash: 'Vd2AMTPLWlw',
    reactWireFingerprint:
      '77c88ff24bde18fa069d44db9b8cfa47a845e64a19aded111baf7a6d0df9c735',
    vueHash: 'hrJvS-VJh34',
    vueWireFingerprint:
      'd435a45f7e41e06d46825c6f057542bf223db3d00104f4d5c89b1cf6cf9fc6cf',
  },
  {
    id: 'complex-cases/whitespace-preservation-complex-structure',
    reason: 'vue-text-coalescing',
    reactHash: 'PtamAcOliIg',
    reactWireFingerprint:
      '44951ae7c0bfd2b3bbd3e1b15dafaea61de3f1effdb35a7b8160a12432aeec57',
    vueHash: '3yhD3l7GSmk',
    vueWireFingerprint:
      '78a6516068fb2c2d9233340aede4f49a4a5cfbdf75c9e0764dfe93ef08314dd9',
  },
  {
    id: 't-component/simple/expressions/null/fragment-null',
    reason: 'vue-display-string-erasure',
    reactHash: 'oBPABUg83Rk',
    reactWireFingerprint:
      '071c14c7253e4f2cfdb905ab57d1ac1ebe37ee6feecbf1bd7fbdae8311aa0cc0',
    vueHash: 'oBPABUg83Rk',
    vueWireFingerprint:
      'e21816c878794165363221e4291698a9e9b1f04200fec555a6db9012a4a5d2ca',
  },
  {
    id: 't-component/simple/expressions/null/plain-null',
    reason: 'vue-display-string-erasure',
    reactHash: 'RxuRJMMYF-k',
    reactWireFingerprint:
      '718510af2d06865175f266a92aa01cee14dd583238b449218698195d59f611a9',
    vueHash: 'WnLUEgr3hlQ',
    vueWireFingerprint:
      '59b723d56c59dbc0655db897fc9d2986cfceee0fb0738a70eb6593ce47aced3a',
  },
  {
    id: 't-component/simple/expressions/static-boolean/array',
    reason: 'vue-display-string-erasure',
    reactHash: 'n_IkyhEY5N8',
    reactWireFingerprint:
      '64e49e0804deba86b921abb1ff001e867cc85404b1a07cef9d5ee5160731d1d4',
    vueHash: 'GuWtPx2yFcE',
    vueWireFingerprint:
      '141b0fb70e0e2f83d598975f37163a1fc1e8ee5b87aff585bda5ba94f435f71d',
  },
  {
    id: 't-component/simple/expressions/static-boolean/false',
    reason: 'vue-display-string-erasure',
    reactHash: '2Y2IhqMcmPM',
    reactWireFingerprint:
      'f894a19150e48bb39b5daaccd413e94b9568fa09be2c7b6f795992faf859de24',
    vueHash: 'h6BPgQRK73Q',
    vueWireFingerprint:
      '188f8451d7cba75e21432f4b9c151c5e801e11a54ba0ff0b11d8443be138e73c',
  },
  {
    id: 't-component/simple/expressions/static-boolean/fragment-false',
    reason: 'vue-display-string-erasure',
    reactHash: 'oBPABUg83Rk',
    reactWireFingerprint:
      '071c14c7253e4f2cfdb905ab57d1ac1ebe37ee6feecbf1bd7fbdae8311aa0cc0',
    vueHash: 'NXLyS62Eruk',
    vueWireFingerprint:
      '33e6af382a1382c9448469e031daf7b9cd84f9eb018b0e5f3600a0fe1a9f1524',
  },
  {
    id: 't-component/simple/expressions/static-boolean/fragment-true',
    reason: 'vue-display-string-erasure',
    reactHash: 'IA20-8q8fQY',
    reactWireFingerprint:
      '37421d0a8ad9b231489dbdd578eb25d0a2a385eb563ad30444839b15e83d5a9f',
    vueHash: 'bW0R8Q_xcGU',
    vueWireFingerprint:
      '6e19521ed2457c59508401f87dfb4d8dbe978b995171cd0b9ece75c31527521d',
  },
  {
    id: 't-component/simple/expressions/static-boolean/true',
    reason: 'vue-display-string-erasure',
    reactHash: 'c7ayEaQSK6g',
    reactWireFingerprint:
      '8cd434f976b549e52d6e788d5b385f1a9b3e00063253ac10ea139ae0425d1baa',
    vueHash: 'bSPtyvfcNKo',
    vueWireFingerprint:
      '76bf6c6a3cf717c766119b5dbc85aaaae92e76fb5fcb4d9b82b1807bfcb1900d',
  },
  {
    id: 't-component/simple/expressions/static-special-identifiers',
    reason: 'vue-display-string-erasure',
    reactHash: 'T4KpitCxEdk',
    reactWireFingerprint:
      '252ab59c74a6b9f4b0c206874dcb96c37227c5ced7b202e3f11ed9d9256a49a2',
    vueHash: '91jCEbVSzT4',
    vueWireFingerprint:
      '9a9319090df4cec6a6f1d526429b1ddf9b22829658b194d3a6388304dba1d78a',
  },
  {
    id: 'variable-components/static/branches',
    reason: 'unsupported-derive',
    reactHash: 'FRxep1Y1TaQ',
    reactWireFingerprint:
      '4719bbe59e4de1608be3fa4a3a7d8c01ae2f6f198a46fdb8f26c9a005776e51e',
    vueHash: '_YjtDpji2O4',
    vueWireFingerprint:
      '4737ba27575cfa2ed3e4ab61c89a9a89ea64c82b19f5cb6c11eeb935f6304110',
  },
  {
    id: 'variable-components/static/simple',
    reason: 'unsupported-derive',
    reactHash: 'S5_cjioChVc',
    reactWireFingerprint:
      '406adffbcd6784a8701928fc7295fe8b71bfa69a5ca197b496a7effed5afbb18',
    vueHash: 'e7lNY0EUpZ0',
    vueWireFingerprint:
      '2a2cfd0358e70f63c3c93f9213bb074b86de54302bbed09afede0182510cc1e6',
  },
  {
    id: 'variable-components/static/ternaries',
    reason: 'unsupported-derive',
    reactHash: 'tQTmAF9tKq0',
    reactWireFingerprint:
      'c5c43e261d8d12668327a0c9605166e8d23d7eee613a7fcdd1a0fff1fa7aa8c7',
    vueHash: 'KNp1t8RRN9o',
    vueWireFingerprint:
      'bae51dade912d0339dcbcc2512ec7ca96914af1eb7a349db1f726b0504efdc74',
  },
  {
    id: 'variable-components/var/simple/name',
    reason: 'unsupported-named-variable',
    reactHash: 'UxPsZANOtrI',
    reactWireFingerprint:
      '7c6a5b2059e3b9e476d34008f66f700f7c662f5db0b007a164cf62b63cef06d7',
    vueHash: 'vzyohfye2LY',
    vueWireFingerprint:
      '86559330bd3911c6db7375a9b9296eb39411ecc09e091f92686fc04eb6d7d631',
  },
] as const satisfies readonly NonPortableSeed[];

/** Exact parity cannot regress below the first complete Vue seed port. */
export const MINIMUM_EXACT_SEED_COUNT = 60;
