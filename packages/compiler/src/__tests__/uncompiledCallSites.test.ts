/**
 * A production build that embeds translations fails when <T> reaches the
 * compiler as JSX, or a t template as a call that takes a template object:
 * the compiler embeds nothing there, and msgOutput files leave embedded
 * translations out.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as parser from '@babel/parser';
import { build, transformSync } from 'esbuild';
import ts from 'typescript';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest';
import { esbuild as gtEsbuild } from '../index';
import type { GTUnpluginOptions } from '../index';
import { clearInlineTranslationsCache } from '../transform/injection/inline-translations/loadInlineTranslations';
import { findUncompiledCallSites } from '../transform/validation/uncompiledCallSites';
import { transformWithPlugin } from './transformWithPlugin';

const find = (code: string) =>
  findUncompiledCallSites(
    parser.parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] })
  ).map(({ kind, name, source }) => ({ kind, name, source }));

const RAW_T = `
  import { T } from 'gt-react';
  export const App = () => <T>Hello world</T>;
`;

const TEMPLATES = `
  import { t, useGT } from 'gt-react/unstable';
  export const a = (name: string) => t\`Hello \${{ name }}!\`;
  export const b = () => t({ context: 'x' })\`Save\`;
  export function C() { const gt = useGT(); return gt\`Bye\`; }
`;

// What Babel's template literal transform and SWC with an ES5 target write for TEMPLATES
const BABEL_TEMPLATES = `
  var _templateObject, _templateObject2, _templateObject3;
  function _taggedTemplateLiteral(e, t) { return t || (t = e.slice(0)), Object.freeze(Object.defineProperties(e, { raw: { value: Object.freeze(t) } })); }
  import { t, useGT } from 'gt-react/unstable';
  export var a = function a(name) { return t(_templateObject || (_templateObject = _taggedTemplateLiteral(["Hello ", "!"])), { name: name }); };
  export var b = function b() { return t({ context: 'x' })(_templateObject2 || (_templateObject2 = _taggedTemplateLiteral(["Save"]))); };
  export function C() { var gt = useGT(); return gt(_templateObject3 || (_templateObject3 = _taggedTemplateLiteral(["Bye"]))); }
`;
const SWC_TEMPLATES = `
  import { t, useGT } from 'gt-react/unstable';
  function _tagged_template_literal(strings, raw) {
    if (!raw) raw = strings.slice(0);
    return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } }));
  }
  function _templateObject() {
    var data = _tagged_template_literal(["Hello ", "!"]);
    _templateObject = function _templateObject() { return data; };
    return data;
  }
  function _templateObject1() {
    var data = _tagged_template_literal(["Save"]);
    _templateObject1 = function _templateObject() { return data; };
    return data;
  }
  function _templateObject2() {
    var data = _tagged_template_literal(["Bye"]);
    _templateObject2 = function _templateObject() { return data; };
    return data;
  }
  export var a = function(name) { return t(_templateObject(), { name: name }); };
  export var b = function() { return t({ context: 'x' })(_templateObject1()); };
  export function C() { var gt = useGT(); return gt(_templateObject2()); }
`;

const COMPILED_TEMPLATES: [string, () => string][] = [
  [
    'TypeScript with an ES5 target',
    () =>
      ts.transpileModule(TEMPLATES, {
        compilerOptions: {
          target: ts.ScriptTarget.ES5,
          module: ts.ModuleKind.ESNext,
        },
      }).outputText,
  ],
  [
    'esbuild without template literals',
    () =>
      transformSync(TEMPLATES, {
        loader: 'ts',
        supported: { 'template-literal': false },
      }).code,
  ],
  ['Babel', () => BABEL_TEMPLATES],
  ['SWC with an ES5 target', () => SWC_TEMPLATES],
];

function createOutputDir(translations: Record<string, unknown> = {}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-uncompiled-'));
  onTestFinished(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'fr.json'), JSON.stringify(translations));
  return dir;
}

/** Options of a build that embeds French, read from files.gt.output. */
function embedding(
  options: GTUnpluginOptions = {},
  translations?: Record<string, unknown>
): GTUnpluginOptions {
  return {
    ...options,
    gtConfig: {
      defaultLocale: 'en',
      locales: ['fr', 'de'],
      files: {
        gt: {
          output: path.join(createOutputDir(translations), '[locale].json'),
          inlineTranslations: { locales: ['fr'] },
        },
      },
    },
  };
}

