import { once } from 'node:events';
import { createRequire } from 'node:module';
import { Worker } from 'node:worker_threads';
import { describe, expect, test } from 'vitest';
import {
  defaultTargets,
  defineTarget,
  messagesTarget,
} from '../../src/compiler/paraglide/targets.js';
import {
  ENTRY,
  OUTDIR,
  analyzeEntry,
  analyzeProject,
  summarize,
} from '../helpers/project.js';

const call = 'message:greeting:call';

describe('direct imports of Paraglide files', () => {
  test.each([
    ['named m', `import { m } from "./paraglide/messages.js"; m.greeting()`],
    [
      'renamed m',
      `import { m as t } from "./paraglide/messages.js"; t.greeting()`,
    ],
    [
      'string key',
      `import { m } from "./paraglide/messages.js"; m["greeting"]()`,
    ],
    [
      'namespace',
      `import * as pg from "./paraglide/messages.js"; pg.m.greeting()`,
    ],
    [
      'namespace message',
      `import * as pg from "./paraglide/messages.js"; pg.greeting()`,
    ],
    [
      'named message',
      `import { greeting as hi } from "./paraglide/messages.js"; hi()`,
    ],
    ['no extension', `import { m } from "./paraglide/messages"; m.greeting()`],
    [
      'absolute path',
      `import { m } from "/app/src/paraglide/messages.js"; m.greeting()`,
    ],
    [
      'message module',
      `import { greeting } from "./paraglide/messages/greeting.js"; greeting()`,
    ],
    [
      '_index barrel',
      `import { greeting } from "./paraglide/messages/_index.js"; greeting()`,
    ],
    [
      'locale module',
      `import { greeting } from "./paraglide/messages/en.js"; greeting()`,
    ],
    [
      'optional call',
      `import { m } from "./paraglide/messages.js"; m.greeting?.()`,
    ],
    [
      'TS wrapper',
      `import { m } from "./paraglide/messages.js"; (m as any).greeting!()`,
    ],
  ])('%s', async (_name, code) => {
    expect(await analyzeEntry(code)).toEqual([call]);
  });

  test('quoted message names', async () => {
    expect(
      await analyzeEntry(
        `import { "foo-bar" as fb } from "./paraglide/messages.js"; fb()`
      )
    ).toEqual(['message:foo-bar:call']);
  });

  test('aliases resolve by where they point, not by name', async () => {
    const aliases = { '#i18n': '/app/src/paraglide/messages.js' };
    expect(
      await analyzeEntry(
        `import { m } from "#i18n"; m.greeting()`,
        {},
        { aliases }
      )
    ).toEqual([call]);
  });
});

