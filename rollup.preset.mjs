import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import postcss from 'rollup-plugin-postcss';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import { babel } from '@rollup/plugin-babel';
import { dts } from 'rollup-plugin-dts';
import preserveDirectives from 'rollup-preserve-directives';

export function createReactRollupBaseConfig({ external }) {
  return {
    plugins: [
      peerDepsExternal(),
      resolve({
        browser: true,
        preferBuiltins: false,
      }),
      commonjs(),
      babel({
        babelHelpers: 'bundled',
        exclude: /node_modules/,
        presets: ['@babel/preset-react', '@babel/preset-typescript'],
      }),
      typescript({
        tsconfig: './tsconfig.json',
        sourceMap: true,
        outputToFilesystem: true,
      }),
      postcss(),
      preserveDirectives(),
    ],
    external,
  };
}

export function createMinifiedBundleConfig({
  input,
  outputName,
  plugins,
  external,
  distDir = './dist',
  esmFormat = 'esm',
}) {
  return {
    input,
    output: [
      {
        file: `${distDir}/${outputName}.cjs.min.cjs`,
        format: 'cjs',
        exports: 'auto',
        sourcemap: true,
      },
      {
        file: `${distDir}/${outputName}.esm.min.mjs`,
        format: esmFormat,
        exports: 'named',
        sourcemap: true,
      },
    ],
    plugins: [...plugins, terser()],
    external,
  };
}

export function createDtsConfig({
  input,
  outputName,
  distDir = './dist',
  format = 'esm',
}) {
  return {
    input,
    output: {
      file: `${distDir}/${outputName}.d.ts`,
      format,
    },
    plugins: [dts()],
  };
}

export function createReactBundleConfigs(entries, baseConfig) {
  return entries.flatMap(({ input, outputName, bundle = true, types = true }) =>
    [
      bundle &&
        createMinifiedBundleConfig({
          input,
          outputName,
          plugins: baseConfig.plugins,
          external: baseConfig.external,
        }),
      types && createDtsConfig({ input, outputName }),
    ].filter(Boolean)
  );
}
