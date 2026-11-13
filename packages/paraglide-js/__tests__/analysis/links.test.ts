import { parseSync } from 'oxc-parser';
import { expect, test } from 'vitest';
import type { ESTree } from '../../src/compiler/analysis/ast.js';
import {
  resolveLinks,
  specifierLinks,
} from '../../src/compiler/analysis/importers.js';

const parse = (code: string) =>
  parseSync('/app/a.ts', code, { lang: 'ts', astType: 'ts' })
    .program as unknown as ESTree.Program;

test("reads a module's imports and re-exports from its syntax, then resolves them", () => {
  const program = parse(
    [
      `import { a, b as c } from "./ab";`,
      `import * as ns from "./ns";`,
      `import type { T } from "./types";`,
      `import "./side-effect";`,
      `export * from "./all";`,
      `export * as named from "./named";`,
      `export { d as e } from "./de";`,
      `import { f } from "./f";`,
      `export { f as g };`,
    ].join('\n')
  );

  const links = specifierLinks(program);
  expect(links).toEqual([
    { type: 'import', source: './ab', names: ['a', 'b'], namespace: false },
    { type: 'import', source: './ns', names: [], namespace: true },
    { type: 'import', source: './side-effect', names: [], namespace: false },
    { type: 'star', source: './all' },
    { type: 'reexport', source: './de', name: 'd', exported: 'e' },
    { type: 'import', source: './f', names: ['f'], namespace: false },
    { type: 'reexport', source: './f', name: 'f', exported: 'g' },
  ]);

  const resolved = resolveLinks(
    links,
    new Map([
      ['./ab', '/app/ab.ts'],
      ['./ns', '/app/ns.ts'],
      ['./all', '/app/all.ts'],
      ['./de', undefined],
      ['./f', '/app/f.ts'],
    ])
  );
  expect(resolved).toEqual({
    importedNames: new Map([
      ['/app/ab.ts', new Set(['a', 'b'])],
      ['/app/f.ts', new Set(['f'])],
    ]),
    importedNamespaces: new Set(['/app/ns.ts']),
    reexported: new Set(['/app/all.ts', '/app/f.ts']),
    renames: [{ imported: 'f', exported: 'g' }],
  });
});