describe('following re-exports', () => {
  const barrel = (code: string) => ({ '/app/src/i18n.ts': code });

  const useM = `import { m } from "./i18n.js"; m.greeting()`;
  const useT = `import { t } from "./i18n.js"; t.greeting()`;
  test.each([
    ['export { m } from', `export { m } from "./paraglide/messages.js"`, useM],
    [
      'export { m as t } from',
      `export { m as t } from "./paraglide/messages.js"`,
      useT,
    ],
    ['export *', `export * from "./paraglide/messages.js"`, useM],
    [
      'import, then export { m }',
      `import { m } from "./paraglide/messages.js"; export { m }`,
      useM,
    ],
    [
      'export const t = m',
      `import { m } from "./paraglide/messages.js"; export const t = m`,
      useT,
    ],
    [
      'export const { greeting } = m',
      `import { m } from "./paraglide/messages.js"; export const { greeting } = m`,
      `import { greeting } from "./i18n.js"; greeting()`,
    ],
    [
      'namespace import of the barrel',
      `export { m } from "./paraglide/messages.js"`,
      `import * as i18n from "./i18n.js"; i18n.m.greeting()`,
    ],
  ])('%s', async (_name, barrelCode, entry) => {
    const usages = await analyzeProject({
      [ENTRY]: entry,
      ...barrel(barrelCode),
    });
    expect(summarize(usages)).toEqual([call]);
    expect(usages[0]!.targetFile).toBe('/app/src/paraglide/messages.js');
  });

  test('export * as ns and default exports', async () => {
    const usages = await analyzeProject({
      [ENTRY]: [
        `import { messages } from "./i18n/index.js";`,
        `import greet from "./greet.js";`,
        `messages.m.greeting();`,
        `greet();`,
      ].join('\n'),
      '/app/src/i18n/index.ts': `export * as messages from "./inner.js";`,
      '/app/src/i18n/inner.ts': `export * from "../paraglide/messages.js";`,
      '/app/src/greet.ts': `import { m } from "./paraglide/messages.js"; export default m.greeting;`,
    });
    expect(summarize(usages)).toEqual([call, call]);
    expect(usages.map((usage) => usage.targetFile)).toEqual([
      `${OUTDIR}/messages.js`,
      `${OUTDIR}/messages.js`,
    ]);
  });

  test('terminates on re-export cycles', async () => {
    expect(
      await analyzeEntry(`import { m } from "./a.js"; m.greeting()`, {
        '/app/src/a.ts': `export * from "./b.js";`,
        '/app/src/b.ts': `export * from "./a.js"; export { m } from "./paraglide/messages.js";`,
      })
    ).toEqual([call]);
  });

  test('a name behind nested barrels, past the modules that do not export it', async () => {
    expect(
      await analyzeEntry(`import { m } from "./index.js"; m.greeting()`, {
        '/app/src/index.ts': `export * from "./a/index.js"; export * from "./b/index.js";`,
        '/app/src/a/index.ts': `export * from "./one.js"; export * from "./two.js";`,
        '/app/src/a/one.ts': `export const one = 1;`,
        '/app/src/a/two.ts': `export function two() {}`,
        '/app/src/b/index.ts': `export * from "./i18n.js";`,
        '/app/src/b/i18n.ts': `export { m } from "../paraglide/messages.js";`,
      })
    ).toEqual([call]);
  });

  test('export * of a CommonJS module, whose exports are not listed', async () => {
    expect(
      await analyzeEntry(`import { m } from "./barrel.js"; m.greeting()`, {
        '/app/src/barrel.ts': `export * from "./one.js"; export * from "./legacy.js";`,
        '/app/src/one.ts': `export const one = 1;`,
        '/app/src/legacy.js': `const { m } = require("./paraglide/messages.js"); module.exports = { m };`,
      })
    ).toEqual([call]);
  });

  test('dynamic import and require', async () => {
    expect(
      await analyzeEntry(
        [
          `const { m } = await import("./paraglide/messages.js");`,
          `m.greeting();`,
          `import("./paraglide/messages.js").then(({ m }) => m.greeting());`,
          `import("./paraglide/messages.js").then((mod) => mod.m.greeting());`,
          `const legacy = require("./paraglide/messages.js");`,
          `legacy.m.greeting();`,
        ].join('\n')
      )
    ).toEqual([call, call, call, call]);
  });

  test('TypeScript import = require', async () => {
    expect(
      await analyzeEntry(
        `import msgs = require("./paraglide/messages.js"); msgs.m.greeting()`
      )
    ).toEqual([call]);
  });
});

describe('bindings and scopes', () => {
  test('aliases and destructuring inside components', async () => {
    expect(
      await analyzeEntry(
        [
          `import { m } from "./paraglide/messages.js";`,
          `const t = m;`,
          `function App() {`,
          `  const { greeting, tos: terms } = t;`,
          `  return [greeting(), terms.parts({})];`,
          `}`,
        ].join('\n')
      )
    ).toEqual([call, 'message:tos:method']);
  });

  test('local declarations shadow imports', async () => {
    expect(
      await analyzeEntry(
        [
          `import { m, greeting } from "./paraglide/messages.js";`,
          `function a(m) { return m.greeting(); }`,
          `function b() { const m = { greeting() {} }; return m.greeting(); }`,
          `function c() { try {} catch (greeting) { greeting(); } }`,
          `function d() { var greeting = () => ""; { greeting(); } }`,
          `for (const m of []) m.greeting();`,
          `m.greeting();`,
        ].join('\n')
      )
    ).toEqual([call]);
  });

  test('property names are not references', async () => {
    expect(
      await analyzeEntry(
        [
          `import { m, greeting } from "./paraglide/messages.js";`,
          `foo.greeting; ({ greeting: 1 }); class A { greeting() {} }`,
          `const { greeting: renamed } = other;`,
        ].join('\n')
      )
    ).toEqual([]);
  });

  test('references, shorthand properties and member reads', async () => {
    expect(
      await analyzeEntry(
        [
          `import { m, greeting } from "./paraglide/messages.js";`,
          `use(m.tos); use({ greeting }); m.tos.name;`,
        ].join('\n')
      )
    ).toEqual([
      'message:tos:reference',
      'message:greeting:reference',
      'message:tos:reference',
    ]);
  });
});

