import { describe, expect, test } from 'vitest';
import {
  inBinding,
  resolveBinding,
} from '../../src/compiler/analysis/evaluate.js';
import type { Binding } from '../../src/compiler/analysis/scope.js';
import {
  ENTRY,
  OUTDIR,
  analyzeEntry,
  analyzeProject,
  describeUsages,
  summarize,
} from '../helpers/project.js';

const imports = `import { m } from "./paraglide/messages.js";\n`;
const call = 'message:greeting:call';

/** Loads every file, as the collector does, then analyzes `entry`. */
const analyzeAll = (files: Record<string, string>, entry: string) =>
  analyzeProject(files, { entry, loadAll: true });

/** e.g. `message:flow_first:call 3` */
async function describeLines(code: string): Promise<string[]> {
  return describeUsages(await analyzeProject({ [ENTRY]: code }));
}

describe('let and var', () => {
  test.each([
    ['let alias', `let t = m; t.greeting();`],
    ['let assigned later', `let t; t = m; t.greeting();`],
    [
      'may hold: another value first',
      `let t = other; if (x) t = m; t.greeting();`,
    ],
    ['var, hoisted', `function f() { t.greeting(); var t = m; }`],
    ['var at the top level', `var t = m; t.greeting();`],
    [
      'destructuring assignment',
      `let greeting; ({ greeting } = m); greeting();`,
    ],
    [
      'nested destructuring assignment',
      `let g; ({ m: { greeting: g } } = { m }); g();`,
    ],
  ])('%s', async (_name, code) => {
    expect(await analyzeEntry(imports + code)).toEqual([call]);
  });

  test.each([
    [
      'a nested redeclaration has its own binding',
      `let t = other; { let t = m; } t.greeting();`,
    ],
    [
      'an assignment in a nested scope that redeclares the name',
      `let t; function g() { let t; t = m; } t.greeting();`,
    ],
    ['compound assignments are not followed', `let t; t ||= m; t.greeting();`],
    [
      'never assigned a tracked value',
      `let t = other; t = again; t.greeting();`,
    ],
  ])('%s', async (_name, code) => {
    expect(await analyzeEntry(imports + code)).toEqual([]);
  });

  test('an alias assignment is not a usage; the call is', async () => {
    expect(await analyzeEntry(imports + `let t; t = m.greeting; t();`)).toEqual(
      [call]
    );
  });
});

describe('object literals and spreads', () => {
  test.each([
    ['spread', `const t = { ...m, extra: 1 }; t.greeting();`],
    ['Object.assign', `Object.assign({}, m).greeting();`],
    ['Object.freeze', `const t = Object.freeze({ ...m }); t.greeting();`],
    ['property', `const ui = { msg: m }; ui.msg.greeting();`],
    [
      'shorthand, nested',
      `const ui = { inner: { m } }; ui.inner.m.greeting();`,
    ],
  ])('%s', async (_name, code) => {
    expect(await analyzeEntry(imports + code)).toEqual([call]);
  });

  test('a later property overrides a spread', async () => {
    expect(
      await analyzeEntry(
        imports + `const t = { ...m, greeting: other }; t.greeting();`
      )
    ).toEqual([]);
  });

  test('a value inside an object literal stays a usage', async () => {
    expect(
      await analyzeEntry(
        imports + `const ui = { title: m.greeting }; ui.title();`
      )
    ).toEqual(['message:greeting:reference', call]);
  });
});

