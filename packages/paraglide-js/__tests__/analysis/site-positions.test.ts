import { parseSync } from 'oxc-parser';
import { expect, test } from 'vitest';
import type { ESTree, Node } from '../../src/compiler/analysis/ast.js';
import { callSitesIn } from '../../src/compiler/analysis/call-sites.js';
import { ModuleGraph } from '../../src/compiler/analysis/module-graph.js';
import { valueImports } from '../../src/compiler/analysis/module-syntax.js';
import {
  PositionedSites,
  sitePositions,
} from '../../src/compiler/analysis/site-positions.js';

const FILE = '/app/src/page.tsx';
const CODE = [
  `import { show, Label } from "./lib";`,
  `import * as lib from "./lib";`,
  `import { unused } from "./lib";`,
  `show("a");`,
  `(show as any)("b")!;`,
  `lib.show("c");`,
  `lib["show"]("d");`,
  `lib.format(show("e"));`,
  `const el = <Label />;`,
  `const other = <lib.Label text={show("f")} />;`,
  `function local(show: (key: string) => void) { show("shadowed"); }`,
  `local(show);`,
].join('\n');

async function loaded() {
  const graph = new ModuleGraph({
    targets: [],
    resolve: async () => undefined,
    readModule: async (path) => {
      if (path !== FILE) return undefined;
      const { program } = parseSync(path, CODE, { lang: 'tsx', range: true });
      return { code: CODE, program: program as never };
    },
    shouldFollow: () => true,
  });
  await graph.loadPaths([FILE]);

  const record = graph.getRecord(FILE)!;
  return { program: record.program, scope: graph.scopeOf(record) };
}

const positionsOf = (site: { type: string; node?: Node; element?: Node }) => [
  site.type,
  (site.node ?? site.element)!.start,
];

test('finds the sites of each import as the walked index does', async () => {
  const { program, scope } = await loaded();
  const names = new Set(
    valueImports(program).flatMap(({ specifiers }) =>
      specifiers.map((specifier) => specifier.local.name)
    )
  );
  const positioned = new PositionedSites(
    program,
    scope,
    sitePositions(program, names)!
  );
  const index = callSitesIn(program, scope);

  for (const { specifiers } of valueImports(program)) {
    for (const specifier of specifiers) {
      const name = specifier.local.name;

      if (specifier.type === 'ImportNamespaceSpecifier') {
        expect(positioned.sitesByMember(specifier, name)).toEqual(
          index.byNamespaceMember.get(specifier) ?? new Map()
        );
        continue;
      }

      expect(positioned.sitesOf(specifier, name)).toEqual(
        index.byDeclaration.get(specifier) ?? []
      );
    }
  }

  // The shadowed `show` and the call of `local` are no import's.
  const [show] = valueImports(program)[0]!.specifiers;
  expect(positioned.sitesOf(show!, 'show').map(positionsOf)).toEqual(
    (index.byDeclaration.get(show!) ?? []).map(positionsOf)
  );
  expect(positioned.sitesOf(show!, 'show')).toHaveLength(4);
});

test('finds a site again by its position', async () => {
  const { program, scope } = await loaded();
  const positioned = new PositionedSites(
    program,
    scope,
    sitePositions(program, new Set(['show', 'lib', 'Label']))!
  );

  for (const site of callSitesIn(program, scope).byPosition.values()) {
    const node = (site.type === 'call' ? site.node : site.element) as Node;
    expect(positioned.at(site.type, node.start, node.end)).toEqual(site);
  }
});

test('has no positions when two sites have the same one', () => {
  const { program } = parseSync('/app/gen.ts', `f(); g();`, { range: true });
  const calls = (program as ESTree.Program).body.map(
    (statement) => (statement as ESTree.ExpressionStatement).expression
  ) as Array<Node & { range: [number, number] }>;
  // As generated code moved to its source can be.
  calls[0]!.range = [100, 110];
  calls[1]!.range = [100, 110];

  expect(sitePositions(program as never, new Set(['f']))).toBeUndefined();
  calls[1]!.range = [111, 120];
  expect(sitePositions(program as never, new Set(['f']))).toHaveLength(4);
});