describe('verification: specifiers that do not reach Paraglide', () => {
  test.each([
    [
      'package with a messages path',
      `import { m } from "some-lib/messages"; m.greeting()`,
    ],
    [
      'messages.js outside outdir',
      `import { m } from "./other/messages.js"; m.greeting()`,
    ],
    ['unresolvable', `import { m } from "./missing/messages.js"; m.greeting()`],
    [
      'type-only import',
      `import type { m } from "./paraglide/messages.js"; declare const x: typeof m;`,
    ],
    [
      'generated file that is not a target',
      `import x from "./paraglide/messages/package.json"; x.greeting()`,
    ],
  ])('%s', async (_name, code) => {
    expect(
      await analyzeEntry(code, {
        '/app/node_modules/some-lib/messages.js': 'export const m = {}',
        '/app/src/other/messages.js': 'export const m = {}',
        '/app/src/paraglide/messages/package.json': '{}',
      })
    ).toEqual([]);
  });
});

describe('targets', () => {
  test('only messages are usages by default', async () => {
    expect(
      await analyzeEntry(
        [
          `import { m } from "./paraglide/messages.js";`,
          `import { getLocale, setLocale } from "./paraglide/runtime.js";`,
          `import { ParaglideMessage } from "@inlang/paraglide-js-react";`,
          `setLocale(getLocale()); m.greeting(getLocale());`,
          `export const Tos = () => <ParaglideMessage message={m.tos} />;`,
        ].join('\n'),
        { '/app/node_modules/@inlang/paraglide-js-react/index.js': 'export {}' }
      )
    ).toEqual([call, 'message:tos:reference']);
  });

  test("an error a custom target throws is the analysis' error", async () => {
    const thrown = new Error('no such export');
    const failing = defineTarget({
      ...messagesTarget,
      name: 'failing',
      exportSymbol: () => {
        throw thrown;
      },
    });

    await expect(
      analyzeEntry(
        `import { m } from "./paraglide/messages.js"; m.greeting();`,
        {},
        { targets: [failing] }
      )
    ).rejects.toBe(thrown);
  });

  test('a custom target finds what a built-in one does in a large module, split between cores', async () => {
    // More than 32,768 nodes, at every depth, and deeper than a call per level could go.
    const code = [
      `import { m } from "./paraglide/messages.js";`,
      ...Array.from(
        { length: 1500 },
        (_, index) =>
          `export function f${index}(t = m.a${index}) { const alias = m.b${index}; return [t(), alias(), m[\`c_\${index}\`]()]; }`
      ),
      `export const chain = "s"${Array.from({ length: 20_000 }, (_, index) => (index % 1000 === 0 ? ` + m.d${index}()` : ` + "s${index}"`)).join('')};`,
    ].join('\n');
    const relabeled = defineTarget({ ...messagesTarget, name: 'relabeled' });

    const builtIn = await analyzeEntry(code);
    const custom = await analyzeEntry(code, {}, { targets: [relabeled] });

    expect(builtIn.length).toBeGreaterThan(4500);
    expect(custom).toEqual(
      builtIn.map((usage) => usage.replace(/^message:/, 'relabeled:'))
    );
  });

  test('a custom target is asked from a thread of a small stack: the analysis runs on its own', async () => {
    const binding = createRequire(import.meta.url).resolve(
      '@generaltranslation/paraglide-js/native'
    );
    // A chain of `export *` 10,000 modules deep, which the analysis follows by calling itself.
    const script = `
      const { parentPort, workerData } = require('node:worker_threads');
      const path = require('node:path');
      const native = require(workerData.binding);
      const depth = 10000;
      const graph = new native.NativeGraph({ targets: [{ name: 'custom', kind: 'custom' }], outdirs: ['/app/src/paraglide'], sourceExtensions: [], detect: [] });
      for (let i = 0; i < depth; i++) graph.queueScript('/app/src/n' + i + '.js', i, 'export * from "./n' + (i + 1) + '.js";');
      graph.queueScript('/app/src/n' + depth + '.js', depth, 'export { greeting } from "./paraglide/messages.js";');
      graph.queueScript('/app/src/app.js', depth + 1, 'import { greeting } from "./n0.js"; greeting();');
      graph.load([], []).then(() => {
        const { importers, counts, specifiers } = graph.pendingSpecifiers();
        const directories = importers.flatMap((importer, i) => Array(counts[i]).fill(path.posix.dirname(importer)));
        graph.setResolved(specifiers.map((specifier, i) => path.posix.join(directories[i], specifier)));
        graph.setCustomMatches(['/app/src/paraglide/messages.js'], [0]);
        graph.analyzeWithCustomTargets(['/app/src/app.js'], (target, file, name) => ({ kind: 'value', name }));
        parentPort.postMessage(graph.usagesOf('/app/src/app.js'));
      });
    `;
    const worker = new Worker(script, {
      eval: true,
      workerData: { binding },
      resourceLimits: { stackSizeMb: 1 },
    });

    const [usages] = (await once(worker, 'message')) as [string];
    expect(JSON.parse(usages)).toMatchObject([
      { target: 'custom', name: 'greeting', kind: 'call' },
    ]);
    await worker.terminate();
  });

  test('a target after defaultTargets relabels a built-in one', async () => {
    const relabeled = defineTarget({ ...messagesTarget, name: 'relabeled' });
    expect(
      await analyzeEntry(
        `import { m } from "./paraglide/messages.js"; m.greeting();`,
        {},
        { targets: [...defaultTargets, relabeled] }
      )
    ).toEqual(['relabeled:greeting:call']);
  });
});

