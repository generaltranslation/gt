/**
 * With the `'locale-twins'` translation splitting strategy, every module with
 * attributed entries gets one registration call carrying an unfilled locale
 * twin placeholder (hashes + source-locale content), imported from the GT
 * import source the module already uses.
 */
import { describe, expect, it } from 'vitest';
import type {
  TransformResult,
  UnpluginBuildContext,
  UnpluginContext,
} from 'unplugin';
import { findLocaleTwinPlaceholders } from 'generaltranslation/internal';
import { hashSource } from 'generaltranslation/id';
import gtUnplugin, { type GTUnpluginOptions } from '../index';

const TWINS: GTUnpluginOptions = {
  logLevel: 'silent',
  gtConfig: {
    defaultLocale: 'en',
    files: {
      gt: { output: 'src/_gt/[locale].json', splitting: 'locale-twins' },
    },
  },
};

function createTestContext(): UnpluginBuildContext & UnpluginContext {
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
  } as UnpluginBuildContext & UnpluginContext;
}

async function transform(
  code: string,
  options: GTUnpluginOptions = TWINS,
  id = '/src/page.tsx'
): Promise<string | null> {
  const plugin = gtUnplugin.raw(options, { framework: 'vite' });
  const hook = plugin.transform;
  if (typeof hook !== 'function') {
    throw new Error('Expected transform hook to be a function');
  }
  const result: TransformResult = await hook.call(
    createTestContext(),
    code,
    id
  );
  if (result == null) return null;
  return typeof result === 'string' ? result : result.code;
}

function jsxHash(source: unknown, extra: { context?: string } = {}): string {
  return hashSource({
    source: source as string,
    ...extra,
    dataFormat: 'JSX',
  });
}

function icuHash(
  source: string,
  extra: { context?: string; maxChars?: number } = {}
): string {
  return hashSource({ source, ...extra, dataFormat: 'ICU' });
}

const T_MODULE = `import { jsx } from 'react/jsx-runtime';
import { T } from 'gt-react';
export const el = jsx(T, { children: "Hello world" });`;

