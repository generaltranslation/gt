// @vitest-environment jsdom
/**
 * End to end at the runtime level: a module compiled by the real GT compiler
 * for a locale twin client build (source text stripped, one placeholder), its
 * placeholder filled with a locale's table the way the post-build step does,
 * evaluated (which registers the twin), then rendered with React.
 */
import React from 'react';
import * as ReactJsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createRequire } from 'node:module';
import {
  findLocaleTwinPlaceholders,
  serializeLocaleTwinTable,
} from 'generaltranslation/internal';
import type { LocaleTwinEntries } from 'generaltranslation/internal';
import { hashSource } from 'generaltranslation/id';
import * as GTReact from '../index.client';
import { initializeGTSPA } from '../setup/initializeGTSPA';

type TestGlobal = typeof globalThis & { __generaltranslation?: unknown };

const GT_CONFIG = {
  defaultLocale: 'en',
  locales: ['en', 'fr'],
  files: {
    gt: {
      output: 'src/_gt/[locale].json',
      splitting: 'locale-twins' as const,
    },
  },
};

/** A page as Vite hands it to the GT compiler (JSX already compiled). */
const PAGE_SOURCE = `import { jsx, jsxs } from 'react/jsx-runtime';
import { T, Var, useGT, msg, useMessages, t } from 'gt-react';
const greeting = msg("Hello {name}", { name: "Ada" });
export function Page({ name }) {
  const gt = useGT();
  const m = useMessages();
  return jsxs("main", { children: [
    jsxs(T, { children: ["Hi ", jsx("b", { className: "x", children: "there" }), jsx(Var, { children: name }), jsx("input", { placeholder: "Your name" })] }),
    jsx("p", { children: gt("Save {count} items", { count: 3 }) }),
    jsx("p", { children: m(greeting) }),
    jsx("p", { children: t("Cancel") }),
  ] });
}`;

/** French translations, keyed by source (as `fr.json` would be by hash). */
const FRENCH: Record<string, unknown> = {
  [JSON.stringify([
    'Hi ',
    { t: 'b', i: 1, c: 'there' },
    { i: 2, k: '_gt_value_2', v: 'v' },
    { t: 'input', i: 3, d: { pl: 'Your name' } },
  ])]: [
    'Salut ',
    { t: 'b', i: 1, c: 'toi' },
    ' ',
    { i: 2, k: '_gt_value_2', v: 'v' },
    { t: 'input', i: 3, d: { pl: 'Votre nom' } },
  ],
  [JSON.stringify('Save {count} items')]: 'Enregistrer {count} éléments',
  [JSON.stringify('Hello {name}')]: 'Bonjour {name}',
  [JSON.stringify('Cancel')]: 'Annuler',
};

// The compiler ships CommonJS; load it natively instead of through Vite.
const compiler = createRequire(import.meta.url)(
  '@generaltranslation/compiler'
) as typeof import('@generaltranslation/compiler');

let strippedCode: string;
let sourceEntries: LocaleTwinEntries;

async function compileForClientBuild(code: string): Promise<string> {
  const plugin = compiler.default.raw(
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
      name: 'client',
      mode: 'build',
      config: { consumer: 'client' },
    },
  };
  const transform = (plugin as { transform?: unknown }).transform as (
    this: unknown,
    code: string,
    id: string,
    options: { ssr: boolean }
  ) => Promise<string | { code: string }>;
  const result = await transform.call(context, code, '/src/page.tsx', {
    ssr: false,
  });
  return typeof result === 'string' ? result : result.code;
}

/** Replaces the placeholder token like the twin generator does. */
function fillPlaceholder(code: string, locale: string): string {
  const [match] = findLocaleTwinPlaceholders(code);
  const entries: LocaleTwinEntries = {};
  for (const [hash, source] of Object.entries(match.entries)) {
    entries[hash] =
      locale === GT_CONFIG.defaultLocale
        ? source
        : (FRENCH[JSON.stringify(source)] as LocaleTwinEntries[string]);
  }
  return (
    code.slice(0, match.start) +
    serializeLocaleTwinTable({ l: locale, e: entries }) +
    code.slice(match.end)
  );
}

/**
 * Evaluates the compiled ES module with its imports bound to this test's
 * modules (static `import { a as b } from 'x'` and `export function`).
 */
