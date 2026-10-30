/**
 * With the `'locale-twins'` translation splitting strategy, client production
 * builds give every attributed call site an unfilled placeholder (its hash
 * and source content) as the `$_twin` option or `_twin` prop, which the twin
 * generator fills per locale. Every production build marks the entries the
 * compiler cannot attribute with `0`, so server and client render them alike.
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

type Environment = {
  name: string;
  mode: 'build';
  config: { consumer: string };
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

function createTestContext(
  environment: Environment
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
    environment,
  } as UnpluginBuildContext & UnpluginContext;
}

async function transform(
  code: string,
  {
    environment = CLIENT_BUILD,
    options = TWINS,
  }: { environment?: Environment; options?: GTUnpluginOptions } = {}
): Promise<string | null> {
  const plugin = gtUnplugin.raw(options, { framework: 'vite' });
  const hook = plugin.transform as (
    this: unknown,
    code: string,
    id: string,
    options?: { ssr?: boolean }
  ) => Promise<TransformResult>;
  const result = await hook.call(
    createTestContext(environment),
    code,
    '/src/page.tsx',
    { ssr: environment.config.consumer === 'server' }
  );
  if (result == null) return null;
  return typeof result === 'string' ? result : result.code;
}

/** Removes whitespace so assertions don't depend on Babel's line layout. */
function squash(code: string): string {
  return code.replace(/\s+/g, '');
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

/** Each placeholder's hash and source, in code order. */
function placeholderEntries(code: string) {
  return findLocaleTwinPlaceholders(code).map(({ hash, source }) => ({
    hash,
    source,
  }));
}

const T_MODULE = `import { jsx } from 'react/jsx-runtime';
import { T } from 'gt-react';
export const el = jsx(T, { children: "Hello world" });`;

const UNATTRIBUTED_MODULE = `import { jsx, jsxs } from 'react/jsx-runtime';
import { T, Derive, useGT, derive } from 'gt-react';
export function Page() {
  const gt = useGT();
  const a = gt("Book", { $context: derive(getMeaning()) });
  const c = gt("Mine", { $_hash: "custom" });
  return jsxs(T, { children: ["Hello ", jsx(Derive, { children: getName() })] });
}`;

describe('locale twin placeholders (client production builds)', () => {
  it('gives <T> a _twin placeholder prop with its hash and source', async () => {
    const code = (await transform(T_MODULE))!;
    const [placeholder] = findLocaleTwinPlaceholders(code);

    expect(squash(code)).toContain(
      squash(
        `jsx(T, { children: "", _hash: "${jsxHash('Hello world')}", _twin: ${placeholder.token} })`
      )
    );
    expect(placeholderEntries(code)).toEqual([
      { hash: jsxHash('Hello world'), source: 'Hello world' },
    ]);
  });

  it('inserts no import and no registration call', async () => {
    const code = (await transform(T_MODULE))!;

    expect(code).not.toContain('RegisterLocaleTwin');
    expect(code.match(/^import /gm)).toHaveLength(2);
  });

  it('gives every call site of every API its own placeholder', async () => {
    const code = (await transform(`import { jsx } from 'react/jsx-runtime';
import { T, useGT, msg, t } from 'gt-react';
export const greeting = msg("Hello {name}", { $context: "greeting" });
export const farewell = msg("Goodbye");
export function Page() {
  const gt = useGT();
  const a = gt("Save");
  const b = gt("Save", options);
  const c = t("Cancel", { $maxChars: 10 });
  return jsx(T, { context: "nav", children: "Home" });
}`))!;

    expect(placeholderEntries(code)).toEqual([
      {
        hash: icuHash('Hello {name}', { context: 'greeting' }),
        source: 'Hello {name}',
      },
      { hash: icuHash('Goodbye'), source: 'Goodbye' },
      { hash: icuHash('Save'), source: 'Save' },
      { hash: icuHash('Save'), source: 'Save' },
      { hash: icuHash('Cancel', { maxChars: 10 }), source: 'Cancel' },
      { hash: jsxHash('Home', { context: 'nav' }), source: 'Home' },
    ]);
    const tokens = findLocaleTwinPlaceholders(code).map((m) => m.token);
    const out = squash(code);
    expect(out).toContain(
      squash(`msg("", { $context: "greeting", $_twin: ${tokens[0]} })`)
    );
    expect(out).toContain(squash(`msg("", { $_twin: ${tokens[1]} })`));
    expect(out).toContain(
      squash(`gt("", { "$_hash": "${icuHash('Save')}", $_twin: ${tokens[2]} })`)
    );
    expect(out).toContain(
      squash(
        `gt("", { ...options, "$_hash": "${icuHash('Save')}", $_twin: ${tokens[3]} })`
      )
    );
  });

  it('records JSX source as minified children with elements and variables', async () => {
    const code =
      (await transform(`import { jsx, jsxs } from 'react/jsx-runtime';
import { T, Var } from 'gt-react';
export const el = jsxs(T, { children: ["Hi ", jsx("b", { children: "there" }), jsx(Var, { children: name })] });`))!;

    expect(placeholderEntries(code).map(({ source }) => source)).toEqual([
      ['Hi ', { c: 'there', i: 1, t: 'b' }, { i: 2, k: '_gt_value_2', v: 'v' }],
    ]);
  });

  it('gives a <T> inserted by auto JSX injection a placeholder', async () => {
    const code = (await transform(
      `import { jsx } from 'react/jsx-runtime';
export const el = jsx("div", { children: "Hello world" });`,
      {
        options: {
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
        },
      }
    ))!;

    expect(placeholderEntries(code)).toEqual([
      { hash: jsxHash('Hello world'), source: 'Hello world' },
    ]);
  });

  it('keeps the marker a call site already has (recompiled output)', async () => {
    const once = (await transform(T_MODULE))!;
    const twice = (await transform(once))!;

    expect(findLocaleTwinPlaceholders(twice).map((m) => m.token)).toEqual(
      findLocaleTwinPlaceholders(once).map((m) => m.token)
    );
  });
});

describe('locale twin source markers', () => {
  it.each([
    ['client', CLIENT_BUILD],
    ['server', SERVER_BUILD],
  ])(
    'mark entries the compiler cannot attribute with 0 and keep their text (%s build)',
    async (_name, environment) => {
      const out = squash(
        (await transform(UNATTRIBUTED_MODULE, { environment }))!
      );

      expect(out).toMatch(
        /gt\("Book",\{\$context:derive\(getMeaning\(\)\),\$_twin:0\}\)/
      );
      expect(out).toContain(
        squash(`gt("Mine", { $_hash: "custom", $_twin: 0 })`)
      );
      expect(out).toMatch(
        /children:\["Hello",jsx\(Derive,\{children:getName\(\)\}\)\],_twin:0\}\)/
      );
    }
  );

  it('are the same in client and server builds', async () => {
    const markers = (code: string) => code.match(/_twin: 0/g)?.length;
    const client = (await transform(UNATTRIBUTED_MODULE))!;
    const server = (await transform(UNATTRIBUTED_MODULE, {
      environment: SERVER_BUILD,
    }))!;

    expect(markers(client)).toBe(3);
    expect(markers(server)).toBe(3);
  });
});

