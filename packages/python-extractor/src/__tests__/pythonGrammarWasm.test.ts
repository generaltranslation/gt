import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const packageJson = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
);

describe('Python grammar WASM', () => {
  it('does not install tree-sitter-python at runtime', () => {
    // tree-sitter-python's install script builds a native addon that pnpm 11 blocks.
    expect(packageJson.dependencies).not.toHaveProperty('tree-sitter-python');
  });

  it('resolves tree-sitter-python.wasm from this package', () => {
    const wasmPath =
      require.resolve('@generaltranslation/python-extractor/tree-sitter-python.wasm');

    expect(wasmPath).toBe(
      fileURLToPath(
        new URL('../../dist/tree-sitter-python.wasm', import.meta.url)
      )
    );
    expect(existsSync(wasmPath)).toBe(true);
  });
});
