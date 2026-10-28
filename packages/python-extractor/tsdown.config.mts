import { defineConfig } from 'tsdown';
import {
  createTsdownUnbundleConfig,
  withPackageChecks,
} from '../../tsdown.preset.mts';

export default defineConfig(
  withPackageChecks(
    createTsdownUnbundleConfig({
      format: 'esm',
      dts: true,
      // Ship the grammar WASM so installs skip tree-sitter-python's native build script.
      copy: [
        {
          from: 'node_modules/tree-sitter-python/tree-sitter-python.wasm',
          to: 'dist',
        },
        {
          from: 'node_modules/tree-sitter-python/LICENSE',
          to: 'dist',
          rename: 'tree-sitter-python.LICENSE',
        },
      ],
      deps: {
        neverBundle: [
          '@generaltranslation/python-extractor/tree-sitter-python.wasm',
        ],
      },
    }),
    {
      profile: 'esm-only',
      // A WebAssembly asset, not a module with types.
      excludeEntrypoints: ['./tree-sitter-python.wasm'],
    }
  )
);
