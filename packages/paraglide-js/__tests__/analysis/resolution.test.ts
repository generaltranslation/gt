import { describe, expect, test } from 'vitest';
import {
  defaultTargets,
  defineTarget,
  messagesTarget,
  packageTarget,
  runtimeTarget,
} from '../../lib/compiler/paraglide/targets.js';
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
    expect(usages[0]!.resolution).toEqual([
      'src/i18n.ts',
      'src/paraglide/messages.js',
    ]);
  });

  test('export * as ns, default exports, and the resolution chain', async () => {
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
    expect(usages.map((usage) => usage.resolution)).toEqual([
      ['src/i18n/index.ts', 'src/i18n/inner.ts', 'src/paraglide/messages.js'],
      ['src/greet.ts', 'src/paraglide/messages.js'],
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
    ).toEqual([call, 'message:tos:method.parts']);
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
  test('runtime usages', async () => {
    expect(
      await analyzeEntry(
        [
          `import { getLocale, setLocale, locales } from "./paraglide/runtime.js";`,
          `import * as runtime from "./paraglide/runtime.js";`,
          `setLocale(getLocale()); locales.map((l) => l); runtime.localizeHref("/");`,
        ].join('\n')
      )
    ).toEqual([
      'runtime:setLocale:call',
      'runtime:getLocale:call',
      'runtime:locales:reference',
      'runtime:localizeHref:call',
    ]);
  });

  test('restricting targets', async () => {
    expect(
      await analyzeEntry(
        [
          `import { m } from "./paraglide/messages.js";`,
          `import { getLocale } from "./paraglide/runtime.js";`,
          `m.greeting(getLocale());`,
        ].join('\n'),
        {},
        { targets: [messagesTarget] }
      )
    ).toEqual([call]);
  });

  test('custom package target used as a component', async () => {
    expect(
      await analyzeEntry(
        [
          `import { ParaglideMessage } from "@inlang/paraglide-js-react";`,
          `import { m } from "./paraglide/messages.js";`,
          `export const Tos = () => <ParaglideMessage message={m.tos} />;`,
        ].join('\n'),
        {
          '/app/node_modules/@inlang/paraglide-js-react/index.js': 'export {}',
        },
        {
          targets: [
            messagesTarget,
            runtimeTarget,
            packageTarget('react-adapter', '@inlang/paraglide-js-react'),
          ],
        }
      )
    ).toEqual([
      'react-adapter:ParaglideMessage:component',
      'message:tos:reference',
    ]);
  });

  test('a target after defaultTargets relabels a built-in one', async () => {
    expect(
      await analyzeEntry(
        `import { Message } from "@inlang/paraglide-js-react";\nexport const A = () => <Message />;`,
        {
          '/app/node_modules/@inlang/paraglide-js-react/index.js': 'export {}',
        },
        {
          targets: [
            ...defaultTargets,
            packageTarget('react-adapter', '@inlang/paraglide-js-react'),
          ],
        }
      )
    ).toEqual(['react-adapter:Message:component']);
  });

  test("a dependency's resolution starts at node_modules, without pnpm's store path", async () => {
    // As pnpm resolves it: the real path in the store.
    const installed =
      '/app/node_modules/.pnpm/paraglide-adapter@1.0.0_abc/node_modules/paraglide-adapter/index.js';
    const [usage] = await analyzeProject(
      {
        [ENTRY]: `import { ParaglideMessage } from "paraglide-adapter";\nexport const A = () => <ParaglideMessage />;\n`,
        [installed]: 'export {}',
      },
      {
        targets: [packageTarget('adapter', 'paraglide-adapter')],
        aliases: { 'paraglide-adapter': installed },
      }
    );
    expect(usage!.resolution).toEqual([
      'node_modules/paraglide-adapter/index.js',
    ]);
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
      usages.map(({ target, name, resolution }) => [target, name, resolution])
    ).toEqual([
      ['message', 'greeting', ['src/paraglide/messages.js']],
      ['message', 'save_button', ['packages/ui/paraglide/messages.js']],
      ['runtime', 'getLocale', ['packages/ui/paraglide/runtime.js']],
    ]);
  });

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

describe("Paraglide's framework adapters are targets by default", () => {
  test.each([
    [
      '@inlang/paraglide-js-react',
      `import { Message } from "@inlang/paraglide-js-react"; export const A = () => <Message message={m.tos} />;`,
    ],
    [
      '@inlang/paraglide-sveltekit',
      `import { i18n } from "@inlang/paraglide-sveltekit"; i18n.resolveRoute("/");`,
    ],
  ])('%s', async (packageName, code) => {
    const usages = await analyzeProject({
      [ENTRY]: `import { m } from "./paraglide/messages.js";\n${code}`,
      [`/app/node_modules/${packageName}/index.js`]: 'export {}',
    });
    expect(summarize(usages)).toContainEqual(
      expect.stringMatching(new RegExp(`^${packageName}:`))
    );
  });
});
