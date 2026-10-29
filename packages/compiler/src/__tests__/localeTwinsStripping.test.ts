/**
 * With the `'locale-twins'` translation splitting strategy, client production
 * builds remove source-locale text from emitted code (it travels in the
 * module's placeholder instead). Elements, props, variables and their GT
 * indices stay, because translated JSX references them by index. Server and
 * dev builds keep the text.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  TransformResult,
  UnpluginBuildContext,
  UnpluginContext,
} from 'unplugin';
import { findLocaleTwinPlaceholders } from 'generaltranslation/internal';
import { hashSource } from 'generaltranslation/id';
import gtUnplugin, { type GTUnpluginOptions } from '../index';

const TWINS: GTUnpluginOptions = {
  logLevel: 'warn',
  gtConfig: {
    defaultLocale: 'en',
    files: {
      gt: { output: 'src/_gt/[locale].json', splitting: 'locale-twins' },
    },
  },
};

type Environment = {
  name: string;
  mode: 'build' | 'dev' | 'unknown';
  config: { consumer: 'client' | 'server' };
};

const CLIENT_BUILD: Environment = {
  name: 'client',
  mode: 'build',
  config: { consumer: 'client' },
};
const SERVER_BUILD: Environment = {
  name: 'ssr',
  mode: 'build',
  config: { consumer: 'server' },
};
const CLIENT_DEV: Environment = {
  name: 'client',
  mode: 'dev',
  config: { consumer: 'client' },
};

function createTestContext(
  environment?: Environment | null
): UnpluginBuildContext & UnpluginContext {
  return {
    addWatchFile() {},
    emitFile() {},
    getWatchFiles() {
      return [];
    },
    parse() {
      throw new Error('parse is not implemented in this test context');
    },
    warn() {},
    error(message: unknown) {
      throw new Error(String(message));
    },
    ...(environment && { environment }),
  } as UnpluginBuildContext & UnpluginContext;
}

type TransformHook = (
  this: unknown,
  code: string,
  id: string,
  options?: { ssr?: boolean }
) => Promise<TransformResult> | TransformResult;

function createPlugin(options: GTUnpluginOptions = TWINS) {
  return gtUnplugin.raw(options, { framework: 'vite' });
}

async function runTransform(
  plugin: ReturnType<typeof createPlugin>,
  code: string,
  environment: Environment | null,
  id = '/src/page.tsx'
): Promise<string | null> {
  const result = await (plugin.transform as TransformHook).call(
    createTestContext(environment),
    code,
    id,
    { ssr: environment?.config.consumer === 'server' }
  );
  if (result == null) return null;
  return typeof result === 'string' ? result : result.code;
}

async function transform(
  code: string,
  /** `null`: a bundler context without Vite environments */
  environment: Environment | null = CLIENT_BUILD,
  options: GTUnpluginOptions = TWINS
): Promise<string | null> {
  return runTransform(createPlugin(options), code, environment);
}

/** Removes whitespace so assertions don't depend on Babel's line layout. */
function squash(code: string): string {
  return code.replace(/\s+/g, '');
}

/** The code without the registration call (whose payload has the source). */
function withoutPlaceholder(code: string): string {
  let out = code;
  for (const { token } of findLocaleTwinPlaceholders(code)) {
    out = out.replace(token, '"<placeholder>"');
  }
  return out;
}

function jsxHash(source: unknown): string {
  return hashSource({ source: source as string, dataFormat: 'JSX' });
}

function icuHash(source: string, extra: { context?: string } = {}): string {
  return hashSource({ source, ...extra, dataFormat: 'ICU' });
}

const T_MODULE = `import { jsx } from 'react/jsx-runtime';
import { T } from 'gt-react';
export const el = jsx(T, { children: "Hello world" });`;

