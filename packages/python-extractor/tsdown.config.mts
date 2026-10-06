import { defineConfig } from 'tsdown';
import { createTsdownUnbundleConfig } from '../../tsdown.preset.mts';

export default defineConfig(
  createTsdownUnbundleConfig({
    format: 'esm',
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
  })
);