describe('values passed into functions', () => {
  test.each([
    [
      'function declaration',
      `function show(t) { return t.greeting(); } show(m);`,
    ],
    ['arrow', `const show = (t) => t.greeting(); show(m);`],
    ['second parameter', `function show(a, t) { t.greeting(); } show(1, m);`],
    [
      'destructured parameter',
      `function show({ t }) { t.greeting(); } show({ t: m });`,
    ],
    ['default value', `function show(t = other) { t.greeting(); } show(m);`],
    [
      'the default value of an omitted argument',
      `function show(t = m) { return t.greeting(); } show();`,
    ],
    [
      'the default value of an argument that is undefined',
      `function show(a, t = m) { return t.greeting(); } show(1, undefined);`,
    ],
    [
      'a destructured default value',
      `const show = ({ t } = { t: m }) => t.greeting(); show();`,
    ],
    [
      'recursion terminates',
      `function f(t) { if (x) f(t); t.greeting(); } f(m);`,
    ],
    [
      'JSX props',
      `function Show({ msgs }) { return <p>{msgs.greeting()}</p>; } <Show msgs={m} />;`,
    ],
    [
      'JSX props object',
      `const Show = (props) => props.msgs.greeting(); <Show msgs={m} />;`,
    ],
    [
      'JSX spread',
      `const Show = ({ msgs }) => msgs.greeting(); <Show {...{ msgs: m }} />;`,
    ],
  ])('%s', async (_name, code) => {
    expect(await analyzeEntry(imports + code)).toEqual([call]);
  });

  test.each([
    ['a default value that every call replaces', `show(other);`],
    ['a default value of a function that is never called', ``],
    ['an argument that may be anything, after a spread', `show(...args);`],
  ])('%s is not held', async (_name, calls) => {
    const show = `function show(t = m) { return t.greeting(); }`;
    expect(await analyzeEntry(`${imports}${show} ${calls}`)).toEqual([]);
  });

  test('a wrapped component gets the props: memo(…), forwardRef(…)', async () => {
    expect(
      await analyzeEntry(
        imports +
          `const Title = memo(forwardRef(({ label }, ref) => <h1>{label()}</h1>));\n<Title label={m.greeting} />;`
      )
    ).toEqual([call, 'message:greeting:reference']);
  });

  test.each([
    [
      'never called: the parameter shadows the import',
      `function f(m) { m.greeting(); }`,
    ],
    ['called with something else', `function f(t) { t.greeting(); } f(other);`],
    ["a callback's parameter", `items.map((m) => m.greeting());`],
    [
      'after a spread argument',
      `function f(a, t) { t.greeting(); } f(...rest, m);`,
    ],
  ])('%s', async (_name, code) => {
    expect(await analyzeEntry(imports + code)).toEqual([]);
  });

  describe('across modules', () => {
    const title = `export function Title({ message }) { return <p>{message()}</p>; }\n`;

    test("a type with the component's name (`type Title` and `function Title`)", async () => {
      const usages = await analyzeAll(
        {
          '/app/src/App.tsx': `${imports}import { Title } from "./Title.js";\nexport const App = () => <Title message={m.greeting} />;\n`,
          '/app/src/Title.tsx': `type Title = () => string;\nexport function Title(props: { message: Title }) { return <p>{props.message()}</p>; }\n`,
        },
        '/app/src/Title.tsx'
      );
      expect(summarize(usages)).toEqual([call]);
    });

    test.each([
      [
        'named import',
        `import { Title } from "./Title.js";`,
        `<Title message={m.greeting} />`,
      ],
      [
        'renamed import',
        `import { Title as T } from "./Title.js";`,
        `<T message={m.greeting} />`,
      ],
      [
        'namespace import',
        `import * as ui from "./Title.js";`,
        `<ui.Title message={m.greeting} />`,
      ],
    ])('%s', async (_name, importLine, element) => {
      const usages = await analyzeAll(
        {
          '/app/src/App.tsx': `${imports}${importLine}\nexport const App = () => ${element};\n`,
          '/app/src/Title.tsx': title,
        },
        '/app/src/Title.tsx'
      );
      expect(summarize(usages)).toEqual([call]);
      expect(usages[0]!.targetFile).toBe('/app/src/paraglide/messages.js');
    });

    test('a default-exported function called from another module', async () => {
      const usages = await analyzeAll(
        {
          '/app/src/App.ts': `${imports}import show from "./show.js";\nshow(m);\n`,
          '/app/src/show.ts': `export default function (t) { return t.greeting(); }\n`,
        },
        '/app/src/show.ts'
      );
      expect(summarize(usages)).toEqual([call]);
    });

    const callTwice = (other: string) =>
      `if (a) ${other}(t); if (b) ${other}(t);`;
    const renderTwice = (other: string) =>
      `<script setup lang="ts">\nimport ${other} from "./${other}.vue";\ndefineProps(["msgs"]);\n</script>\n<template><p>{{ msgs.greeting() }}</p><${other} v-if="a" :msgs="msgs" /><${other} v-if="b" :msgs="msgs" /></template>\n`;

    // Each module passes what it receives to the other twice. A cycle missed in
    // a module parsed again would double the work with each step, up to the depth limit.
    test.each([
      [
        'functions',
        {
          '/app/src/App.ts': `${imports}import { f } from "./f.js";\nf(m);\n`,
          '/app/src/f.ts': `import { g } from "./g.js";\nexport function f(t) { ${callTwice('g')} return t.greeting(); }\n`,
          '/app/src/g.ts': `import { f } from "./f.js";\nexport function g(t) { ${callTwice('f')} return t.greeting(); }\n`,
        },
        '/app/src/f.ts',
      ],
      [
        'Vue components',
        {
          '/app/src/App.vue': `<script setup lang="ts">\n${imports}import A from "./A.vue";\n</script>\n<template><A :msgs="m" /></template>\n`,
          '/app/src/A.vue': renderTwice('B'),
          '/app/src/B.vue': renderTwice('A'),
        },
        '/app/src/A.vue',
      ],
    ])(
      'recursion through two modules ends, though each is parsed again: %s',
      async (_name, files, entry) => {
        let loads = 0;

        const usages = await analyzeProject(files, {
          entry,
          loadAll: true,
          onLoad: () => {
            // Fails fast instead of stalling.
            if (++loads > 1000) throw new Error('more than 1000 loads');
          },
        });

        expect(summarize(usages)).toEqual([call]);
        expect(loads).toBeLessThanOrEqual(200);
      }
    );

    test('parses the modules that call a function to find omitted arguments only for a parameter with a default', async () => {
      const parsesOfCallers = async (parameter: string) => {
        const parsed: string[] = [];
        await analyzeProject(
          {
            '/app/src/A.ts': `${imports}import { show } from "./show.js";\nshow(m);\n`,
            '/app/src/B.ts': `${imports}import { show } from "./show.js";\nshow(m);\n`,
            '/app/src/show.ts': `export function show(${parameter}) { return t.greeting(); }\n`,
          },
          {
            entry: '/app/src/show.ts',
            loadAll: true,
            onLoad: (file) => parsed.push(file),
          }
        );

        return parsed.filter((file) => file !== '/app/src/show.ts').length;
      };

      expect(await parsesOfCallers('t')).toBeLessThan(
        await parsesOfCallers('t = null')
      );
    });

    test('every value of an argument: a computed key with alternatives', async () => {
      const usages = await analyzeAll(
        {
          '/app/src/App.ts': `${imports}import { show } from "./show.js";\nshow(m[cond ? "first" : "second"]);\n`,
          '/app/src/show.ts': `export const show = (message) => message();\n`,
        },
        '/app/src/show.ts'
      );
      expect(summarize(usages)).toEqual([
        'message:first:call',
        'message:second:call',
      ]);
    });

    const show = `export function show(t) { return t.greeting(); }\n`;

    // unplugin-auto-import, Nuxt's composables: called without an import.
    test('an auto-imported function', async () => {
      const usages = await analyzeProject(
        {
          '/app/src/App.ts': `${imports}show(m);\n`,
          '/app/src/composables/show.ts': show,
        },
        {
          entry: '/app/src/composables/show.ts',
          loadAll: true,
          globals: [
            {
              name: 'show',
              file: '/app/src/composables/show.ts',
              exportName: 'show',
            },
          ],
        }
      );
      expect(summarize(usages)).toEqual([call]);
      expect(usages[0]!.targetFile).toBe('/app/src/paraglide/messages.js');
    });

    test.each([
      [
        'export { show } from',
        { '/app/src/ui/index.ts': `export { show } from "./show.js";\n` },
      ],
      ['export *', { '/app/src/ui/index.ts': `export * from "./show.js";\n` }],
      [
        'import, then export',
        {
          '/app/src/ui/index.ts': `import { show as s } from "./show.js";\nexport { s as show };\n`,
        },
      ],
      [
        'two barrels',
        {
          '/app/src/ui/index.ts': `export * from "./inner.js";\n`,
          '/app/src/ui/inner.ts': `export { show } from "./show.js";\n`,
        },
      ],
    ])('through a re-export barrel: %s', async (_name, barrel) => {
      const usages = await analyzeAll(
        {
          '/app/src/App.ts': `${imports}import { show } from "./ui/index.js";\nshow(m);\n`,
          '/app/src/ui/show.ts': show,
          ...barrel,
        },
        '/app/src/ui/show.ts'
      );
      expect(summarize(usages)).toEqual([call]);
      expect(usages[0]!.targetFile).toBe('/app/src/paraglide/messages.js');
    });

    test('through a barrel, as a namespace member', async () => {
      const usages = await analyzeAll(
        {
          '/app/src/App.ts': `${imports}import * as ui from "./ui/index.js";\nui.show(m);\n`,
          '/app/src/ui/index.ts': `export * from "./show.js";\n`,
          '/app/src/ui/show.ts': show,
        },
        '/app/src/ui/show.ts'
      );
      expect(summarize(usages)).toEqual([call]);
    });

    test.each([
      [
        'Vue',
        '/app/src/App.vue',
        `<script setup lang="ts">\n${imports}import { show } from "./show.js";\n</script>\n<template><p>{{ show(m) }}</p></template>\n`,
      ],
      [
        'Svelte',
        '/app/src/App.svelte',
        `<script lang="ts">\n${imports}import { show } from "./show.js";\n</script>\n<p>{show(m)}</p>\n`,
      ],
    ])('called from a %s template', async (_name, component, code) => {
      const usages = await analyzeAll(
        { [component]: code, '/app/src/show.ts': show },
        '/app/src/show.ts'
      );
      expect(summarize(usages)).toEqual([call]);
      expect(usages[0]!.targetFile).toBe(`${OUTDIR}/messages.js`);
    });
  });
});

