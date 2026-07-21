import { describe, it, expect } from 'vitest';
import type { GTUnpluginOptions } from '@generaltranslation/compiler';
import {
  compileJsxToEsm,
  createGtRawPlugin,
  hasGtSignal,
  runGtCompilerTransform,
  transformSource,
} from '../index';

// Raw TSX, exactly the shape an app author writes: `<T>` elements, a module
// level t() string, and TypeScript syntax. The transformer must lower this to
// the automatic JSX runtime before the GT compiler can inject hashes.
const RAW_TSX = `
  import { T, t, Num } from 'gt-react';

  const label: string = t('Add to cart');

  export function App({ count }: { count: number }) {
    return (
      <div>
        <T>
          <h1>Welcome to the shop</h1>
        </T>
        <span>{label}</span>
        <T>
          You have <Num>{count}</Num> items
        </T>
      </div>
    );
  }
`;

// A class with a class-level decorator plus GT usage. The transformer's Babel
// step must parse the decorator (legacy mode) rather than throw on it, or the
// file would be skipped and its GT usage would silently lose hashes.
const DECORATED_TSX = `
  import { T, t } from 'gt-react';

  function sealed(target: unknown) {
    return target;
  }

  @sealed
  export class Widget {
    label: string = t('Add to cart');

    render() {
      return (
        <T>
          <h1>Welcome to the shop</h1>
        </T>
      );
    }
  }
`;

const NO_GT_TSX = `
  export function add(a: number, b: number): number {
    return a + b;
  }
`;

// Mirror how the webpack/Vite adapters are invoked so we can assert byte parity.
// createGtRawPlugin loads the same compiler core the real adapters use.
async function runViaAdapterRaw(
  code: string,
  id: string,
  framework: string,
  options: GTUnpluginOptions = {}
): Promise<string | null> {
  const plugin = createGtRawPlugin(options, framework);
  // Resolve both transform hook shapes unplugin allows: a plain function or a
  // { filter, handler } object. This mirrors getTransformFn in the main source;
  // if the compiler ever switches to the object shape, this parity test then
  // still exercises the real handler instead of silently returning null.
  const transform = plugin.transform;
  const handler =
    typeof transform === 'function'
      ? transform
      : transform && typeof transform.handler === 'function'
        ? transform.handler
        : undefined;
  if (!handler) return null;
  const result = await handler(code, id);
  if (result && typeof result === 'object' && typeof result.code === 'string') {
    return result.code;
  }
  return null;
}

describe('@generaltranslation/parcel-transformer', () => {
  it('lowers raw TSX to the automatic JSX runtime (ES modules preserved)', () => {
    const out = compileJsxToEsm(RAW_TSX, '/app/src/App.tsx');
    // Automatic runtime import, not classic React.createElement.
    expect(out).toContain('react/jsx-runtime');
    expect(out).not.toContain('React.createElement');
    // Non-development runtime: jsx/jsxs, never jsxDEV (which the GT compiler
    // does not recognize).
    expect(out).not.toContain('jsxDEV');
    // TypeScript annotations are stripped.
    expect(out).not.toContain(': string');
    expect(out).not.toContain('count: number');
    // ES module imports survive so the GT compiler can track them.
    expect(out).toMatch(/import\s+\{[^}]*\}\s+from\s+['"]gt-react['"]/);
  });

  it('injects compile-time hashes into <T> and t() from raw TSX', async () => {
    const out = await transformSource(RAW_TSX, '/app/src/App.tsx');
    expect(out).not.toBeNull();
    // Two <T> blocks each get a `_hash`, the t() call gets `$_hash`.
    const hashCount = (out!.match(/_hash/g) ?? []).length;
    expect(hashCount).toBeGreaterThanOrEqual(3);
    expect(out).toMatch(/_hash["']?:\s*["'][a-f0-9]+["']/);
    expect(out).toContain('$_hash');
  });

  it('injects the same hashes as the webpack and Vite adapters on identical input', async () => {
    // Lower the raw TSX through the transformer's own Babel step, then run the
    // GT compiler on that real lowered output. Feeding the SAME lowered code to
    // the webpack and Vite adapter paths asserts the shared compiler core is
    // bundler-agnostic: given identical input it injects identical hashes,
    // whatever framework tag it is handed.
    //
    // This is a parity guarantee about the GT pass, not a claim that webpack
    // and Vite lower this TSX byte-for-byte the way the transformer does (each
    // bundler runs its own JSX transform). It verifies the part every adapter
    // actually shares, on the transformer's genuine lowered output.
    const id = '/app/src/App.tsx';
    const lowered = compileJsxToEsm(RAW_TSX, id);
    const parcelLike = await runGtCompilerTransform(lowered, id);
    const webpack = await runViaAdapterRaw(lowered, id, 'webpack');
    const vite = await runViaAdapterRaw(lowered, id, 'vite');

    expect(parcelLike).not.toBeNull();
    expect(parcelLike).toContain('_hash');
    expect(parcelLike).toEqual(webpack);
    expect(parcelLike).toEqual(vite);
  });

  it('lowers decorated classes and still injects hashes (legacy decorators)', async () => {
    // A class-level decorator must not make Babel throw and the transformer
    // skip the file. The legacy-decorators plugin matches the GT compiler's own
    // parser config, so the <T> block and t() string inside still get hashed.
    const out = await transformSource(DECORATED_TSX, '/app/src/Widget.tsx');
    expect(out).not.toBeNull();
    const hashCount = (out!.match(/_hash/g) ?? []).length;
    expect(hashCount).toBeGreaterThanOrEqual(2);
    expect(out).toContain('$_hash');
  });

  it('pre-gate hasGtSignal flags GT usage and skips inert files', () => {
    expect(hasGtSignal(`import { T } from 'gt-react';`)).toBe(true);
    expect(hasGtSignal(`import { useGT } from 'gt-next';`)).toBe(true);
    expect(hasGtSignal(`const x = <T>hi</T>;`)).toBe(true);
    expect(
      hasGtSignal(`export const add = (a: number, b: number) => a + b;`)
    ).toBe(false);
  });

  it('leaves files without GT usage unchanged (returns null)', async () => {
    const out = await transformSource(NO_GT_TSX, '/app/src/math.ts');
    expect(out).toBeNull();
  });

  it('exposes transformInclude gating on supported extensions', () => {
    const plugin = createGtRawPlugin();
    const transformInclude = plugin.transformInclude;
    expect(typeof transformInclude).toBe('function');
    expect(transformInclude!('/app/src/App.tsx')).toBe(true);
    expect(transformInclude!('/app/src/main.jsx')).toBe(true);
    expect(transformInclude!('/app/styles/App.css')).toBe(false);
  });

  it('is loadable as a Parcel plugin (default export is a Transformer)', async () => {
    const mod = await import('../index');
    expect(mod.default).toBeTruthy();
    expect(mod.default.constructor?.name).toBe('Transformer');
  });
});