describe('multiple Paraglide projects', () => {
  const UI_OUTDIR = '/app/packages/ui/paraglide';
  const files = {
    [ENTRY]: [
      `import { m } from "./paraglide/messages.js";`,
      `import { m as ui } from "../packages/ui/paraglide/messages.js";`,
      `import { getLocale } from "../packages/ui/paraglide/runtime.js";`,
      `m.greeting(); ui.save_button(); getLocale();`,
    ].join('\n'),
    [`${UI_OUTDIR}/messages.js`]: 'export {}',
    [`${UI_OUTDIR}/runtime.js`]: 'export {}',
  };

  test('matches every outdir and records which one', async () => {
    const usages = await analyzeProject(files, {
      outdirs: [OUTDIR, UI_OUTDIR],
    });
    expect(
      usages.map(({ target, name, targetFile }) => [target, name, targetFile])
    ).toEqual([
      ['message', 'greeting', '/app/src/paraglide/messages.js'],
      ['message', 'save_button', '/app/packages/ui/paraglide/messages.js'],
    ]);
  });

  test.each([
    ['a script', ENTRY, (code: string) => code],
    // A framework file's usages are merged by position.
    [
      'a component file',
      '/app/src/Page.astro',
      (code: string) => `---\n${code}\n---\n`,
    ],
  ])(
    'a message both outdirs define, passed to one helper in %s, is a usage of each',
    async (_name, entry, wrap) => {
      const code = [
        `import { m } from "./paraglide/messages.js";`,
        `import { m as ui } from "../packages/ui/paraglide/messages.js";`,
        `const show = (message) => message();`,
        `show(m.greeting); show(ui.greeting);`,
      ].join('\n');
      const usages = await analyzeProject(
        { ...files, [entry]: wrap(code) },
        { entry, outdirs: [OUTDIR, UI_OUTDIR] }
      );
      expect(
        usages
          .filter(({ kind }) => kind === 'call')
          .map(({ name, targetFile }) => [name, targetFile])
      ).toEqual([
        ['greeting', '/app/src/paraglide/messages.js'],
        ['greeting', '/app/packages/ui/paraglide/messages.js'],
      ]);
    }
  );

  test('ignores directories that do not verify as outdirs', async () => {
    expect(summarize(await analyzeProject(files))).toEqual([call]);
  });

  test('targets can tell projects apart', async () => {
    const uiMessages = defineTarget({
      name: 'ui-message',
      matches: (file) =>
        file.outdir === UI_OUTDIR && messagesTarget.matches(file),
      exportSymbol: messagesTarget.exportSymbol,
    });
    const usages = await analyzeProject(files, {
      outdirs: [OUTDIR, UI_OUTDIR],
      // A later target wins over an earlier one matching the same file.
      targets: [messagesTarget, uiMessages],
    });
    expect(summarize(usages)).toEqual([call, 'ui-message:save_button:call']);
  });

  test('a nested outdir wins over its parent', async () => {
    const nested = `${OUTDIR}/nested`;
    const usages = await analyzeProject(
      {
        [ENTRY]: `import { m } from "./paraglide/nested/messages.js"; m.greeting();`,
        [`${nested}/messages.js`]: 'export {}',
      },
      { outdirs: [OUTDIR, nested] }
    );
    expect(summarize(usages)).toEqual([call]);
  });
});
