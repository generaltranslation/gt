// @vitest-environment jsdom
/**
 * Server-rendered HTML must hydrate: a page compiled by the real GT compiler
 * renders the same markup on the server (the server build: source text kept,
 * unfilled placeholder, whole-locale translations) as on a locale twin client
 * (the client build: source text stripped, placeholder filled with the
 * locale's twin).
 */
import React from 'react';
import * as ReactJsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import {
  findLocaleTwinPlaceholders,
  serializeLocaleTwinTable,
} from 'generaltranslation/internal/experimental';
import type { LocaleTwinEntries } from 'generaltranslation/internal/experimental';
import { hashSource } from 'generaltranslation/id';
import { getTranslationsSnapshot } from '@generaltranslation/react-core/pure';
import * as GTReact from '../index.client';
import { initializeGTSRA } from '../setup/initializeGTSRA';
import { ServerGTProvider } from '../provider/ServerGTProvider';

type TestGlobal = typeof globalThis & { __generaltranslation?: unknown };
type Page = React.FC<Record<string, never>>;

const GT_CONFIG = {
  defaultLocale: 'en',
  locales: ['en', 'fr'],
  files: { gt: { output: 'src/_gt/[locale].json' } },
  experimental: { splitting: 'locale-twins' as const },
};

// The compiler ships CommonJS; load it natively instead of through Vite.
const compiler = createRequire(import.meta.url)(
  '@generaltranslation/compiler/experimental'
) as typeof import('@generaltranslation/compiler/experimental');

async function compile(
  code: string,
  consumer: 'client' | 'server'
): Promise<string> {
  const plugin = compiler.unplugin.raw(
    { logLevel: 'silent', gtConfig: GT_CONFIG },
    { framework: 'vite' }
  );
  const context = {
    addWatchFile() {},
    emitFile() {},
    getWatchFiles: () => [],
    warn() {},
    error(message: unknown) {
      throw new Error(String(message));
    },
    environment: {
      name: consumer === 'client' ? 'client' : 'ssr',
      mode: 'build',
      config: { consumer },
    },
  };
  const transform = (plugin as { transform?: unknown }).transform as (
    this: unknown,
    code: string,
    id: string,
    options: { ssr: boolean }
  ) => Promise<string | { code: string }>;
  const result = await transform.call(context, code, '/src/page.tsx', {
    ssr: consumer === 'server',
  });
  return typeof result === 'string' ? result : result.code;
}

/** Evaluates a compiled ES module with its imports bound to this test's. */
function evaluatePage(code: string): Page {
  const modules: Record<string, unknown> = {
    'react/jsx-runtime': ReactJsxRuntime,
    'gt-react/experimental': GTReact,
  };
  const body = code
    .replace(
      /import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["'];?/g,
      (_, names: string, source: string) =>
        `const {${names.replace(/\s+as\s+/g, ': ')}} = __modules[${JSON.stringify(source)}];`
    )
    .replace(/export function (\w+)/g, '__exports.$1 = $1; function $1');
  const exports: Record<string, unknown> = {};
  new Function('__modules', '__exports', body)(modules, exports);
  return exports.Page as Page;
}

/** Resets GT, keeping the React context the provider modules captured. */
function resetGTGlobals() {
  const globals = (globalThis as TestGlobal).__generaltranslation as
    | Record<string, unknown>
    | undefined;
  for (const key of Object.keys(globals ?? {})) {
    if (key !== 'reactCore') Reflect.deleteProperty(globals!, key);
  }
}

/**
 * The server: no browser globals, the server build, and the whole French
 * locale (`translations`, keyed by hash) in its cache.
 */
async function renderOnServer(
  source: string,
  translations: Record<string, unknown>
): Promise<string> {
  vi.stubGlobal('window', undefined);
  vi.stubGlobal('document', undefined);
  try {
    const Page = evaluatePage(await compile(source, 'server'));
    initializeGTSRA({
      ...GT_CONFIG,
      loadTranslations: async (locale: string) =>
        locale === 'fr' ? translations : {},
    });
    await getTranslationsSnapshot('fr');
    return renderToStaticMarkup(
      <ServerGTProvider locale='fr'>
        <Page />
      </ServerGTProvider>
    );
  } finally {
    vi.unstubAllGlobals();
  }
}

/**
 * A locale twin client: the client build with its placeholder filled with
 * the French twin, taken from the same whole-locale translations.
 */
async function renderOnClient(
  source: string,
  translations: Record<string, unknown>
): Promise<string> {
  const code = await compile(source, 'client');
  // A module without attributed entries has no placeholder
  const [match] = findLocaleTwinPlaceholders(code);
  const entries: LocaleTwinEntries = {};
  for (const hash of match?.hashes ?? []) {
    entries[hash] = translations[hash] as LocaleTwinEntries[string];
  }
  const Page = evaluatePage(
    match
      ? code.slice(0, match.start) +
          serializeLocaleTwinTable({ l: 'fr', e: entries }) +
          code.slice(match.end)
      : code
  );
  await GTReact.initializeGTSPA({ ...GT_CONFIG, locale: 'fr' });
  return renderToStaticMarkup(<Page />);
}

async function renderBothSides(
  source: string,
  translations: Record<string, unknown>
): Promise<{ server: string; client: string }> {
  const server = await renderOnServer(source, translations);
  resetGTGlobals();
  const client = await renderOnClient(source, translations);
  return { server, client };
}

describe('locale twins server and client rendering', () => {
  beforeEach(resetGTGlobals);
  afterEach(() => {
    resetGTGlobals();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('applies translated props of a childless element on both sides', async () => {
    const children = [{ t: 'input', i: 1, d: { pl: 'Your name' } }];
    const { server, client } = await renderBothSides(
      `import { jsx } from 'react/jsx-runtime';
import { T } from 'gt-react/experimental';
export function Page() {
  return jsx(T, { children: jsx("input", { placeholder: "Your name" }) });
}`,
      {
        [hashSource({ source: children[0], dataFormat: 'JSX' })]: {
          t: 'input',
          i: 1,
          d: { pl: 'Votre nom' },
        },
      }
    );

    expect(client).toBe('<input placeholder="Votre nom"/>');
    expect(server).toBe(client);
  });

  // A derived $context leaves msg() unattributed: the regular msg() encodes
  // a hash computed at runtime, which no twin carries
  it('renders an unattributed msg() as source with useMessages() on both sides', async () => {
    const { server, client } = await renderBothSides(
      `import { jsx } from 'react/jsx-runtime';
import { msg, derive, useMessages } from 'gt-react/experimental';
const getContext = () => 'greeting';
const greeting = msg("Hello {name}", { name: "Ada", $context: derive(getContext()) });
export function Page() {
  const m = useMessages();
  return jsx("p", { children: m(greeting) });
}`,
      {
        [hashSource({
          source: 'Hello {name}',
          context: 'greeting',
          dataFormat: 'ICU',
        })]: 'Bonjour {name}',
      }
    );

    expect(server).toBe('<p>Hello Ada</p>');
    expect(client).toBe(server);
  });
});
