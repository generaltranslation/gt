import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  hasPagesRouterLocaleRouting,
  setupPagesRouter,
  transformPagesRouterApp,
  transformPagesRouterPage,
} from '../setupPagesRouter.js';

const temporaryDirectories: string[] = [];
const originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('hasPagesRouterLocaleRouting', () => {
  it('confirms complete i18n routing in exported ESM and CommonJS configs', () => {
    expect(
      hasPagesRouterLocaleRouting(`
const i18n = { locales: ['en', 'es'], defaultLocale: 'en' };
const nextConfig = { reactStrictMode: true, i18n };
export default withGTConfig(nextConfig, {});
`)
    ).toBe(true);
    expect(
      hasPagesRouterLocaleRouting(`
module.exports = { i18n: { locales: ['en'], defaultLocale: 'en' } };
`)
    ).toBe(true);
  });

  it('rejects comments and incomplete or ambiguous i18n configs', () => {
    expect(
      hasPagesRouterLocaleRouting(`
// i18n: { locales: ['en'], defaultLocale: 'en' }
export default { reactStrictMode: true };
`)
    ).toBe(false);
    expect(
      hasPagesRouterLocaleRouting(
        `export default { i18n: { locales: ['en'] } };`
      )
    ).toBe(false);
    expect(
      hasPagesRouterLocaleRouting(`export default createConfig({ i18n });`)
    ).toBe(false);
  });
});

describe('transformPagesRouterApp', () => {
  it('wires gt-next provider props while preserving custom App code', () => {
    const source = `
import type { AppProps } from 'next/app';
import '../styles/globals.css';

type CustomPageProps = { theme: string };

export default function CustomApp({ Component, pageProps }: AppProps<CustomPageProps>) {
  return <main><Component {...pageProps} /></main>;
}
`;

    const result = transformPagesRouterApp(source, 'pages/_app.tsx');

    expect(result.warning).toBeUndefined();
    expect(result.modified).toBe(true);
    expect(result.code).toContain(
      'import { GTProvider, type WithGTServerSideProps } from "gt-next"'
    );
    expect(result.code).toContain(
      'AppProps<CustomPageProps & WithGTServerSideProps>'
    );
    expect(result.code).toContain(
      'const { locale, translations, ...restPageProps } = pageProps'
    );
    expect(result.code).toContain(
      '<GTProvider locale={locale} translations={translations}>'
    );
    expect(result.code).toContain('<Component {...restPageProps} />');
    expect(result.code).toContain('<main>');
    expect(result.code).toContain("import '../styles/globals.css'");
  });

  it('upgrades the legacy gt-react config-spread provider and is idempotent', () => {
    const source = `
import type { AppProps } from 'next/app';
import { GTProvider } from 'gt-react';
import gtConfig from '../gt.config.json';

export default function App({ Component, pageProps }: AppProps) {
  return <GTProvider {...gtConfig}><Component {...pageProps} /></GTProvider>;
}
`;

    const first = transformPagesRouterApp(source, 'pages/_app.tsx');
    const second = transformPagesRouterApp(first.code, 'pages/_app.tsx');

    expect(first.code).toContain('from "gt-next"');
    expect(first.code).not.toContain('gt-react');
    expect(first.code).not.toContain('gtConfig');
    expect(first.code).toContain('AppProps<WithGTServerSideProps>');
    expect(second.warning).toBeUndefined();
    expect(second.modified).toBe(false);
    expect(second.code).toBe(first.code);
  });

  it('returns actionable guidance for an unsupported custom App shape', () => {
    const source = `export default class App { render() { return null; } }`;

    const result = transformPagesRouterApp(source, 'pages/_app.tsx');

    expect(result.modified).toBe(false);
    expect(result.code).toBe(source);
    expect(result.warning).toContain('could not safely wire GTProvider');
    expect(result.warning).toContain('pages/_app');
    expect(result.warning).toContain('Learn more:');
  });

  it('preserves a custom App when the generated prop bindings would collide', () => {
    const source = `
export default function App({ Component, pageProps }) {
  const locale = 'application-locale';
  return <Component locale={locale} {...pageProps} />;
}
`;

    const result = transformPagesRouterApp(source, 'pages/_app.tsx');

    expect(result.modified).toBe(false);
    expect(result.code).toBe(source);
    expect(result.warning).toContain('already defines locale');
    expect(result.warning).toContain('could change application behavior');
  });
});

