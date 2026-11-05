import { describe, expect, it } from 'vitest';
import { buildTree, findNode } from '../src/tree.ts';
import type { ModuleSize } from '../shared/types.ts';

const module = (
  pkg: string,
  path: string,
  bytes: number,
  gt = false
): ModuleSize => ({
  id: `${pkg}/${path}`,
  pkg,
  path,
  gt,
  bytes,
});

describe('buildTree', () => {
  it('nests modules by package and folder and sums sizes', () => {
    const tree = buildTree(
      [
        module('gt-react', 'dist/index.mjs', 100, true),
        module('gt-react', 'dist/internal.mjs', 50, true),
        module('react-dom', 'cjs/react-dom.production.js', 400),
      ],
      null
    );
    expect(tree.bytes).toBe(550);
    const gtReact = tree.children.find((node) => node.name === 'gt-react')!;
    expect(gtReact.bytes).toBe(150);
    expect(gtReact.gt).toBe(true);
    // The single dist folder is folded into the package.
    expect(gtReact.children.map((node) => node.name).sort()).toEqual([
      'index.mjs',
      'internal.mjs',
    ]);
    expect(gtReact.children[0]!.key).toMatch(/^gt-react\/dist\//);
  });

  it('collapses single-child folder chains below the package', () => {
    const tree = buildTree(
      [
        module('next', 'dist/esm/client/a.js', 10),
        module('next', 'dist/esm/server/b.js', 10),
        module('next', 'other/c.js', 10),
      ],
      null
    );
    const next = tree.children[0]!;
    expect(next.children.map((node) => node.name).sort()).toEqual([
      'dist/esm',
      'other/c.js',
    ]);
  });

  it('records previous sizes, including removed and added files', () => {
    const tree = buildTree(
      [
        module('gt-i18n', 'dist/a.mjs', 80, true),
        module('gt-i18n', 'dist/new.mjs', 5, true),
      ],
      [
        module('gt-i18n', 'dist/a.mjs', 100, true),
        module('gt-i18n', 'dist/gone.mjs', 20, true),
      ]
    );
    const pkg = tree.children[0]!;
    // The removed 20-byte file still counts toward the previous total.
    expect(pkg.previousBytes).toBe(120);
    expect(pkg.bytes - pkg.previousBytes!).toBe(-35);
    expect(tree.previousBytes).toBe(120);
    expect(findNode(tree, 'gt-i18n/dist/a.mjs')!.previousBytes).toBe(100);
    expect(findNode(tree, 'gt-i18n/dist/new.mjs')!.previousBytes).toBe(0);
  });

  it('finds nodes by key for zooming', () => {
    const tree = buildTree(
      [module('a', 'x/y.js', 1), module('a', 'z.js', 1)],
      null
    );
    expect(findNode(tree, 'a/x/y.js')?.bytes).toBe(1);
    expect(findNode(tree, 'missing')).toBeNull();
  });
});