describe('findUncompiledCallSites', () => {
  describe('<T> written as JSX', () => {
    it.each([
      ['a named import', RAW_T, 'T', 'gt-react'],
      [
        'an import under another name',
        `import { T as Trans } from 'gt-react';
         export const App = () => <Trans>Hello world</Trans>;`,
        'Trans',
        'gt-react',
      ],
      [
        'a namespace import',
        `import * as GT from 'gt-react';
         export const App = () => <GT.T>Hello world</GT.T>;`,
        'GT.T',
        'gt-react',
      ],
      [
        'gt-next',
        `import { T } from 'gt-next';
         export const App = () => <T id="greeting">Hello world</T>;`,
        'T',
        'gt-next',
      ],
      [
        'gt-tanstack-start',
        `import { T, Var } from 'gt-tanstack-start';
         export const App = ({ name }) => <div><T>Hello <Var>{name}</Var></T></div>;`,
        'T',
        'gt-tanstack-start',
      ],
    ])('finds %s', (_name, code, name, source) => {
      expect(find(code)).toEqual([{ kind: 'jsx', name, source }]);
    });

    it.each([
      [
        'JSX compiled to calls',
        `import { jsx } from 'react/jsx-runtime';
         import { T } from 'gt-react';
         export const App = () => jsx(T, { children: 'Hello world' });`,
      ],
      [
        'a component of the app named T',
        `import { useGT } from 'gt-react';
         const T = ({ children }) => <b>{children}</b>;
         export const App = () => <T>Hello world</T>;`,
      ],
      [
        'T from another package',
        `import { useGT } from 'gt-react';
         import { Trans as T } from 'another-i18n';
         export const App = () => <T>Hello world</T>;`,
      ],
      [
        'a parameter that shadows the import',
        `import { T } from 'gt-react';
         export const App = ({ T }) => <T>Hello world</T>;`,
      ],
      [
        'a type-only import declaration',
        `import type { T } from 'gt-react';
         export const App = () => <T>Hello world</T>;`,
      ],
      [
        'a type-only import specifier',
        `import { type T, useGT } from 'gt-react';
         export const App = () => <T>Hello world</T>;`,
      ],
      [
        'a type-only namespace import',
        `import type * as GT from 'gt-react';
         export const App = () => <GT.T>Hello world</GT.T>;`,
      ],
      [
        'other GT components',
        `import { Plural, Var } from 'gt-react';
         export const App = ({ n }) => <Plural n={n} one="One" other="Many" />;`,
      ],
      [
        'a type parameter named T',
        `import { T } from 'gt-react';
         export function first<T>(items: T[]): T { return items[0]; }`,
      ],
    ])('does not find %s', (_name, code) => {
      expect(find(code)).toEqual([]);
    });
  });

  describe('t templates compiled to calls', () => {
    it.each(COMPILED_TEMPLATES)('finds those of %s', (_name, compile) => {
      expect(find(compile())).toEqual([
        { kind: 'template', name: 't', source: 'gt-react/unstable' },
        { kind: 'template', name: 't', source: 'gt-react/unstable' },
        { kind: 'template', name: 'gt', source: 'gt-react/unstable' },
      ]);
    });

    it('finds t imported under another name, and getGT', () => {
      expect(
        find(`
          import { t as translate } from 'gt-react/unstable';
          import { getGT } from 'gt-next/unstable/server';
          export const a = () => translate(_templateObject());
          export async function b() {
            const gt = await getGT();
            return gt(_templateObject2 || (_templateObject2 = _taggedTemplateLiteral(["Bye"])));
          }
        `)
      ).toEqual([
        { kind: 'template', name: 'translate', source: 'gt-react/unstable' },
        { kind: 'template', name: 'gt', source: 'gt-next/unstable/server' },
      ]);
    });

    it.each([
      ['tagged templates', TEMPLATES],
      [
        'a tag from another package',
        `import { useGT } from 'gt-react/unstable';
         import { t } from 'another-i18n';
         export const a = () => t(_templateObject());`,
      ],
      [
        'a tag of the app',
        `import { useGT } from 'gt-react/unstable';
         const t = (strings) => strings.join('');
         export const a = () => t(_templateObject || (_templateObject = _taggedTemplateLiteral(["Hello"])));`,
      ],
      [
        'a parameter that shadows the import',
        `import { t } from 'gt-react/unstable';
         export const a = (t) => t(_templateObject());`,
      ],
      [
        'a type-only import',
        `import type { t } from 'gt-react/unstable';
         export const a = () => t(_templateObject());`,
      ],
      [
        'msg, whose translations are not embedded',
        `import { msg } from 'gt-react/unstable';
         export const a = msg(_templateObject());`,
      ],
      [
        'calls of t with other arguments',
        `import { t } from 'gt-react/unstable';
         const _gt = ["Hello ", "!"];
         export const a = (name) => t(_gt, { name });
         export const b = t({ context: 'x' });
         export const c = (strings) => t(strings);`,
      ],
    ])('does not find %s', (_name, code) => {
      expect(find(code)).toEqual([]);
    });
  });

  it('finds both forms in one module, in source order', () => {
    expect(
      find(`
        import { T } from 'gt-react';
        import { t } from 'gt-react/unstable';
        export const title = () => t(_templateObject());
        export const App = () => <T>Hello world</T>;
      `).map(({ kind }) => kind)
    ).toEqual(['template', 'jsx']);
  });
});

