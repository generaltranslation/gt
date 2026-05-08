import {
  createReactBundleConfigs,
  createReactRollupBaseConfig,
} from '../../rollup.preset.mjs';

const baseConfig = createReactRollupBaseConfig({
  external: [
    'react',
    'react-dom',
    'generaltranslation',
    'generaltranslation/core',
    '@generaltranslation/supported-locales',
    '@generaltranslation/react-core',
  ],
});

export default createReactBundleConfigs(
  [
    { input: './src/index.ts', outputName: 'index' },
    { input: './src/internal.ts', outputName: 'internal' },
    { input: 'src/client.ts', outputName: 'client' },
    { input: './src/browser.ts', outputName: 'browser' },
    {
      input: './src/browser-types.ts',
      outputName: 'browser-types',
      bundle: false,
    },
<<<<<<< HEAD
    { input: './src/macros.ts', outputName: 'macros' },
  ],
  baseConfig
);
=======
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
  // Bundling for the client library (client.ts)
  {
    input: 'src/client.ts',
    output: [
      {
        file: './dist/client.cjs.min.cjs',
        format: 'cjs',
        exports: 'auto', // 'auto' ensures compatibility with both default and named exports in CommonJS
        sourcemap: true,
      },
      {
        file: './dist/client.esm.min.mjs',
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

  // TypeScript declarations for the client library (client.ts)
  {
    input: './src/client.ts',
    output: {
      file: './dist/client.d.ts',
      format: 'esm',
    },
    plugins: [dts()],
  },

  /* ---------------------------------------- */
  // Bundling for the browser library (browser.ts)
  {
    input: './src/browser.ts',
    output: [
      {
        file: './dist/browser.cjs.min.cjs',
        format: 'cjs',
        exports: 'auto',
        sourcemap: true,
      },
      {
        file: './dist/browser.esm.min.mjs',
        format: 'esm',
        exports: 'named',
        sourcemap: true,
      },
    ],
    plugins: [
      ...baseConfig.plugins,
      terser(), // Minification
    ],
    external: baseConfig.external,
  },

  // TypeScript declarations for the browser library (browser.ts)
  {
    input: './src/browser.ts',
    output: {
      file: './dist/browser.d.ts',
      format: 'esm',
    },
    plugins: [dts()],
  },

  // TypeScript declarations for the browser types (browser-types.ts)
  {
    input: './src/browser-types.ts',
    output: {
      file: './dist/browser-types.d.ts',
      format: 'esm',
    },
    plugins: [dts()],
  },

  /* ---------------------------------------- */
  // Bundling for macros (macros.ts)
  {
    input: './src/macros.ts',
    output: [
      {
        file: './dist/macros.cjs.min.cjs',
        format: 'cjs',
        exports: 'auto',
        sourcemap: true,
      },
      {
        file: './dist/macros.esm.min.mjs',
        format: 'esm',
        exports: 'named',
        sourcemap: true,
      },
    ],
    plugins: [...baseConfig.plugins, terser()],
    external: baseConfig.external,
  },

  // TypeScript declarations for macros (macros.ts)
  {
    input: './src/macros.ts',
    output: {
      file: './dist/macros.d.ts',
      format: 'esm',
    },
    plugins: [dts()],
  },
];
>>>>>>> 62f3bc4c8 (feat: expose external store entrypoints)