describe('transformPagesRouterPage', () => {
  it('adds server-side GT props to a page without data fetching', () => {
    const source = `export default function Home() { return <h1>Hello</h1>; }`;

    const first = transformPagesRouterPage(source, 'pages/index.tsx');
    const second = transformPagesRouterPage(first.code, 'pages/index.tsx');

    expect(first.code).toContain(
      'import { withGTServerSideProps } from "gt-next"'
    );
    expect(first.code).toContain(
      'export const getServerSideProps = withGTServerSideProps()'
    );
    expect(second.modified).toBe(false);
    expect(second.code).toBe(first.code);
  });

  it('aliases the generated helper import when the preferred name is taken', () => {
    const source = `
const withGTServerSideProps = 'application value';
export default function Home() { return <h1>{withGTServerSideProps}</h1>; }
`;

    const result = transformPagesRouterPage(source, 'pages/index.tsx');

    expect(result.warning).toBeUndefined();
    expect(result.code).toContain(
      'import { withGTServerSideProps as GTwithGTServerSideProps } from "gt-next"'
    );
    expect(result.code).toContain(
      'export const getServerSideProps = GTwithGTServerSideProps()'
    );
  });

  it('wraps an existing getServerSideProps without changing its body', () => {
    const source = `
import type { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async (context) => ({
  props: { slug: context.params?.slug ?? null },
});

export default function Page() { return null; }
`;

    const result = transformPagesRouterPage(source, 'pages/[slug].tsx');

    expect(result.warning).toBeUndefined();
    expect(result.code).toContain(
      'getServerSideProps: GetServerSideProps = withGTServerSideProps(async (context) => ({'
    );
    expect(result.code).toContain('slug: context.params?.slug ?? null');
  });

  it('wraps an existing getStaticProps with the static helper', () => {
    const source = `
export const getStaticProps = async () => ({ props: { built: true } });
export default function Page() { return null; }
`;

    const result = transformPagesRouterPage(source, 'pages/about.tsx', {
      hasStaticLocaleRouting: true,
    });

    expect(result.warning).toBeUndefined();
    expect(result.code).toContain(
      'import { withGTStaticProps } from "gt-next"'
    );
    expect(result.code).toContain(
      'getStaticProps = withGTStaticProps(async () => ({ props: { built: true } }))'
    );
  });

  it('preserves static props and explains locale routing when it is not configured', () => {
    const source = `
export const getStaticProps = async () => ({ props: { built: true } });
export default function Page() { return null; }
`;

    const result = transformPagesRouterPage(source, 'pages/about.tsx');

    expect(result.modified).toBe(false);
    expect(result.code).toBe(source);
    expect(result.warning).toContain(
      'requires Pages Router locale routing, which the wizard could not confirm'
    );
    expect(result.warning).toContain('withGTStaticProps');
    expect(result.warning).toContain('pages-router-static-site-generation');
  });

  it('keeps custom error pages static and requires confirmed locale routing', () => {
    const source = `export default function NotFound() { return <h1>Missing</h1>; }`;

    const unsafeResult = transformPagesRouterPage(source, 'pages/404.tsx', {
      requiresStaticGeneration: true,
    });
    const configuredResult = transformPagesRouterPage(source, 'pages/404.tsx', {
      requiresStaticGeneration: true,
      hasStaticLocaleRouting: true,
    });

    expect(unsafeResult.modified).toBe(false);
    expect(unsafeResult.code).toBe(source);
    expect(unsafeResult.warning).toContain('must remain statically generated');
    expect(configuredResult.code).toContain(
      'export const getStaticProps = withGTStaticProps()'
    );
    expect(configuredResult.code).not.toContain('getServerSideProps');
  });

  it('leaves function exports untouched and gives a manual fallback', () => {
    const source = `
export async function getServerSideProps() {
  return { props: { preserved: true } };
}
export default function Page() { return null; }
`;

    const result = transformPagesRouterPage(source, 'pages/custom.tsx');

    expect(result.modified).toBe(false);
    expect(result.code).toBe(source);
    expect(result.warning).toContain('could not safely add GT locale');
    expect(result.warning).toContain('withGTServerSideProps');
    expect(result.warning).toContain('Learn more:');
  });
});

describe('setupPagesRouter', () => {
  it('creates the custom App, skips API routes, and makes reruns no-ops', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-pages-setup-'));
    temporaryDirectories.push(directory);
    const pagesDirectory = path.join(directory, 'pages');
    const apiDirectory = path.join(pagesDirectory, 'api');
    fs.mkdirSync(apiDirectory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'tsconfig.json'), '{}');
    fs.writeFileSync(
      path.join(pagesDirectory, 'index.tsx'),
      'export default function Home() { return <h1>Hello</h1>; }'
    );
    const apiSource =
      'export default function handler(_request, response) { response.status(200).json({ ok: true }); }';
    fs.writeFileSync(path.join(apiDirectory, 'health.ts'), apiSource);
    process.chdir(directory);

    const firstErrors: string[] = [];
    const firstWarnings: string[] = [];
    const first = await setupPagesRouter(
      pagesDirectory,
      firstErrors,
      firstWarnings
    );
    const secondErrors: string[] = [];
    const secondWarnings: string[] = [];
    const second = await setupPagesRouter(
      pagesDirectory,
      secondErrors,
      secondWarnings
    );

    expect(firstErrors).toEqual([]);
    expect(firstWarnings).toEqual([]);
    expect(first.filesUpdated).toEqual(
      expect.arrayContaining([
        path.join(pagesDirectory, '_app.tsx'),
        path.join(pagesDirectory, 'index.tsx'),
      ])
    );
    expect(second).toEqual({ filesUpdated: [] });
    expect(secondErrors).toEqual([]);
    expect(secondWarnings).toEqual([]);
    expect(fs.readFileSync(path.join(apiDirectory, 'health.ts'), 'utf8')).toBe(
      apiSource
    );
  });
});
