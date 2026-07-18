/**
 * Graduation evidence for the experimental static URL / import localizers.
 *
 * Unlike the sibling unit suites, this corpus uses NO mocks. It builds a real
 * docs tree on disk (md, mdx with nested JSX + imports, and html), pre-creates
 * the target-locale copies the way a download step would, then drives the real
 * localizers exactly as `postProcessTranslations` does in
 * cli/commands/translate.ts:
 *   localizeStaticUrls(settings, nonDefaultLocales)  then
 *   localizeStaticImports(settings)
 *
 * It asserts every rewritten URL/import AND every URL that must stay untouched,
 * across two target locales, and confirms the English source is left intact.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import localizeStaticUrls from '../localizeStaticUrls';
import localizeStaticImports from '../localizeStaticImports';
import type { StaticLocalizationSettings } from '../../types/index.js';

const GUIDE_MD = `# Guide

Read the [intro](/docs/en/intro) and the [API reference](/docs/en/api?tab=auth#config).

This [setup guide](/docs/en/setup/) keeps its trailing slash, and the
[timed link](/docs/en/guide?time=12:00) keeps its colon.

The [neighbor](./neighbor) and [parent](../other/page) links stay relative.

Our [site](https://example.com/docs/en/site) and the [blog](/blog/en/post) are left alone.
`;

const COMPONENTS_MDX = `import Intro from '/snippets/en/intro.mdx';

<Intro />

<Card title="Quickstart" href="/docs/en/quickstart">Start</Card>

<Card href={"/docs/en/api"}>API</Card>

{showBeta && <a href="/docs/en/beta">Beta</a>}

<a href="https://external.com/docs/en/out">External</a>

<img src="/docs/en/img/logo.png" />
`;

const PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Docs</title>
</head>
<body>
  <nav>
    <a href="/docs/en/intro">Intro</a>
    <a href='/docs/en/api?tab=auth#config'>API</a>
  </nav>
  <a href="https://cdn.example.com/docs/en/asset">CDN</a>
  <!-- <a href="/docs/en/commented">nope</a> -->
  <pre><a href="/docs/en/example">example</a></pre>
  <img src="/docs/en/img/logo.png" />
</body>
</html>
`;

const SNIPPET_MDX = `Reusable snippet content.\n`;

const LOCALES = ['en', 'ja', 'fr'];
const TARGET_LOCALES = ['ja', 'fr'];

describe('static localization graduation corpus (end to end, no mocks)', () => {
  let root: string;
  let originalCwd: string;

  const abs = (...parts: string[]): string => path.join(root, ...parts);
  const read = (rel: string): string => fs.readFileSync(abs(rel), 'utf8');
  const writeFile = (rel: string, content: string): void => {
    fs.mkdirSync(path.dirname(abs(rel)), { recursive: true });
    fs.writeFileSync(abs(rel), content);
  };

  const settings: () => StaticLocalizationSettings = () => ({
    files: {
      placeholderPaths: {
        md: [abs('content', '[locale]', 'guide.md')],
        mdx: [abs('content', '[locale]', 'components.mdx')],
        html: [abs('content', '[locale]', 'page.html')],
      },
      resolvedPaths: {
        md: [abs('content', 'en', 'guide.md')],
        mdx: [abs('content', 'en', 'components.mdx')],
        html: [abs('content', 'en', 'page.html')],
      },
      transformPaths: {},
      transformFormats: {},
    },
    defaultLocale: 'en',
    locales: LOCALES,
    options: {
      experimentalLocalizeStaticUrls: true,
      experimentalLocalizeStaticImports: true,
      docsUrlPattern: '/docs/[locale]',
      docsImportPattern: '/snippets/[locale]',
    },
  });

  beforeEach(async () => {
    originalCwd = process.cwd();
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-localize-corpus-'));
    // Source (English) tree.
    writeFile(path.join('content', 'en', 'guide.md'), GUIDE_MD);
    writeFile(path.join('content', 'en', 'components.mdx'), COMPONENTS_MDX);
    writeFile(path.join('content', 'en', 'page.html'), PAGE_HTML);
    // Pre-create the target-locale copies (as a download step would) and the
    // snippet files each locale imports (import localization checks existence).
    for (const locale of LOCALES) {
      writeFile(path.join('content', locale, 'guide.md'), GUIDE_MD);
      writeFile(path.join('content', locale, 'components.mdx'), COMPONENTS_MDX);
      writeFile(path.join('content', locale, 'page.html'), PAGE_HTML);
      writeFile(path.join('snippets', locale, 'intro.mdx'), SNIPPET_MDX);
    }
    // Import path existence checks resolve against process.cwd().
    process.chdir(root);

    // Drive the real pipeline exactly like translate.ts postProcessTranslations.
    await localizeStaticUrls(settings(), TARGET_LOCALES);
    await localizeStaticImports(settings());
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(root, { recursive: true, force: true });
  });

  describe.each(TARGET_LOCALES)('markdown links for %s', (locale) => {
    it('rewrites absolute doc links and preserves query/anchor/slash', () => {
      const out = read(path.join('content', locale, 'guide.md'));
      expect(out).toContain(`/docs/${locale}/intro`);
      expect(out).toContain(`/docs/${locale}/api?tab=auth#config`);
      expect(out).toContain(`/docs/${locale}/setup/`);
      expect(out).toContain(`/docs/${locale}/guide?time=12:00`);
      expect(out).not.toContain('/docs/en/intro');
    });

    it('leaves relative, external and non-matching links untouched', () => {
      const out = read(path.join('content', locale, 'guide.md'));
      expect(out).toContain('./neighbor');
      expect(out).toContain('../other/page');
      expect(out).toContain('https://example.com/docs/en/site');
      expect(out).toContain('/blog/en/post');
      expect(out).not.toContain(`/docs/${locale}/neighbor`);
      expect(out).not.toContain(`/blog/${locale}/post`);
    });
  });

  describe.each(TARGET_LOCALES)('mdx (jsx + imports) for %s', (locale) => {
    it('rewrites href attributes, expression hrefs and embedded jsx hrefs', () => {
      const out = read(path.join('content', locale, 'components.mdx'));
      expect(out).toContain(`/docs/${locale}/quickstart`);
      expect(out).toContain(`/docs/${locale}/api`);
      expect(out).toContain(`/docs/${locale}/beta`);
      expect(out).not.toContain('/docs/en/quickstart');
      expect(out).not.toContain('/docs/en/beta');
    });

    it('localizes the static import specifier', () => {
      const out = read(path.join('content', locale, 'components.mdx'));
      expect(out).toContain(`/snippets/${locale}/intro.mdx`);
      expect(out).not.toContain('/snippets/en/intro.mdx');
    });

    it('leaves external hrefs and src assets untouched', () => {
      const out = read(path.join('content', locale, 'components.mdx'));
      expect(out).toContain('https://external.com/docs/en/out');
      expect(out).toContain('/docs/en/img/logo.png');
    });
  });

  describe.each(TARGET_LOCALES)('html for %s', (locale) => {
    it('rewrites hrefs and preserves quote style, query and anchor', () => {
      const out = read(path.join('content', locale, 'page.html'));
      expect(out).toContain(`<a href="/docs/${locale}/intro">`);
      expect(out).toContain(`<a href='/docs/${locale}/api?tab=auth#config'>`);
      expect(out).not.toContain('/docs/en/intro');
    });

    it('preserves doctype, void elements and overall formatting', () => {
      const out = read(path.join('content', locale, 'page.html'));
      expect(out).toContain('<!DOCTYPE html>');
      expect(out).toContain('<meta charset="utf-8">');
      expect(out.startsWith('<!DOCTYPE html>')).toBe(true);
    });

    it('skips hrefs in comments and pre/code, and leaves cdn + src alone', () => {
      const out = read(path.join('content', locale, 'page.html'));
      expect(out).toContain('/docs/en/commented');
      expect(out).toContain('/docs/en/example');
      expect(out).toContain('https://cdn.example.com/docs/en/asset');
      expect(out).toContain('src="/docs/en/img/logo.png"');
      expect(out).not.toContain(`/docs/${locale}/commented`);
      expect(out).not.toContain(`/docs/${locale}/example`);
    });
  });

  it('does not modify the English source tree', () => {
    expect(read(path.join('content', 'en', 'guide.md'))).toContain(
      '/docs/en/intro'
    );
    expect(read(path.join('content', 'en', 'guide.md'))).not.toContain(
      '/docs/ja/intro'
    );
    expect(read(path.join('content', 'en', 'page.html'))).toContain(
      '/docs/en/intro'
    );
  });
});
