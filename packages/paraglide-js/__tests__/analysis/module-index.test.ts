import { parseSync } from 'oxc-parser';
import { expect, test } from 'vitest';
import type { ESTree } from '../../src/compiler/analysis/ast.js';
import { summarizeModule } from '../../src/compiler/analysis/module-index.js';

const program = (code: string) =>
  parseSync('/app/a.ts', code, { lang: 'ts', astType: 'ts' })
    .program as unknown as ESTree.Program;

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

  expect(summary?.untrackedExports.sort()).toEqual([
    'Label',
    'default',
    'show',
  ]);
  expect(summary?.specifiers.sort()).toEqual([
    './other',
    './paraglide/messages.js',
  ]);
});

test('lists none for generated code, which reads names through an object that stands for the module', () => {
  const [summary] = summarizeModule({
    code: '',
    program: program('export function show() {}'),
    scopeObjects: ['__VLS_ctx'],
  });

  expect(summary?.untrackedExports).toEqual([]);
});