describe('locale twins source stripping', () => {
  it('removes <T> text from client build output but keeps it in the placeholder', async () => {
    const code = (await transform(T_MODULE))!;

    expect(withoutPlaceholder(code)).not.toContain('Hello world');
    expect(squash(code)).toContain(
      squash(`jsx(T, { children: "", _hash: "${jsxHash('Hello world')}" })`)
    );
    expect(findLocaleTwinPlaceholders(code)[0].entries).toEqual({
      [jsxHash('Hello world')]: 'Hello world',
    });
  });

  it.each([
    ['the server environment', SERVER_BUILD],
    ['vite dev', CLIENT_DEV],
    ['a bundler without environments', null],
  ])('keeps text in %s', async (_name, environment) => {
    const code = (await transform(T_MODULE, environment))!;

    expect(withoutPlaceholder(code)).toContain('"Hello world"');
  });

  it('keeps text with the default splitting strategy', async () => {
    const code = (await transform(T_MODULE, CLIENT_BUILD, {
      logLevel: 'silent',
      gtConfig: {},
    }))!;

    expect(code).toContain('"Hello world"');
  });

  it('falls back to the ssr flag and the resolved command without environments', async () => {
    const resolve = async (command: 'build' | 'serve', ssr: boolean) => {
      const plugin = createPlugin();
      (
        plugin.vite as { configResolved: (config: { command: string }) => void }
      ).configResolved({ command });
      const result = await (plugin.transform as TransformHook).call(
        createTestContext(),
        T_MODULE,
        '/src/page.tsx',
        { ssr }
      );
      return withoutPlaceholder(
        typeof result === 'string' ? result : result!.code
      );
    };

    expect(await resolve('build', false)).not.toContain('Hello world');
    expect(await resolve('build', true)).toContain('Hello world');
    expect(await resolve('serve', false)).toContain('Hello world');
  });

  it('blanks gt(), t() and msg() messages and the useGT prefetch list, keeping options', async () => {
    const code = (await transform(`import { useGT, msg, t } from 'gt-react';
export const greeting = msg("Hello {name}", { $context: "greeting", name: "x" });
export function Page({ name }) {
  const gt = useGT();
  const a = gt("Save " + "it");
  const b = t(\`Cancel\`, { $id: "cancel" });
  return gt("Hi {name}", { name });
}`))!;

    const out = squash(withoutPlaceholder(code));
    for (const text of ['Hello', 'Save', 'Cancel', 'Hi']) {
      expect(out).not.toContain(text);
    }
    expect(out).toContain(
      squash(
        `msg("", { $context: "greeting", name: "x", "$_hash": "${icuHash('Hello {name}', { context: 'greeting' })}" })`
      )
    );
    expect(out).toContain(
      squash(
        `useGT([{ $_hash: "${icuHash('Save it')}", message: "" }, { $_hash: "${icuHash('Hi {name}')}", message: "" }])`
      )
    );
    expect(out).toContain(
      squash(`gt("", { "$_hash": "${icuHash('Save it')}" })`)
    );
    expect(out).toContain(
      squash(`t("", { $id: "cancel", "$_hash": "${icuHash('Cancel')}" })`)
    );
    expect(out).toContain(
      squash(`gt("", { name, "$_hash": "${icuHash('Hi {name}')}" })`)
    );
    expect(findLocaleTwinPlaceholders(code)[0].entries).toEqual({
      [icuHash('Hello {name}', { context: 'greeting' })]: 'Hello {name}',
      [icuHash('Save it')]: 'Save it',
      [icuHash('Cancel')]: 'Cancel',
      [icuHash('Hi {name}')]: 'Hi {name}',
    });
  });

  it('keeps <T> elements, props, variables and positions, blanking only text', async () => {
    const code =
      (await transform(`import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { T, Var, Num, Plural, Branch } from 'gt-react';
export const el = jsxs(T, { id: "intro", context: "nav", children: [
  "Hi ",
  jsx("b", { className: "x", children: "there" }),
  jsx(Var, { children: name }),
  jsx("input", { placeholder: "Your name", title: \`Name\`, type: "text" }),
  jsx(Plural, { n: count, one: "One item", other: jsxs(Fragment, { children: [jsx(Num, { children: count }), " items"] }) }),
  jsx(Branch, { branch: mode, dark: "Dark", children: "Light" }),
  42,
  -1,
  false,
  null
] });`))!;

    expect(squash(withoutPlaceholder(code))).toContain(
      squash(`jsxs(T, { id: "intro", context: "nav", children: [
  "",
  jsx("b", { className: "x", children: "" }),
  jsx(Var, { children: name }),
  jsx("input", { placeholder: "", title: "", type: "text" }),
  jsx(Plural, { n: count, one: "", other: jsxs(Fragment, { children: [jsx(Num, { children: count }), ""] }) }),
  jsx(Branch, { branch: mode, dark: "", children: "" }),
  "",
  "",
  false,
  null
], _hash:`)
    );
  });

  it('preserves GT element and variable indices', async () => {
    const original =
      (await transform(`import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { T, Var, Plural } from 'gt-react';
export const el = jsxs(T, { children: [
  "Hi ",
  jsxs("p", { children: ["a", jsx("i", { children: "b" }), "c"] }),
  jsx(Var, { children: name }),
  jsx(Plural, { n: count, one: jsx("em", { children: "one" }), other: jsxs(Fragment, { children: ["many ", jsx("u", { children: "x" })] }) }),
  jsx("span", { title: "tip", children: "end" })
] });`))!;
    const [before] = findLocaleTwinPlaceholders(original);

    // Recompile the stripped output: its children now contain only blanks
    const recompiled = (await transform(original, SERVER_BUILD))!;
    const after = findLocaleTwinPlaceholders(recompiled).find(
      (match) => match.token !== before.token
    )!;

    const [beforeSource] = Object.values(before.entries);
    const [afterSource] = Object.values(after.entries);
    expect(collectIds(afterSource)).toEqual(collectIds(beforeSource));
    expect(collectIds(beforeSource)).toEqual([
      'p#1',
      'i#2',
      'v:_gt_value_3#3',
      'Plural#4',
      'em#5',
      'C5#5',
      'u#6',
      'span#5',
    ]);
    expect(JSON.stringify(afterSource)).not.toMatch(/Hi |tip|end|many /);
  });
});