describe('a parameter or prop that receives several values follows each', () => {
  test('props and arguments', async () => {
    expect(
      await describeLines(
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
      'message:flow_first:call 3',
      'message:flow_second:call 3',
      'message:flow_helper_first:call 4',
      'message:flow_helper_second:call 4',
      'message:flow_first:reference 7',
      'message:flow_second:reference 8',
      'message:flow_helper_first:reference 9',
      'message:flow_helper_second:reference 10',
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

describe('a `let` reassigned away from `m`', () => {
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

describe("a parameter's value that is only passed through or inspected", () => {
  test('is not a reference; the call site and calls are', async () => {
    expect(
      await describeLines(
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
      'message:pass_identity:reference 4',
      'message:pass_inspected:call 6',
      'message:pass_inspected:reference 9',
    ]);
  });

  test('a direct reference is still one', async () => {
    expect(
      await analyzeEntry(`${imports}export const f = () => m.title;`)
    ).toEqual(['message:title:reference']);
  });
});

test('another thread evaluates a shared range with the parameter in progress, as its copy of the module keys it', () => {
  let isEvaluated = false;
  // The parameter as another thread's graph parses its module: another object, the same key.
  const copy: Binding = {
    type: 'values',
    parameter: true,
    key: '/app/src/f.ts\u00000\u000016',
    candidates: () => {
      isEvaluated = true;
      return [];
    },
  };

  expect(inBinding({ ...copy }, () => resolveBinding(copy))).toEqual([]);
  expect(isEvaluated).toBe(false);
});