describe('a build that embeds translations', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GT_STATIC_LOCALE', '');
    vi.stubEnv('GT_REPLACE_SOURCE', '');
    clearInlineTranslationsCache();
  });
  afterEach(() => vi.unstubAllEnvs());

  const withoutPath = (error: unknown) =>
    String((error as Error).message).replace(/[^ ]*[\\/](?=App\.tsx)/g, '');

  it('fails on <T> written as JSX', async () => {
    const error = await transformWithPlugin(embedding(), RAW_T).catch(
      (thrown: unknown) => thrown
    );
    expect((error as Error).name).toBe('InvalidLibraryUsageError');
    expect(withoutPath(error)).toMatchInlineSnapshot(
      `"@generaltranslation/compiler Error: This build would show <T> from "gt-react" in the source language because the compiler received it as JSX that is not compiled yet and embeds no translation for it, while files.gt.inlineTranslations leaves embedded translations out of msgOutput files. Compile JSX before this plugin runs: put the plugin or loader that compiles JSX ahead of it, and make sure it handles this file. Details: App.tsx:3:27."`
    );
  });

  it.each(COMPILED_TEMPLATES)(
    'fails on t templates compiled by %s',
    async (_name, compile) => {
      await expect(transformWithPlugin(embedding(), compile())).rejects.toThrow(
        'This build would show a t template from "gt-react/unstable" in the source language'
      );
    }
  );

  it('says how to keep tagged templates', async () => {
    const error = await transformWithPlugin(embedding(), SWC_TEMPLATES).catch(
      (thrown: unknown) => thrown
    );
    expect(withoutPath(error)).toMatchInlineSnapshot(
      `"@generaltranslation/compiler Error: This build would show a t template from "gt-react/unstable" in the source language because the compiler received it as a call that takes a template object, not as a tagged template, and embeds no translation for it, while files.gt.inlineTranslations leaves embedded translations out of msgOutput files. Raise the target of the tool that compiles this file before the plugin runs, so tagged templates stay as they are: jsc.target: "es2022" for SWC, "target": "ES2015" or later in tsconfig.json, or Babel targets that support template literals. Details: App.tsx:22:41, App.tsx:23:37, App.tsx:24:49."`
    );
  });

  it.each([
    [
      'esbuild',
      'esbuild runs plugins before it compiles JSX, so its plugin cannot embed translations of <T>',
    ],
    [
      'rolldown',
      'the transform of that plugin can return transformSync(id, code, { jsx: { runtime: "automatic" } }) from rolldown/utils',
    ],
    // The plugin a Rolldown config takes from this package's rollup export
    ['rollup', 'In Rolldown, which compiles JSX after its plugins run'],
    ['webpack', 'put the plugin or loader that compiles JSX ahead of it'],
    ['rspack', 'put the plugin or loader that compiles JSX ahead of it'],
  ] as const)('names the fix for <T> in %s', async (framework, fix) => {
    await expect(
      transformWithPlugin(embedding(), RAW_T, undefined, { framework })
    ).rejects.toThrow(fix);
  });

  it('lists the first call sites of a module', async () => {
    const code = `
      import { T } from 'gt-react';
      export const App = () => (
        <>
${Array.from({ length: 7 }, (_, i) => `          <T>Line ${i}</T>`).join('\n')}
        </>
      );
    `;
    const error = await transformWithPlugin(embedding(), code).catch(
      (thrown: unknown) => thrown
    );
    expect(withoutPath(error)).toContain(
      'Details: App.tsx:5:10, App.tsx:6:10, App.tsx:7:10, App.tsx:8:10, App.tsx:9:10, and 2 more in this file.'
    );
  });

  it.each([
    [
      'its static locale is an embedded one',
      { experimentalStaticLocale: 'fr' },
    ],
    [
      'it replaces the source with an embedded locale',
      { experimentalStaticLocale: 'fr', experimentalReplaceSource: true },
    ],
  ])('fails when %s', async (_name, options) => {
    await expect(
      transformWithPlugin(embedding(options), RAW_T)
    ).rejects.toThrow('This build would show <T> from "gt-react"');
  });

  it.each([
    [
      'its static locale is the source locale',
      { experimentalStaticLocale: 'en' },
    ],
    [
      'its static locale is not an embedded one',
      { experimentalStaticLocale: 'de' },
    ],
  ])('builds when %s, which embeds nothing', async (_name, options) => {
    await expect(
      transformWithPlugin(embedding(options), RAW_T)
    ).resolves.not.toThrow();
  });

  it('builds a module of an installed package', async () => {
    await expect(
      transformWithPlugin(embedding(), RAW_T, undefined, {
        file: path.join('node_modules', 'ui-kit', 'App.tsx'),
      })
    ).resolves.not.toThrow();
  });

  it('embeds at compiled call sites as before', async () => {
    const compiled = `
      import { jsx } from 'react/jsx-runtime';
      import { T } from 'gt-react';
      import { t } from 'gt-react/unstable';
      export const title = () => t\`Hello world\`;
      export const App = () => jsx(T, { children: 'Hello world' });
    `;
    const hashes = [
      ...(await transformWithPlugin(undefined, compiled))!.matchAll(
        /_hash: "([^"]+)"/g
      ),
    ].map((match) => match[1]);
    expect(hashes).toHaveLength(2);
    const output = await transformWithPlugin(
      embedding({}, { [hashes[0]]: 'Bonjour (t)', [hashes[1]]: 'Bonjour (T)' }),
      compiled
    );
    expect(output).toContain('locale === "fr" ? "Bonjour (t)"');
    expect(output).toContain('locale === "fr" ? "Bonjour (T)"');
  });
});