/** `tag#index` / `v:name#index` for every element and variable, in order. */
function collectIds(content: unknown): string[] {
  if (Array.isArray(content)) return content.flatMap(collectIds);
  if (!content || typeof content !== 'object') return [];
  const node = content as {
    t?: string;
    k?: string;
    i?: number;
    c?: unknown;
    d?: { b?: Record<string, unknown> };
  };
  const self =
    node.k !== undefined ? `v:${node.k}#${node.i}` : `${node.t}#${node.i}`;
  return [
    self,
    ...Object.values(node.d?.b ?? {}).flatMap(collectIds),
    ...collectIds(node.c),
  ];
}

type BuildEndHook = (this: unknown) => void | Promise<void>;

async function buildEnd(
  plugin: ReturnType<typeof createPlugin>,
  environment: Environment | null
): Promise<void> {
  await (plugin.buildEnd as BuildEndHook).call(createTestContext(environment));
}

const UNATTRIBUTED_MODULE = `import { jsx, jsxs } from 'react/jsx-runtime';
import { T, Derive, useGT, derive } from 'gt-react';
export function Page() {
  const gt = useGT();
  const a = gt("Book", { $context: derive(getMeaning()) });
  const b = gt("Kept {x}", { x: 1 });
  const c = gt("Mine", { $_hash: "custom" });
  return jsxs(T, { children: ["Hello ", jsx(Derive, { children: getName() })] });
}`;

describe('unattributed entries', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keep their source text in client output', async () => {
    const code = withoutPlaceholder((await transform(UNATTRIBUTED_MODULE))!);

    expect(code).toContain('gt("Book"');
    expect(code).toContain('gt("Mine"');
    expect(code).toContain('"Hello "');
    expect(code).not.toContain('Kept');
  });

  it('are listed in one build warning with file, line and reason', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const plugin = createPlugin();
    await runTransform(
      plugin,
      UNATTRIBUTED_MODULE,
      CLIENT_BUILD,
      '/app/src/page.tsx'
    );
    await runTransform(
      plugin,
      `import { msg } from 'gt-next';
export const a = msg("Next");`,
      CLIENT_BUILD,
      '/app/src/next.ts'
    );
    await buildEnd(plugin, CLIENT_BUILD);

    expect(warn).toHaveBeenCalledTimes(1);
    const [message] = warn.mock.calls[0] as [string];
    expect(message).toMatch(
      /^@generaltranslation\/compiler Warning: 4 translation entries/
    );
    expect(message).toContain('/app/src/page.tsx:5:13 gt(): uses derive()');
    expect(message).toContain('/app/src/page.tsx:7:13 gt(): has a custom hash');
    expect(message).toContain('/app/src/page.tsx:8:10 <T>: uses derive()');
    expect(message).toContain(
      '/app/src/next.ts:2:18 msg(): its GT import source'
    );
    expect(message).not.toContain('Kept');

    // Reported once per build
    await buildEnd(plugin, CLIENT_BUILD);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('include tagged templates the macro transform left in place', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const plugin = createPlugin({ ...TWINS, enableMacroTransform: false });
    const code = await runTransform(
      plugin,
      `import { t, msg } from 'gt-react';
export const a = t\`Tagged\`;
export const b = msg("Plain");`,
      CLIENT_BUILD,
      '/app/src/tagged.ts'
    );
    await buildEnd(plugin, CLIENT_BUILD);

    expect(withoutPlaceholder(code!)).toContain('Tagged');
    expect(withoutPlaceholder(code!)).not.toContain('Plain');
    const [message] = warn.mock.calls[0] as [string];
    expect(message).toContain(
      '/app/src/tagged.ts:2:18 t(): is a tagged template the macro transform did not expand'
    );
  });

  it('locate a <T> inserted by auto JSX injection by its first child', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const plugin = createPlugin({
      ...TWINS,
      gtConfig: {
        ...TWINS.gtConfig,
        files: {
          gt: {
            ...TWINS.gtConfig!.files!.gt!,
            parsingFlags: { enableAutoJsxInjection: true },
          },
        },
      },
    });
    await runTransform(
      plugin,
      `import { jsx, jsxs } from 'react/jsx-runtime';
import { Derive } from 'gt-react';
export const el = jsxs("div", { children: ["Hello ", jsx(Derive, { children: getName() })] });`,
      CLIENT_BUILD,
      '/app/src/auto.tsx'
    );
    await buildEnd(plugin, CLIENT_BUILD);

    const [message] = warn.mock.calls[0] as [string];
    expect(message).toContain('/app/src/auto.tsx:3:43 <T>: uses derive()');
  });

  it.each([
    ['the server environment', SERVER_BUILD],
    ['vite dev', CLIENT_DEV],
  ])('are not reported in %s', async (_name, environment) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const plugin = createPlugin();
    await runTransform(plugin, UNATTRIBUTED_MODULE, environment);
    await buildEnd(plugin, environment);

    expect(warn).not.toHaveBeenCalled();
  });

  it('respects a silent log level', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const plugin = createPlugin({ ...TWINS, logLevel: 'silent' });
    await runTransform(plugin, UNATTRIBUTED_MODULE, CLIENT_BUILD);
    await buildEnd(plugin, CLIENT_BUILD);

    expect(warn).not.toHaveBeenCalled();
  });
});
