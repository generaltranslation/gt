import {
  createReactBundleConfigs,
  createReactRollupBaseConfig,
} from '../../rollup.preset.mjs';

const baseConfig = createReactRollupBaseConfig({
  external: [
    'react',
    'generaltranslation',
    'generaltranslation/core',
    '@generaltranslation/supported-locales',
  ],
});

<<<<<<< HEAD
export default createReactBundleConfigs(
  [
    { input: './src/index.ts', outputName: 'index' },
    { input: './src/internal.ts', outputName: 'internal' },
    { input: './src/errors.ts', outputName: 'errors' },
    { input: './src/types.ts', outputName: 'types', bundle: false },
  ],
  baseConfig
);
=======
  // TypeScript declarations for the main library (index.ts)
  {
    input: './src/index.ts',
    output: {
      file: './dist/index.d.ts',
      format: 'esm',
    },
    plugins: [dts()],
  },

  /* ---------------------------------------- */
  // Bundling for the internal library (internal.ts)
  {
    input: './src/internal.ts',
    output: [
      {
        file: './dist/internal.cjs.min.cjs',
        format: 'cjs',
        exports: 'auto', // 'auto' ensures compatibility with both default and named exports in CommonJS
        sourcemap: true,
      },
      {
        file: './dist/internal.esm.min.mjs',
        format: 'esm',
        exports: 'named', // Named exports for ES modules
        sourcemap: true,
      },
    ],
    plugins: [
      ...baseConfig.plugins,
      terser(), // Minification
    ],
    external: baseConfig.external,
  },

  // TypeScript declarations for the internal library (internal.ts)
  {
    input: './src/internal.ts',
    output: {
      file: './dist/internal.d.ts',
      format: 'esm',
    },
    plugins: [dts()],
  },

  /* ---------------------------------------- */
  // Bundling for the internal external store library (internal-external-store.ts)
  {
    input: './src/internal-external-store.ts',
    output: [
      {
        file: './dist/internal-external-store.cjs.min.cjs',
        format: 'cjs',
        exports: 'auto',
        sourcemap: true,
      },
      {
        file: './dist/internal-external-store.esm.min.mjs',
        format: 'esm',
        exports: 'named',
        sourcemap: true,
      },
    ],
    plugins: [...baseConfig.plugins, terser()],
    external: baseConfig.external,
  },

  // TypeScript declarations for the internal external store library (internal-external-store.ts)
  {
    input: './src/internal-external-store.ts',
    output: {
      file: './dist/internal-external-store.d.ts',
      format: 'esm',
    },
    plugins: [dts()],
  },

  /* ---------------------------------------- */
  // Bundling for the errors library (errors.ts)
  {
    input: './src/errors.ts',
    output: [
      {
        file: './dist/errors.cjs.min.cjs',
        format: 'cjs',
        exports: 'auto', // 'auto' ensures compatibility with both default and named exports in CommonJS
        sourcemap: true,
      },
      {
        file: './dist/errors.esm.min.mjs',
        format: 'esm',
        exports: 'named', // Named exports for ES modules
        sourcemap: true,
      },
    ],
    plugins: [
      ...baseConfig.plugins,
      terser(), // Minification
    ],
    external: baseConfig.external,
  },

  // TypeScript declarations for the errors library (errors.ts)
  {
    input: './src/errors.ts',
    output: {
      file: './dist/errors.d.ts',
      format: 'esm',
    },
    plugins: [dts()],
  },

  /* ---------------------------------------- */
  // TypeScript declarations for the internal library (internal.ts)
  {
    input: './src/types.ts',
    output: {
      file: './dist/types.d.ts',
      format: 'esm',
    },
    plugins: [dts()],
  },
];
>>>>>>> 62f3bc4c8 (feat: expose external store entrypoints)