describe('server production builds', () => {
  it('keep source text and add no placeholders or msg() hashes', async () => {
    const code = (await transform(
      `import { jsx } from 'react/jsx-runtime';
import { T, msg } from 'gt-react';
export const a = msg("Plain");
export const el = jsx(T, { children: "Hello world" });`,
      { environment: SERVER_BUILD }
    ))!;

    expect(findLocaleTwinPlaceholders(code)).toEqual([]);
    expect(code).not.toContain('_twin');
    expect(code).toContain('msg("Plain")');
    expect(code).toContain('"Hello world"');
  });
});

describe('locale twins pass scope', () => {
  it('is inert with the default splitting strategy', async () => {
    const code = (await transform(UNATTRIBUTED_MODULE, {
      options: { logLevel: 'silent', gtConfig: {} },
    }))!;

    expect(code).not.toContain('_twin');
  });

  it('skips modules whose GT source does not support locale twins', async () => {
    const code = await transform(`import { msg } from 'gt-next';
export const a = msg("Plain");`);

    expect(code ?? '').not.toContain('_twin');
    expect(code ?? '').toContain('"Plain"');
  });

  it.each(['gt-react', 'gt-tanstack-start', 'gt-react/browser', 'gt-i18n'])(
    'marks modules importing from %s',
    async (source) => {
      const code = (await transform(`import { msg } from '${source}';
export const a = msg("Plain");`))!;

      expect(placeholderEntries(code)).toEqual([
        { hash: icuHash('Plain'), source: 'Plain' },
      ]);
    }
  );

  it('changes nothing in a module without entries', async () => {
    expect(
      await transform(`import { useLocale } from 'gt-react';
export const useIt = () => useLocale();`)
    ).toBeNull();
  });
});
