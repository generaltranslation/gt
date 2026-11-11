// Findings B5, B6, P1, S6, C5 and O1 of the paraglide-tests apps (FINDINGS.md).
import { describe, expect, test } from 'vitest';
import {
  defaultTargets,
  packageTarget,
} from '../../lib/compiler/paraglide/targets.js';
import {
  ENTRY,
  analyzeEntry,
  analyzeProject,
  summarize,
} from '../helpers/project.js';

const imports = `import { m } from "./paraglide/messages.js";\n`;

/** e.g. `message:flow_first:call 3 Label` */
async function describeUsages(code: string, file = ENTRY) {
  const usages = await analyzeProject({ [file]: code }, { entry: file });
  return usages.map(
    (usage) => `${summarize([usage])[0]} ${usage.line} ${usage.scope ?? '-'}`
  );
}

describe('B5: a parameter or prop that receives several values follows each', () => {
  test('props and arguments', async () => {
    expect(
      await describeUsages(
        [
          imports,
          `function Label({ message }) { return <em>{message()}</em>; }`,
          `const translate = (message) => message();`,
          `export function Page() {`,
          `  return <p>`,
          `    <Label message={m.flow_first} />`,
          `    <Label message={m.flow_second} />`,
          `    {translate(m.flow_helper_first)}`,
          `    {translate(m.flow_helper_second)}`,
          `  </p>;`,
          `}`,
        ].join('\n')
      )
    ).toEqual([
      'message:flow_first:call 3 Label',
      'message:flow_second:call 3 Label',
      'message:flow_helper_first:call 4 translate',
      'message:flow_helper_second:call 4 translate',
      'message:flow_first:reference 7 Page',
      'message:flow_second:reference 8 Page',
      'message:flow_helper_first:reference 9 Page',
      'message:flow_helper_second:reference 10 Page',
    ]);
  });

  test('a let assigned in branches holds each', async () => {
    expect(
      await analyzeEntry(`${imports}let t = m.a;\nif (x) t = m.b;\nt();`)
    ).toEqual(['message:a:call', 'message:b:call']);
  });

  test('more than 16 names become one dynamic `*`', async () => {
    const calls = Array.from({ length: 20 }, (_, i) => `t(m.k${i});`).join(
      '\n'
    );
    const usages = await analyzeProject({
      [ENTRY]: `${imports}const t = (message) => message();\n${calls}`,
    });
    const inside = usages.filter((usage) => usage.line === 2);
    expect(inside).toMatchObject([{ name: '*', dynamic: true, kind: 'call' }]);
  });
});

describe('B6: a `let` reassigned away from `m`', () => {
  test('an unconditional assignment before the read replaces the initializer', async () => {
    expect(
      await analyzeEntry(
        `${imports}let reassigned = m;\nreassigned = { never_reassigned_away: () => "" } as any;\nexport const c = reassigned.never_reassigned_away();`
      )
    ).toEqual([]);
  });

  test('an assignment after the read, or in another function, does not', async () => {
    expect(
      await analyzeEntry(
        `${imports}let t = m;\nexport const a = t.greeting();\nt = {};\nfunction f() { t = {}; }\nexport const b = () => t.later();`
      )
    ).toEqual(['message:greeting:call', 'message:later:call']);
  });

  test('an assignment back to `m` counts again', async () => {
    expect(
      await analyzeEntry(`${imports}let t = m;\nt = {};\nt = m;\nt.greeting();`)
    ).toEqual(['message:greeting:call']);
  });
});

describe("P1: a parameter's value that is only passed through or inspected", () => {
  test('is not a reference; the call site and calls are', async () => {
    expect(
      await describeUsages(
        [
          imports,
          `const identity = (value) => value;`,
          `export const a = identity(m.pass_identity);`,
          `export function render(message) {`,
          `  if (!message.parts) return message();`,
          `  return typeof message === "function" && message;`,
          `}`,
          `export const b = render(m.pass_inspected);`,
          `export const c = (t) => t.greeting;`,
        ].join('\n')
      )
    ).toEqual([
      'message:pass_identity:reference 4 -',
      'message:pass_inspected:call 6 render',
      'message:pass_inspected:reference 9 -',
    ]);
  });

  test('a direct reference is still one', async () => {
    expect(
      await analyzeEntry(`${imports}export const f = () => m.title;`)
    ).toEqual(['message:title:reference']);
  });
});

describe('S6: inline event handlers are scoped to the component', () => {
  test.each([
    [
      'Svelte',
      '/app/src/Page.svelte',
      `<script>\n${imports}</script>\n<button onclick={() => m.handler()}>x</button>\n`,
    ],
    [
      'Vue',
      '/app/src/Page.vue',
      `<script setup>\n${imports}</script>\n<template>\n  <button @click="() => m.handler()">x</button>\n</template>\n`,
    ],
  ])('%s', async (_name, file, code) => {
    const usages = await analyzeProject({ [file]: code }, { entry: file });
    expect(usages.map((usage) => usage.scope)).toEqual(['Page']);
  });
});

test('C5: a target after defaultTargets relabels a built-in one', async () => {
  const usages = await analyzeProject(
    {
      [ENTRY]: `import { Message } from "@inlang/paraglide-js-react";\nexport const A = () => <Message />;`,
      '/app/node_modules/@inlang/paraglide-js-react/index.js': 'export {}',
    },
    {
      targets: [
        ...defaultTargets,
        packageTarget('react-adapter', '@inlang/paraglide-js-react'),
      ],
    }
  );
  expect(summarize(usages)).toEqual(['react-adapter:Message:component']);
});

test('O1: static members are named apart from instance members', async () => {
  expect(
    await describeUsages(
      `${imports}export class Greeter {\n  label = m.instance();\n  static label = m.statik();\n  static greet() { return m.method(); }\n}`
    )
  ).toEqual([
    'message:instance:call 3 Greeter.label',
    'message:statik:call 4 static Greeter.label',
    'message:method:call 5 static Greeter.greet',
  ]);
});
