import { parseSync } from 'oxc-parser';
import { expect, test } from 'vitest';
import { ModuleGraph } from '../../src/compiler/analysis/module-graph.js';

test('loading many entries walks a module they share once', async () => {
  // a0 → a1 → … → a59: every module reaches all the ones after it.
  const length = 60;
  const file = (index: number) => `/app/src/a${index}.ts`;
  const files = new Map(
    Array.from({ length }, (_, index) => [
      file(index),
      index + 1 < length ? `import "./a${index + 1}.ts";` : '',
    ])
  );

  let followChecks = 0;
  const graph = new ModuleGraph({
    targets: [],
    resolve: async (specifier) => `/app/src/${specifier.slice(2)}`,
    readModule: async (path) => {
      const code = files.get(path);
      if (code === undefined) return undefined;

      const { program } = parseSync(path, code, { lang: 'ts', range: true });
      return { code, program: program as never };
    },
    shouldFollow: () => {
      followChecks++;
      return true;
    },
  });

  await graph.loadPaths([...files.keys()]);

  expect(graph.getRecord(file(length - 1))).toBeDefined();
  // One walk from each entry would check every module after it: 1770 times.
  expect(followChecks).toBeLessThanOrEqual(length);
});
