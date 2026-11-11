import path from 'node:path/posix';
import { parseSync } from 'oxc-parser';
import { describe, expect, test } from 'vitest';
import { analyzeModule } from '../../lib/compiler/analysis/analyze.js';
import { ModuleGraph } from '../../lib/compiler/analysis/module-graph.js';
import { defaultLanguages } from '../../lib/compiler/languages/index.js';
import {
  isSourceFile,
  parseSource,
} from '../../lib/compiler/languages/language.js';
import { defaultTargets } from '../../lib/compiler/paraglide/targets.js';
import {
  OUTDIR,
  REPO_PACKAGES,
  ROOT,
  analyzeEntry,
  analyzeProject,
  summarize,
} from '../helpers/project.js';

const imports = `import { m } from "./paraglide/messages.js";\n`;
const call = 'message:greeting:call';

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
      expect(usages[0]!.resolution).toEqual([
        'src/App.tsx',
        'src/paraglide/messages.js',
      ]);
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

    const show = `export function show(t) { return t.greeting(); }\n`;

    // unplugin-auto-import, Nuxt's composables: called without an import (G4).
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
      expect(usages[0]!.resolution).toEqual([
        'src/App.ts',
        'src/paraglide/messages.js',
      ]);
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
      expect(usages[0]!.resolution).toEqual([
        'src/App.ts',
        'src/paraglide/messages.js',
      ]);
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
      expect(usages[0]!.resolution).toEqual([
        component.replace('/app/', ''),
        'src/paraglide/messages.js',
      ]);
    });
  });
});

/** Loads every file, as the collector does, then analyzes `file`. */
async function analyzeAll(files: Record<string, string>, file: string) {
  const all = new Map(
    Object.entries({ [`${OUTDIR}/messages.js`]: 'export {}', ...files })
  );
  const graph = new ModuleGraph({
    targets: defaultTargets,
    isOutdir: async (directory) => directory === OUTDIR,
    shouldFollow: (candidate) => isSourceFile(candidate, defaultLanguages),
    async resolve(specifier, importer) {
      const base = path.resolve(path.dirname(importer), specifier);
      return [
        base,
        base.replace(/\.js$/, '.ts'),
        base.replace(/\.js$/, '.tsx'),
      ].find((candidate) => all.has(candidate));
    },
    async readModule(candidate) {
      const code = all.get(candidate);
      if (code === undefined) return undefined;
      const parsed = await parseSource(
        candidate,
        code,
        (name, source, lang) =>
          parseSync(name, source, {
            lang,
            range: true,
            astType: 'ts',
          }) as never,
        defaultLanguages,
        REPO_PACKAGES
      );
      if ('error' in parsed) throw new Error(parsed.error);
      return parsed.module;
    },
  });
  for (const name of Object.keys(files)) await graph.loadPath(name);
  return analyzeModule({ graph, file, root: ROOT });
}
