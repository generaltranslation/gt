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
      '69a8ca4ecf71583c660676a49ee71bb4e6fb462796e0857817265079b5e76e5b',
    vueHash: 'eff4cbedacb93209',
    vueWireFingerprint:
      'c2a175dc4cfd1c664b89a8a9164a98ee51873e050fa4408bd19bd5f44452fbcc',
  },
  {
    id: 'complex-cases/deeply-nested-branch-components',
    reason: 'vue-text-coalescing',
    reactHash: 'a3bad22afc92233b',
    reactWireFingerprint:
      '5afd5725d33093417fee78202805de07d7b3b8ea7ac7c7b9544da49dad516b89',
    vueHash: '106bf1290639a683',
    vueWireFingerprint:
      '1ae6856db331cfc015852c3daf570d6d99a77cbce282335841b9533742688270',
  },
  {
    id: 'complex-cases/duplicate-branches',
    reason: 'vue-text-coalescing',
    reactHash: 'bc1400bbcd8c5a7a',
    reactWireFingerprint:
      'ab33923ef904ad1a9f91f1dce780d77243f684084c8f22c7247bbe6c792455ae',
    vueHash: '5a4d78a654b797d7',
    vueWireFingerprint:
      '12a76afbe4b76c5fe7c3fde1b9082654a92f3714f0ecea817dc4d73ab2671ca3',
  },
  {
    id: 'complex-cases/five-level-nesting',
    reason: 'unsupported-named-variable',
    reactHash: '9095e84edac4763a',
    reactWireFingerprint:
      '96e2b110aa1794b775e4588933593748a4a73fb3fa0fe164f40155d30ad8fdbd',
    vueHash: '753b41fcf7deac7b',
    vueWireFingerprint:
      'ffcc71e8314bbfb69fc2a8b5cdb8f27322e1755fb4de920276f263d4e4df7b01',
  },
  {
    id: 'complex-cases/long-content-string',
    reason: 'vue-text-coalescing',
    reactHash: 'd5fbcdfef5e87db1',
    reactWireFingerprint:
      '9c27bf7bc2323599014ab52367d79c30b8e4438fa381965aba29158fb611c899',
    vueHash: '9522a83f299f74ab',
    vueWireFingerprint:
      'f9297c5933a54152bf826c288261e5581b37b360f5efe1a1e67ef63a6d828925',
  },
  {
    id: 'complex-cases/many-edge-cases',
    reason: 'unsupported-named-variable',
    reactHash: '9975ce1096bddd02',
    reactWireFingerprint:
      '285371674748c206b577a2420f50d79a511f60b322cb0c8da7733f0d69b31826',
    vueHash: '10953a811b4b0004',
    vueWireFingerprint:
      'a948d2644d88bf5a788c8f1c21689d3010228f7ba397bf81f2744673dc279954',
  },
  {
    id: 'complex-cases/mixed-component-types',
    reason: 'vue-text-coalescing',
    reactHash: '62b7f2d2a37f1bf9',
    reactWireFingerprint:
      '0cd9d65378e9af5940ea2dbeedd641d27148b1a997b07e9715a34df069df57a1',
    vueHash: 'ab40f072d3b2c994',
    vueWireFingerprint:
      '0b3e3b72af0b6174bb75762402d4bd27ce3e9f711e0d501dbc8f3ad947a56616',
  },
  {
    id: 'complex-cases/mixed-element-types-in-branches',
    reason: 'vue-text-coalescing',
    reactHash: '0278d0825cf63b05',
    reactWireFingerprint:
      '505bab5e292cb41fa18898167ef74dd820a141066950331d3452971df3dec85e',
    vueHash: 'b69db633c9dff2c5',
    vueWireFingerprint:
      'f1a847d300ed695c17012e9ab77c4655993d1f6ae14d66dd96e99c744cc32f3d',
  },
  {
    id: 'complex-cases/more-extreme-edge-cases',
    reason: 'unsupported-named-variable',
    reactHash: '6842ebd738b87f3a',
    reactWireFingerprint:
      '09e0e597fd5f38efc22925450855b99adf1f676e1acecfed00f6de8506c6cd3b',
    vueHash: '95eb43bc7e2793da',
    vueWireFingerprint:
      '49609a98f6836886f2b70361c5f6a59b7469dfdcbd18d62cf15f1794b4232974',
  },
  {
    id: 'complex-cases/multiple-variable-types-in-branch',
    reason: 'unsupported-named-variable',
    reactHash: '3147331853462b48',
    reactWireFingerprint:
      'b827b7385ba2801451c576e2b1634d414f3c60d3d2e3509077c5768b48f2e61a',
    vueHash: 'fe62b27903b6a493',
    vueWireFingerprint:
      'a975a3df200cc73c94d785c88175d103c500cd118c98766647fc5ab7b094f5d2',
  },
  {
    id: 'complex-cases/whitespace',
    reason: 'vue-display-string-erasure',
    reactHash: '711b912bc06378a1',
    reactWireFingerprint:
      'd44b5a689defe1aac4bf1951da8bb6c93030408b3ba688852e22866fe83ee470',
    vueHash: 'c22149da13c57a75',
    vueWireFingerprint:
      '503f5943b369eeade43e02c2b4ff45272504daca79a5ac6f668f63c526605127',
  },
  {
    id: 'complex-cases/whitespace-preservation-complex-structure',
    reason: 'vue-text-coalescing',
    reactHash: 'df2fcc8f82538d01',
    reactWireFingerprint:
      '1ca542efd97c7bc21f2ee65e307b155a4a691fab637c7d65c1a3784b6de5bccf',
    vueHash: '6b60b0ab867926a4',
    vueWireFingerprint:
      'b6113d9ec29d32bf343b05324fcc5c385fb4a949fb345cf0d4f8753dd2f2f39c',
  },
  {
    id: 't-component/simple/expressions/null/fragment-null',
    reason: 'vue-display-string-erasure',
    reactHash: 'a013c005483cdd19',
    reactWireFingerprint:
      '0b549edd218c251f511934cc2f3bc5c7f4780e27af6b8ab4ae8d92cd94121b4a',
    vueHash: 'a013c005483cdd19',
    vueWireFingerprint:
      '060d2ce52ec188dfe04655f301bc33d239964c09e66392ab4b6e998d5312a2d1',
  },
  {
    id: 't-component/simple/expressions/null/plain-null',
    reason: 'vue-display-string-erasure',
    reactHash: '471b9124c31817e9',
    reactWireFingerprint:
      '74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b',
    vueHash: '5a72d4120af78654',
    vueWireFingerprint:
      '12ae32cb1ec02d01eda3581b127c1fee3b0dc53572ed6baf239721a03d82e126',
  },
  {
    id: 't-component/simple/expressions/static-boolean/array',
    reason: 'vue-display-string-erasure',
    reactHash: '9ff224ca1118e4df',
    reactWireFingerprint:
      'de24ed95a9498ce00878d5480824cf2cd0c3ff0ca373c37d7c8b0eb67cc7f542',
    vueHash: '1ae5ad3f1db215c1',
    vueWireFingerprint:
      'ff7f03df7840cbefd8e12dee16fbc16415bbffae4add8619c8e7ec81f02caf36',
  },
  {
    id: 't-component/simple/expressions/static-boolean/false',
    reason: 'vue-display-string-erasure',
    reactHash: 'd98d8886a31c98f3',
    reactWireFingerprint:
      'fcbcf165908dd18a9e49f7ff27810176db8e9f63b4352213741664245224f8aa',
    vueHash: '87a04f81044aef74',
    vueWireFingerprint:
      '076de6e730df0b4c3860877a0f619c6ac11f8aefd78313ac793a2a703c026869',
  },
  {
    id: 't-component/simple/expressions/static-boolean/fragment-false',
    reason: 'vue-display-string-erasure',
    reactHash: 'a013c005483cdd19',
    reactWireFingerprint:
      '0b549edd218c251f511934cc2f3bc5c7f4780e27af6b8ab4ae8d92cd94121b4a',
    vueHash: '3572f24bad84aee9',
    vueWireFingerprint:
      '6a85e1148cd599c35babfd7b381703225b353827820d27c42d8dc312e69c0b74',
  },
  {
    id: 't-component/simple/expressions/static-boolean/fragment-true',
    reason: 'vue-display-string-erasure',
    reactHash: '200db4fbcabc7d06',
    reactWireFingerprint:
      '50d264d28be4435336c3eec2da73e6b07159f482c2226b7aafe59c7b56686079',
    vueHash: '6d6d11f10ff17065',
    vueWireFingerprint:
      '8855e76c828490d84e4bf2c78f24ddba903ed0256018ba4241c6fb52ad7ece89',
  },
  {
    id: 't-component/simple/expressions/static-boolean/true',
    reason: 'vue-display-string-erasure',
    reactHash: '73b6b211a4122ba8',
    reactWireFingerprint:
      'b5bea41b6c623f7c09f1bf24dcae58ebab3c0cdd90ad966bc43a45b44867e12b',
    vueHash: '6d23edcaf7dc34aa',
    vueWireFingerprint:
      '18d10c7d2b4b04aaf04254d1ae5d655a5dc0407cbcdd5a8c3986e985370f36ee',
  },
  {
    id: 't-component/simple/expressions/static-special-identifiers',
    reason: 'vue-display-string-erasure',
    reactHash: '4f82a98ad0b111d9',
    reactWireFingerprint:
      'cd4b0b64b8eca219f2030985697153ab0d5a136110d029ba9f49137d39cae545',
    vueHash: 'f758c211b552cd3e',
    vueWireFingerprint:
      '22d2bab785cc504407459ec1dd52b076f40345680c8ada34605bce492de7a24f',
  },
  {
    id: 'variable-components/static/branches',
    reason: 'unsupported-derive',
    reactHash: '151c5ea756354da4',
    reactWireFingerprint:
      '97ae5a205874262fab4a478bfe0007a25494f422237d14234a35c3a258d4b9b4',
    vueHash: 'fd88ed0e98e2d8ee',
    vueWireFingerprint:
      '0e2ca2c8a1a7ae3e80a538030399727d0eca2b80fc2c94713d61353597ba5137',
  },
  {
    id: 'variable-components/static/simple',
    reason: 'unsupported-derive',
    reactHash: '4b9fdc8e2a028557',
    reactWireFingerprint:
      '995b1984c9d324b677e093f743460081ccfea8906dd984f0fe7266df556f05e3',
    vueHash: '287448edce495a71',
    vueWireFingerprint:
      'cb02b65a5dd198e2d752a824318aaeca5c45fd0bf640be95b50e2fed5789d325',
  },
  {
    id: 'variable-components/static/ternaries',
    reason: 'unsupported-derive',
    reactHash: 'b504e6005f6d2aad',
    reactWireFingerprint:
      '288b0769773367973834bb87c56f6afd99c46eac9247ef0f9b63479a18e49450',
    vueHash: '28da75b7c45137da',
    vueWireFingerprint:
      '8709fbd3222d5fd95954086731732f3a511669e97b7656cd336a6275a69fc9b2',
  },
  {
    id: 'variable-components/var/simple/name',
    reason: 'unsupported-named-variable',
    reactHash: '5313ec64034eb6b2',
    reactWireFingerprint:
      '48b3694500e4a2d487258a0c43cc04c359004693c702eda045891ed12dc67ac3',
    vueHash: '2271a4ba8a2d5cfd',
    vueWireFingerprint:
      '6df356f0976ab88c442b619b22f8c2e1d5ea1b3e2393aa9d2097d63a6dc212f5',
  },
] as const satisfies readonly NonPortableSeed[];

/** Exact parity cannot regress below the first complete Vue seed port. */
export const MINIMUM_EXACT_SEED_COUNT = 60;