describe('locale twins registration call', () => {
  it('registers the module entries with a placeholder imported from the module GT source', async () => {
    const code = (await transform(T_MODULE))!;

    expect(code).toMatch(
      /import \{ GtInternalRegisterLocaleTwin(?: as \w+)? \} from ['"]gt-react['"];/
    );
    const placeholders = findLocaleTwinPlaceholders(code);
    expect(placeholders).toHaveLength(1);
    expect(placeholders[0].entries).toEqual({
      [jsxHash('Hello world')]: 'Hello world',
    });
  });

  it('goes after the directive prologue and the leading imports, before the module body', async () => {
    const code = (await transform(`'use client';
import { jsx } from 'react/jsx-runtime';
import { T } from 'gt-react';
import { helper } from './helper';
const before = helper();
export const el = jsx(T, { children: "Hello world" });`))!;

    // Statement order in the generated code (retainLines may put several
    // statements on one line)
    expect(code.startsWith("'use client';")).toBe(true);
    const lastImport = code.indexOf("from './helper';");
    const registration = code.search(
      /import \{ GtInternalRegisterLocaleTwin as (\w+) \} from "gt-react";\s*\1\("__GT_LOCALE_TWIN__:/
    );
    const body = code.indexOf('const before');
    expect(lastImport).toBeGreaterThan(-1);
    expect(registration).toBeGreaterThan(lastImport);
    expect(body).toBeGreaterThan(registration);
  });

  it('avoids clashing with a local binding of the same name', async () => {
    const code = (await transform(`import { jsx } from 'react/jsx-runtime';
import { T } from 'gt-react';
const _GtInternalRegisterLocaleTwin = 1;
export const el = jsx(T, { children: "Hello world" });`))!;

    expect(code).toMatch(
      /import \{ GtInternalRegisterLocaleTwin as (_GtInternalRegisterLocaleTwin\d+) \} from "gt-react";\s*\1\(/
    );
  });

  it.each([
    ['gt-react', 'gt-react'],
    ['gt-tanstack-start', 'gt-tanstack-start'],
    ['gt-react/browser', 'gt-react/browser'],
    ['gt-i18n', 'gt-i18n/internal'],
  ])('imports from %s as %s', async (source, expected) => {
    const code = (await transform(`import { msg } from '${source}';
export const a = msg("Plain");`))!;

    expect(code).toContain(`} from "${expected}";`);
    expect(findLocaleTwinPlaceholders(code)).toHaveLength(1);
  });

  it('skips modules whose GT source has no registration export', async () => {
    const code = await transform(`import { msg } from 'gt-next';
export const a = msg("Plain");`);

    expect(code ?? '').not.toContain('GtInternalRegisterLocaleTwin');
    expect(code ?? '').not.toContain('$_hash');
  });

  it('registers modules whose <T> was inserted by auto JSX injection', async () => {
    const code = (await transform(
      `import { jsx } from 'react/jsx-runtime';
export const el = jsx("div", { children: "Hello world" });`,
      {
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
      }
    ))!;

    expect(code).toMatch(
      /import \{ GtInternalRegisterLocaleTwin as \w+ \} from "gt-react";/
    );
    expect(findLocaleTwinPlaceholders(code)[0].entries).toEqual({
      [jsxHash('Hello world')]: 'Hello world',
    });
  });

  it('emits the same registration in the server environment', async () => {
    const plugin = gtUnplugin.raw(TWINS, { framework: 'vite' });
    const hook = plugin.transform as (
      this: unknown,
      code: string,
      id: string,
      options?: { ssr?: boolean }
    ) => Promise<TransformResult>;
    const server = await hook.call(
      {
        ...createTestContext(),
        environment: { name: 'ssr', config: { consumer: 'server' } },
      },
      T_MODULE,
      '/src/page.tsx',
      { ssr: true }
    );
    const serverCode = typeof server === 'string' ? server : server!.code;

    expect(serverCode).toBe(await transform(T_MODULE));
  });
});

describe('locale twins attribution', () => {
  it('is inert with the default splitting strategy', async () => {
    const code = (await transform(T_MODULE, {
      logLevel: 'silent',
      gtConfig: {},
    }))!;

    expect(code).not.toContain('GtInternalRegisterLocaleTwin');
    expect(findLocaleTwinPlaceholders(code)).toEqual([]);
  });

  it('attributes every API once, with sorted, de-duplicated hashes', async () => {
    const code = (await transform(`import { jsx } from 'react/jsx-runtime';
import { T, useGT, msg, t } from 'gt-react';
export const greeting = msg("Hello {name}", { $context: "greeting" });
export const farewell = msg("Goodbye");
export function Page() {
  const gt = useGT();
  const a = gt("Save");
  const b = gt("Save");
  const c = t("Cancel", { $maxChars: 10 });
  return jsx(T, { context: "nav", children: "Home" });
}`))!;

    const placeholders = findLocaleTwinPlaceholders(code);
    expect(placeholders).toHaveLength(1);
    const expected = {
      [icuHash('Hello {name}', { context: 'greeting' })]: 'Hello {name}',
      [icuHash('Goodbye')]: 'Goodbye',
      [icuHash('Save')]: 'Save',
      [icuHash('Cancel', { maxChars: 10 })]: 'Cancel',
      [jsxHash('Home', { context: 'nav' })]: 'Home',
    };
    expect(placeholders[0].entries).toEqual(expected);
    expect(placeholders[0].hashes).toEqual(Object.keys(expected).sort());
  });

  it('records JSX source as minified children with elements and variables', async () => {
    const code =
      (await transform(`import { jsx, jsxs } from 'react/jsx-runtime';
import { T, Var } from 'gt-react';
export const el = jsxs(T, { children: ["Hi ", jsx("b", { children: "there" }), jsx(Var, { children: name })] });`))!;

    const [placeholder] = findLocaleTwinPlaceholders(code);
    expect(Object.values(placeholder.entries)).toEqual([
      ['Hi ', { c: 'there', i: 1, t: 'b' }, { i: 2, k: '_gt_value_2', v: 'v' }],
    ]);
  });

  it('leaves entries the compiler cannot hash unattributed', async () => {
    const code = (await transform(`import { jsx } from 'react/jsx-runtime';
import { T, useGT, derive } from 'gt-react';
export function Page() {
  const gt = useGT();
  const a = gt("Book", { $context: derive(getMeaning()) });
  const b = gt("Kept");
  return jsx(T, { children: "Static" });
}`))!;

    const [placeholder] = findLocaleTwinPlaceholders(code);
    expect(placeholder.entries).toEqual({
      [icuHash('Kept')]: 'Kept',
      [jsxHash('Static')]: 'Static',
    });
  });

  it('injects $_hash into msg() calls, keeping a user-supplied one', async () => {
    const userHash = 'aaaaaaaaaaaaaaaa';
    const code = (await transform(`import { msg } from 'gt-react';
export const a = msg("Plain");
export const b = msg("Ctx", { $context: "c" });
export const c = msg("Mine", { $_hash: "${userHash}" });`))!;

    expect(code).toContain(`msg("Plain", { "$_hash": "${icuHash('Plain')}" })`);
    expect(code).toContain(
      `msg("Ctx", { $context: "c", "$_hash": "${icuHash('Ctx', { context: 'c' })}" })`
    );
    expect(code).toContain(`msg("Mine", { $_hash: "${userHash}" })`);
    expect(findLocaleTwinPlaceholders(code)[0].entries[userHash]).toBe('Mine');
  });

  it('does not inject $_hash into msg() with the default splitting strategy', async () => {
    const code = await transform(
      `import { msg } from 'gt-react';
export const a = msg("Plain");`,
      { logLevel: 'silent', gtConfig: {} }
    );

    expect(code ?? '').not.toContain('$_hash');
  });

  it('inserts nothing for a module without entries', async () => {
    expect(
      await transform(`import { useLocale } from 'gt-react';
export const useIt = () => useLocale();`)
    ).toBeNull();
  });
});
