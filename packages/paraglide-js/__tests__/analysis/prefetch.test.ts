import path from 'node:path';
import { expect, test } from 'vitest';
import { ModuleGraph } from '../../src/compiler/analysis/module-graph.js';
import { defaultLanguages } from '../../src/compiler/languages/index.js';
import { isSourceFile } from '../../src/compiler/languages/language.js';
import { defaultTargets } from '../../src/compiler/paraglide/targets.js';
import { FileSelection } from '../../src/compiler/project/files.js';
import { nodeResolver } from '../../src/compiler/resolver/node-resolver.js';
import { writeProject } from '../helpers/fixture.js';
import { REPO_PACKAGES } from '../helpers/project.js';

const use = (id: string) =>
  `import { m } from "../paraglide/messages.js";\nexport const ${id} = m.greeting();\n`;

/** Scripts of each kind the analysis reads, one it cannot parse, a component JavaScript reads, and enough for several batches. */
async function project(): Promise<string> {
  const many = Object.fromEntries(
    Array.from({ length: 600 }, (_, index) => [
      `src/many/m${index}.ts`,
      index % 3 === 0
        ? use(`t${index}`)
        : `export const n${index} = ${index};\n`,
    ])
  );

  return writeProject('prefetch', {
    ...many,
    'src/a.ts':
      'import { m } from "./paraglide/messages.js";\nexport const a = m.greeting();\n',
    'src/b.tsx':
      'import { m } from "./paraglide/messages.js";\nexport const B = () => <p>{m.greeting()}</p>;\n',
    'src/c.js': 'import { a } from "./a.ts";\nexport const c = a;\n',
    'src/broken.ts': 'export const = ;\n',
    'src/Label.vue':
      '<script setup>\nimport { m } from "./paraglide/messages.js";\n</script>\n<template><p>{{ m.greeting() }}</p></template>\n',
  });
}

/** The usages the graph finds in the project, after prefetching its files or not. */
async function analyzed(root: string, prefetch: boolean): Promise<string> {
  const resolver = nodeResolver();
  const skipped: string[] = [];
  const graph = await ModuleGraph.create({
    targets: defaultTargets,
    languages: defaultLanguages,
    packages: REPO_PACKAGES,
    resolver,
    resolve: (specifier, importer) => resolver(specifier, importer),
    outdirs: [path.join(root, 'src/paraglide')],
    onSkipped: (file, { error }) => void skipped.push(`${file}: ${error}`),
  });

  const { files } = await new FileSelection({
    projectRoot: root,
    isSourceFile: (file) => isSourceFile(file, defaultLanguages),
  }).list(prefetch ? { onFiles: (found) => graph.prefetch(found) } : {});

  const sources = graph.notGenerated(files);
  await graph.loadPaths(sources);
  const usages = await graph.analyze(sources);

  return JSON.stringify({ usages: [...usages].sort(), skipped });
}

test('prefetched files are analyzed as files loaded then', async () => {
  const root = await project();
  const expected = await analyzed(root, false);

  expect(expected).toContain('src/Label.vue');
  expect(expected).toContain('src/broken.ts');
  expect(expected).toContain('src/many/m3.ts');
  expect(await analyzed(root, true)).toBe(expected);
});

test('a graph that reads files itself prefetches nothing', async () => {
  const graph = await ModuleGraph.create({
    targets: defaultTargets,
    languages: defaultLanguages,
    resolve: async () => undefined,
    read: async () => 'export {};',
  });

  // Not on the file system: a prefetch would find no file, and the read is asked.
  graph.prefetch(['/nowhere/a.ts']);
  await graph.loadPaths(['/nowhere/a.ts']);
  expect(await graph.analyze(['/nowhere/a.ts'])).toEqual(new Map());
});
