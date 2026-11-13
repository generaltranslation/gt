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

  let reads = 0;
  let resolutions = 0;
  const graph = await ModuleGraph.create({
    targets: [],
    languages: [],
    resolve: async (specifier) => {
      resolutions++;
      return `/app/src/${specifier.slice(2)}`;
    },
    read: async (path) => {
      reads++;
      return files.get(path);
    },
  });

  await graph.loadPaths([...files.keys()]);

  // One walk from each entry would read every module after it: 1770 times.
  expect(reads).toBe(length);
  expect(resolutions).toBe(length - 1);
});