function evaluateModule(code: string): { Page: React.FC<{ name: string }> } {
  const modules: Record<string, unknown> = {
    'react/jsx-runtime': ReactJsxRuntime,
    'gt-react': GTReact,
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
  return exports as { Page: React.FC<{ name: string }> };
}

async function renderPage(locale: string): Promise<string> {
  const { Page } = evaluateModule(fillPlaceholder(strippedCode, locale));
  await initializeGTSPA({ ...GT_CONFIG, locale });
  return renderToStaticMarkup(<Page name='Ada' />);
}

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

describe('locale twins end to end', () => {
  beforeAll(async () => {
    strippedCode = await compileForClientBuild(PAGE_SOURCE);
    sourceEntries = findLocaleTwinPlaceholders(strippedCode)[0].entries;
  });

  beforeEach(resetGTGlobals);
  afterEach(() => {
    resetGTGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('compiles a client build without source text outside the placeholder', () => {
    const [match] = findLocaleTwinPlaceholders(strippedCode);
    const code = strippedCode.replace(match.token, '""');

    for (const text of [
      'Hi',
      'there',
      'Your name',
      'Save',
      'Hello',
      'Cancel',
    ]) {
      expect(code).not.toContain(text);
    }
    expect(Object.keys(sourceEntries)).toHaveLength(4);
  });

  it('renders the source locale from its twin', async () => {
    const html = await renderPage('en');

    expect(html).toBe(
      '<main>Hi <b class="x">there</b>Ada<input placeholder="Your name"/>' +
        '<p>Save 3 items</p><p>Hello Ada</p><p>Cancel</p></main>'
    );
  });

  it('renders a target locale from its twin', async () => {
    const html = await renderPage('fr');

    expect(html).toBe(
      '<main>Salut <b class="x">toi</b> Ada<input placeholder="Votre nom"/>' +
        '<p>Enregistrer 3 éléments</p><p>Bonjour Ada</p><p>Annuler</p></main>'
    );
  });

  it('reports serving the original (untwinned) chunk', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { Page } = evaluateModule(strippedCode);
    await initializeGTSPA({ ...GT_CONFIG, locale: 'fr' });

    renderToStaticMarkup(<Page name='Ada' />);

    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toContain('no locale twin was registered');
  });

  it('reports a twin whose locale differs from the rendered locale', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { Page } = evaluateModule(fillPlaceholder(strippedCode, 'fr'));
    await initializeGTSPA({ ...GT_CONFIG, locale: 'en' });

    renderToStaticMarkup(<Page name='Ada' />);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain(
      'loaded locale twins for "fr", but GT is rendering "en"'
    );
  });

  it('reports a build without the compiler plugin instead of rendering source silently', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    // The same page, untouched by the compiler: no hashes, no placeholder
    const { Page } = evaluateModule(PAGE_SOURCE);
    await initializeGTSPA({ ...GT_CONFIG, locale: 'fr' });

    const html = renderToStaticMarkup(<Page name='Ada' />);

    expect(html).toContain('Save 3 items');
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toMatch(
      /no locale twin was registered.*compiler plugin/s
    );
  });

  it('translates dictionary entries from the whole locale (dictionaries stay on locale loading)', async () => {
    const titleHash = hashSource({ source: 'Harbor guide', dataFormat: 'ICU' });
    const loadTranslations = vi.fn(async () => ({
      [titleHash]: 'Guide du port',
    }));
    function Title() {
      const t = GTReact.useTranslations();
      return <h1>{t('title')}</h1>;
    }
    await initializeGTSPA({
      ...GT_CONFIG,
      locale: 'fr',
      dictionary: { title: 'Harbor guide' },
      loadTranslations,
    });

    const html = renderToStaticMarkup(<Title />);

    expect(loadTranslations).toHaveBeenCalledWith('fr');
    expect(html).toBe('<h1>Guide du port</h1>');
  });

  it('translates content without a compile-time hash as usual in dev builds', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const noticeHash = hashSource({ source: 'Notice', dataFormat: 'ICU' });
    const loadTranslations = vi.fn(async () => ({ [noticeHash]: 'Avis' }));
    function Notice() {
      const gt = GTReact.useGT();
      return <p>{gt('Notice')}</p>;
    }
    await initializeGTSPA({ ...GT_CONFIG, locale: 'fr', loadTranslations });

    expect(renderToStaticMarkup(<Notice />)).toBe('<p>Avis</p>');
  });

  it('never loads translations or calls the CDN', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const loadTranslations = vi.fn(() => new Promise<never>(() => {}));
    const { Page } = evaluateModule(fillPlaceholder(strippedCode, 'fr'));

    // initializeGTSPA must not wait for a whole-locale load
    await initializeGTSPA({
      ...GT_CONFIG,
      locale: 'fr',
      projectId: 'project-id',
      loadTranslations,
    });
    renderToStaticMarkup(<Page name='Ada' />);

    expect(loadTranslations).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