describe('a build that embeds no translations', () => {
  beforeEach(() => {
    vi.stubEnv('GT_STATIC_LOCALE', '');
    vi.stubEnv('GT_REPLACE_SOURCE', '');
    clearInlineTranslationsCache();
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    [
      'a production build without files.gt.inlineTranslations',
      'production',
      {},
    ],
    [
      'a production build with no embedded locales',
      'production',
      {
        gtConfig: {
          files: { gt: { inlineTranslations: { locales: [] } } },
        },
      },
    ],
    ['a development build', 'development', undefined],
  ] as const)('%s builds', async (_name, mode, options) => {
    vi.stubEnv('NODE_ENV', mode);
    for (const code of [RAW_T, SWC_TEMPLATES]) {
      await expect(
        transformWithPlugin(options ?? embedding(), code)
      ).resolves.not.toThrow();
    }
  });
});

describe('esbuild, which runs plugins before it compiles JSX', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GT_STATIC_LOCALE', '');
    vi.stubEnv('GT_REPLACE_SOURCE', '');
    clearInlineTranslationsCache();
  });
  afterEach(() => vi.unstubAllEnvs());

  async function bundle(code: string, options: GTUnpluginOptions) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-esbuild-'));
    onTestFinished(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.writeFileSync(path.join(dir, 'App.tsx'), code);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { outputFiles } = await build({
        absWorkingDir: dir,
        entryPoints: ['App.tsx'],
        bundle: true,
        write: false,
        format: 'esm',
        jsx: 'automatic',
        external: ['react', 'react/*', 'gt-react', 'gt-react/*'],
        logLevel: 'silent',
        plugins: [gtEsbuild(options)],
      });
      return outputFiles[0].text;
    } finally {
      warn.mockRestore();
    }
  }

  it('fails a build that embeds translations of <T>', async () => {
    await expect(bundle(RAW_T, embedding())).rejects.toThrow(
      /This build would show <T> from "gt-react" in the source language.*esbuild runs plugins before it compiles JSX/s
    );
  });

  it('builds <T> when no translations are embedded', async () => {
    await expect(bundle(RAW_T, { gtConfig: {} })).resolves.toContain(
      'Hello world'
    );
  });

  it('embeds translations of t templates, which reach it as written', async () => {
    const code = `
      import { t } from 'gt-react/unstable';
      export const title = () => t\`Hello world\`;
    `;
    const hash = (await transformWithPlugin(undefined, code))!.match(
      /_hash: "([^"]+)"/
    )![1];
    await expect(
      bundle(code, embedding({}, { [hash]: 'Bonjour le monde' }))
    ).resolves.toContain('Bonjour le monde');
  });
});
