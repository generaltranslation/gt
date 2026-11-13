import { parseSync } from 'oxc-parser';
import { expect, test } from 'vitest';
import type { ESTree } from '../../src/compiler/analysis/ast.js';
import { summarizeModule } from '../../src/compiler/analysis/module-index.js';
import { namesIn } from '../../src/compiler/utils/name-list.js';

const program = (code: string, file = '/app/a.ts') =>
  parseSync(file, code, { astType: 'ts' }).program as unknown as ESTree.Program;

test('lists the exports that a function or a class declares as never holding a tracked value', () => {
  const [summary] = summarizeModule({
    code: '',
    program: program(
      [
        `import { m } from "./paraglide/messages.js";`,
        `export function show() {}`,
        `export class Label {}`,
        `export default function () {}`,
        `export const title = m.title;`,
        `const greeting = m.greeting;`,
        `export { greeting };`,
        `export type Props = {};`,
        `export * from "./other";`,
      ].join('\n')
    ),
  });

  expect(namesIn(summary!.untrackedExports).sort()).toEqual([
    'Label',
    'default',
    'show',
  ]);
  expect(summary?.specifiers.sort()).toEqual([
    './other',
    './paraglide/messages.js',
  ]);
});

test('lists the names a module exports and the specifiers of its export *', () => {
  const [summary] = summarizeModule({
    code: '',
    program: program(
      [
        `export function show() {}`,
        `export const title = 1, other = 2;`,
        `export { title as heading };`,
        `export default title;`,
        `export * as ns from "./ns";`,
        `export * from "./a";`,
        `export type * from "./types";`,
        `export * from "./b";`,
      ].join('\n')
    ),
  });

  expect(namesIn(summary!.exports!.names).sort()).toEqual([
    'default',
    'heading',
    'ns',
    'other',
    'show',
    'title',
  ]);
  expect(summary!.exports!.stars).toEqual(['./a', './b']);
});

test('leaves the exports unknown without ESM exports, or with a name it cannot list', () => {
  const exportsOf = (code: string) =>
    summarizeModule({ code: '', program: program(code) })[0]!.exports;

  expect(exportsOf(`module.exports = { a: 1 };`)).toBeUndefined();
  expect(exportsOf(`const a = 1; export { a as "a\0b" };`)).toBeUndefined();
});

test('lists none for generated code, which reads names through an object that stands for the module', () => {
  const [summary] = summarizeModule({
    code: '',
    program: program('export function show() {}'),
    scopeObjects: ['__VLS_ctx'],
  });

  expect(namesIn(summary!.untrackedExports)).toEqual([]);
});

test('lists the auto-imported names a module has an identifier of', () => {
  const [summary] = summarizeModule(
    {
      code: '',
      program: program(
        [
          `export const App = () => <MessageView message={format(m.title)} />;`,
          `const unrelated = { MessageView: 1 };`,
        ].join('\n'),
        '/app/App.tsx'
      ),
    },
    new Set(['MessageView', 'm', 'useHead'])
  );

  expect(summary?.globalNames.sort()).toEqual(['MessageView', 'm']);
});
