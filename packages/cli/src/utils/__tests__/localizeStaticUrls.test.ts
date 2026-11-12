import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import localizeStaticUrls, {
  transformUrlPath,
  type StaticUrlSettings,
} from '../localizeStaticUrls';
import { createFileMapping } from '../../formats/files/fileMapping.js';

vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
  existsSync: vi.fn(),
}));

vi.mock('../../formats/files/fileMapping.js', () => ({
  createFileMapping: vi.fn(),
}));

type Options = NonNullable<StaticUrlSettings['options']>;

const SOURCE = 'test.mdx';
const TARGET = 'ja/test.mdx';

const DOCS: Options = { docsUrlPattern: '/docs/[locale]' };
const DOCS_HIDDEN: Options = { ...DOCS, experimentalHideDefaultLocale: true };
const ROOT: Options = { docsUrlPattern: '/[locale]' };
const ROOT_HIDDEN: Options = { ...ROOT, experimentalHideDefaultLocale: true };

/**
 * Localizes one page and returns what was written, or null when the page was
 * left untouched. The page is the translated copy for `locale`; `locale: 'en'`
 * runs the default-locale pass over the source page instead.
 */
async function localize(
  content: string,
  options: Options = {},
  {
    locale = 'ja',
    existingFiles,
    mapping = {},
  }: {
    locale?: string;
    /** Restricts the files on disk (paths relative to the working directory). */
    existingFiles?: string[];
    mapping?: Record<string, string>;
  } = {}
): Promise<string | null> {
  vi.mocked(fs.promises.readFile).mockResolvedValue(content);
  if (existingFiles) {
    const existing = new Set([TARGET, ...existingFiles]);
    vi.mocked(fs.existsSync).mockImplementation((p) => existing.has(String(p)));
  }
  vi.mocked(createFileMapping).mockReturnValue(
    locale === 'en' ? {} : { [locale]: { [SOURCE]: TARGET, ...mapping } }
  );

  await localizeStaticUrls(
    {
      files: {
        placeholderPaths: { mdx: ['[locale]/test.mdx'] },
        resolvedPaths: { mdx: [SOURCE] },
        transformPaths: {},
      },
      defaultLocale: 'en',
      locales: ['en', locale],
      options,
    },
    [locale]
  );

  const page = locale === 'en' ? SOURCE : TARGET;
  const write = vi
    .mocked(fs.promises.writeFile)
    .mock.calls.find(([file]) => file === page);
  return write ? String(write[1]) : null;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fs.existsSync).mockReturnValue(true);
});

describe('localizeStaticUrls', () => {
  it.each([
    ['no files are configured', null],
    [
      'only the gt placeholder path exists',
      { placeholderPaths: { gt: 'some-path' }, resolvedPaths: {} },
    ],
  ])('does nothing when %s', async (_name, files) => {
    await localizeStaticUrls({
      files,
      defaultLocale: 'en',
      locales: ['en', 'ja'],
    } as StaticUrlSettings);

    expect(createFileMapping).not.toHaveBeenCalled();
  });

  it('rewrites the md/mdx files of every locale, including the default-locale sources', async () => {
    const written: Record<string, string> = {};
    vi.mocked(createFileMapping).mockReturnValue({
      ja: {
        'file1.md': 'ja/file1.md',
        'file2.mdx': 'ja/file2.mdx',
        'file3.txt': 'ja/file3.txt',
      },
    });
    vi.mocked(fs.promises.readFile).mockResolvedValue(
      `[Link](/docs/guide) and <a href="/docs/en/api">API</a>`
    );
    vi.mocked(fs.promises.writeFile).mockImplementation(async (p, content) => {
      written[String(p)] = String(content);
    });

    await localizeStaticUrls({
      files: {
        placeholderPaths: { docs: '/docs' },
        resolvedPaths: { md: ['file1.md'], mdx: ['file2.mdx'] },
      },
      defaultLocale: 'en',
      locales: ['en', 'ja'],
      options: DOCS,
    } as unknown as StaticUrlSettings);

    expect(createFileMapping).toHaveBeenCalledWith(
      { md: ['file1.md'], mdx: ['file2.mdx'] },
      { docs: '/docs' },
      {},
      {},
      ['en', 'ja'],
      'en'
    );
    // Sources gain the default locale; translations swap it for their own.
    const source = `[Link](/docs/en/guide) and <a href="/docs/en/api">API</a>`;
    const translated = `[Link](/docs/guide) and <a href="/docs/ja/api">API</a>`;
    expect(written).toEqual({
      'file1.md': source,
      'file2.mdx': source,
      'ja/file1.md': translated,
      'ja/file2.mdx': translated,
    });
  });

  it('only rewrites the requested target locales', async () => {
    vi.mocked(createFileMapping).mockReturnValue({
      ja: { 'page.mdx': 'ja/page.mdx' },
      fr: { 'page.mdx': 'fr/page.mdx' },
    });
    vi.mocked(fs.promises.readFile).mockResolvedValue(`[Guide](/docs/guide)`);

    await localizeStaticUrls(
      {
        files: {
          placeholderPaths: { mdx: ['[locale]/page.mdx'] },
          resolvedPaths: { mdx: ['page.mdx'] },
        },
        defaultLocale: 'en',
        locales: ['en', 'ja', 'fr'],
        options: DOCS_HIDDEN,
      } as unknown as StaticUrlSettings,
      ['fr']
    );

    expect(vi.mocked(fs.promises.writeFile).mock.calls).toEqual([
      ['fr/page.mdx', `[Guide](/docs/fr/guide)`],
    ]);
  });

  describe('link syntaxes', () => {
    it.each([
      [
        'markdown links',
        `[Guide](/docs/en/guide) and [Docs](/docs/en)`,
        `[Guide](/docs/ja/guide) and [Docs](/docs/ja)`,
      ],
      [
        'html anchors, keeping queries and fragments',
        `<a href="/docs/en/guide?tab=api#section">Guide</a> and <a href="/docs/en">Docs</a>`,
        `<a href="/docs/ja/guide?tab=api#section">Guide</a> and <a href="/docs/ja">Docs</a>`,
      ],
      [
        'markdown links and anchors in the same page, keeping surrounding newlines',
        `
[Markdown Link](/docs/en/guide)

<a href="/docs/en/api">HTML Link</a>

More content with [another link](/docs/en/tutorial) and <a href="/docs/en/reference">reference</a>.
`,
        `
[Markdown Link](/docs/ja/guide)

<a href="/docs/ja/api">HTML Link</a>

More content with [another link](/docs/ja/tutorial) and <a href="/docs/ja/reference">reference</a>.
`,
      ],
      [
        'nested JSX components',
        `<Columns cols={2}>
  <Card title="Edit locally" icon="pen-to-square" href="/docs/en/development">
    Edit your docs locally.
  </Card>

  <Card title="Customize your site" icon="palette" href="/docs/en/essentials/settings">
    Customize the design.
  </Card>
</Columns>`,
        `<Columns cols={2}>
  <Card title="Edit locally" icon="pen-to-square" href="/docs/ja/development">
    Edit your docs locally.
  </Card>

  <Card title="Customize your site" icon="palette" href="/docs/ja/essentials/settings">
    Customize the design.
  </Card>
</Columns>`,
      ],
      [
        'single-quoted JSX attributes (normalized to double quotes)',
        `<Card title='Start here' href='/docs/en/quickstart'>
  Follow our guide.
</Card>`,
        `<Card title="Start here" href="/docs/ja/quickstart">
  Follow our guide.
</Card>`,
      ],
      [
        'pages with frontmatter and imports, which are left alone',
        `---
title: "Introduction"
---

import TestSnippet from "/snippets/en/test-snippet.mdx";

<TestSnippet />

## Getting Started

[Guide](/docs/en/guide) and <a href="/docs/en/api">API</a>

<Card title="Start here" icon="rocket" href="/docs/en/quickstart" horizontal>
  Follow our quickstart guide.
</Card>`,
        `---
title: "Introduction"
---

import TestSnippet from "/snippets/en/test-snippet.mdx";

<TestSnippet />

## Getting Started

[Guide](/docs/ja/guide) and <a href="/docs/ja/api">API</a>

<Card title="Start here" icon="rocket" href="/docs/ja/quickstart" horizontal>
  Follow our quickstart guide.
</Card>`,
      ],
      // The "Auth0 patch": URLs nested inside JSX expressions (component props,
      // conditional expressions) never surface as mdast nodes.
      [
        'an href nested in JSX inside a component prop',
        `<ParamField body="error" type={<span><a href="/docs/en/interfaces/Error">Error</a></span>}>An error</ParamField>`,
        `<ParamField body="error" type={<span><a href="/docs/ja/interfaces/Error">Error</a></span>}>An error</ParamField>`,
      ],
      [
        'an href inside a standalone JSX expression',
        `{showBeta && <a href="/docs/en/beta">Beta</a>}`,
        `{showBeta && <a href="/docs/ja/beta">Beta</a>}`,
      ],
      [
        'a bare string expression on a url attribute',
        `<Card href={"/docs/en/x"}>Card</Card>`,
        `<Card href={"/docs/ja/x"}>Card</Card>`,
      ],
      [
        'static urls only, leaving dynamically computed ones verbatim',
        `<a href="/docs/en/real">Real</a> <a href={"/docs/" + locale + "/x"}>Dyn</a>`,
        `<a href="/docs/ja/real">Real</a> <a href={"/docs/" + locale + "/x"}>Dyn</a>`,
      ],
      [
        // src usually points at shared assets that would 404 with a locale.
        'href but not asset attributes like src',
        `<a href="/docs/en/guide">G</a> <img src="/docs/en/images/x.png" />`,
        `<a href="/docs/ja/guide">G</a> <img src="/docs/en/images/x.png" />`,
      ],
    ])('localizes %s', async (_name, content, expected) => {
      expect(await localize(content, DOCS)).toBe(expected);
    });

    it('localizes every occurrence of a repeated href', async () => {
      const content = `Some content before.

{/* JSX code block */}

<div>
  <a href="/docs/quickstart">First Link</a>
  <button href="/docs/quickstart">Second Button</button>
  <span href="/docs/quickstart">Third Span</span>
</div>`;

      expect(await localize(content, DOCS_HIDDEN)).toBe(
        content.replaceAll('/docs/quickstart', '/docs/ja/quickstart')
      );
    });

    it.each([
      [
        'a closing tag with no opening tag',
        `</Card>\n\n[Guide](/docs/en/guide)`,
      ],
      [
        'an unclosed JSX tag',
        `<Card title="Test" href="/docs/en/guide">\n\n[Guide](/docs/en/guide)`,
      ],
      [
        'mismatched JSX tags',
        `<Card title="Test">\n  <Button href="/docs/en/guide">Guide</Button>\n</NotCard>`,
      ],
      [
        'an invalid JSX attribute',
        `<Card title=invalid-attribute href="/docs/en/guide">\n  Content here\n</Card>`,
      ],
    ])('leaves a page with %s untouched', async (_name, content) => {
      expect(await localize(content, DOCS)).toBeNull();
    });
  });

  describe('locale placement', () => {
    it.each<[string, Options, string, string | null, string?]>([
      [
        'inserts the locale when the default locale is hidden',
        DOCS_HIDDEN,
        `[Guide](/docs/guide), <a href="/docs">Docs</a>, <Card href="/docs/japanese/guide">x</Card>`,
        `[Guide](/docs/ja/guide), <a href="/docs/ja">Docs</a>, <Card href="/docs/ja/japanese/guide">x</Card>`,
      ],
      [
        'never duplicates a locale that is already present',
        DOCS_HIDDEN,
        `[Guide](/docs/ja/guide)`,
        null,
      ],
      [
        'leaves links without the default locale alone when it is shown',
        DOCS,
        `[Guide](/docs/ja/guide) and [Other](/docs/guide)`,
        null,
      ],
      [
        'supports a root pattern',
        ROOT,
        `[Guide](/en/guide) and <a href="/en/api">API</a>`,
        `[Guide](/ja/guide) and <a href="/ja/api">API</a>`,
      ],
      [
        'supports a root pattern with the default locale hidden',
        ROOT_HIDDEN,
        `[Guide](/guide) and <a href="/api">API</a>`,
        `[Guide](/ja/guide) and <a href="/ja/api">API</a>`,
      ],
      [
        'defaults to the root pattern',
        {},
        `[Guide](/en/guide)`,
        `[Guide](/ja/guide)`,
      ],
      [
        'accepts a pattern without a leading slash',
        { docsUrlPattern: 'docs/[locale]' },
        `[Guide](/docs/en/guide)`,
        `[Guide](/docs/ja/guide)`,
      ],
      [
        'accepts special characters in the pattern',
        { docsUrlPattern: '/api-docs/[locale]' },
        `[Guide](/api-docs/en/guide)`,
        `[Guide](/api-docs/ja/guide)`,
      ],
      [
        'uses region-qualified target locales verbatim',
        DOCS,
        `[Guide](/docs/en/guide)`,
        `[Guide](/docs/zh-CN/guide)`,
        'zh-CN',
      ],
      [
        'skips pages that never mention the pattern',
        DOCS,
        `[External link](https://example.com) and [Guide](/guide)`,
        null,
      ],
      [
        'leaves external links alone',
        ROOT_HIDDEN,
        `[Guide](/guide) [External](https://example.com/guide) <a href="https://external.com">External</a>`,
        `[Guide](/ja/guide) [External](https://example.com/guide) <a href="https://external.com">External</a>`,
      ],
      [
        // Relative markdown links stay relative to the page; a relative href
        // on a component is prefixed like a root-relative one.
        'prefixes relative component hrefs but not relative markdown links',
        ROOT_HIDDEN,
        `---
title: "Introducción"
---

[Inicio](quickstart)

<Card title="Comience aquí" icon="rocket" href="quickstart" horizontal>
  Siga nuestra guía de inicio rápido en tres pasos.
</Card>

<Card title="Edita localmente" icon="pen-to-square" href="/development">
  Edita tu documentación de forma local.
</Card>`,
        `---
title: "Introducción"
---

[Inicio](quickstart)

<Card title="Comience aquí" icon="rocket" href="es/quickstart" horizontal>
  Siga nuestra guía de inicio rápido en tres pasos.
</Card>

<Card title="Edita localmente" icon="pen-to-square" href="/es/development">
  Edita tu documentación de forma local.
</Card>`,
        'es',
      ],
    ])('%s', async (_name, options, content, expected, locale) => {
      expect(await localize(content, options, { locale })).toBe(expected);
    });

    it.each<[string, Options, string, string | null]>([
      [
        'adds the default locale to source pages when it is shown',
        DOCS,
        `[Guide](/docs/guide) and <Card href="/docs/quickstart">Start</Card>`,
        `[Guide](/docs/en/guide) and <Card href="/docs/en/quickstart">Start</Card>`,
      ],
      [
        'leaves source pages that already show the default locale alone',
        DOCS,
        `[Guide](/docs/en/guide) and <Card href="/docs/en/quickstart">Start</Card>`,
        null,
      ],
      [
        'removes the default locale from source pages when it is hidden',
        {
          ...ROOT_HIDDEN,
          excludeStaticUrls: ['/images/**/*', '/logo/**/*'],
        },
        `# Default Locale Content

[Link](/en/guide)

<Card href="/en/api">API</Card>

[Another](/en/docs)`,
        `# Default Locale Content

[Link](/guide)

<Card href="/api">API</Card>

[Another](/docs)`,
      ],
      [
        'leaves source pages that already hide the default locale alone',
        DOCS_HIDDEN,
        `[Guide](/docs/guide) and <Card href="/docs/quickstart">Start</Card>`,
        null,
      ],
    ])('%s', async (_name, options, content, expected) => {
      expect(await localize(content, options, { locale: 'en' })).toBe(expected);
    });
  });

  describe('multiple docsUrlPatterns', () => {
    it.each<[string, string | string[], string, string]>([
      [
        'localizes links under every pattern',
        ['/docs/[locale]', '/ai/docs/[locale]'],
        `[Guide](/docs/guide) and <a href="/ai/docs/mcp/intro">MCP</a> and [Blog](/blog/post)`,
        `[Guide](/docs/ja/guide) and <a href="/ai/docs/ja/mcp/intro">MCP</a> and [Blog](/blog/post)`,
      ],
      [
        // /docs/x falls under both patterns; /docs/[locale] must win, and a
        // link it leaves alone (already localized) must not fall through to
        // /[locale]
        'localizes each link with its longest matching pattern',
        ['/[locale]', '/docs/[locale]'],
        `[A](/docs/guide) [B](/docs/ja/guide) [C](/pricing)`,
        `[A](/docs/ja/guide) [B](/docs/ja/guide) [C](/ja/pricing)`,
      ],
      [
        // /docs?tab=api must select /docs/[locale], not fall back to /[locale]
        'picks the pattern from the path, ignoring queries and fragments',
        ['/[locale]', '/docs/[locale]'],
        `[A](/docs?tab=api) [B](/docs#intro) [C](/docs/guide?tab=api)`,
        `[A](/docs?tab=api) [B](/docs#intro) [C](/docs/ja/guide?tab=api)`,
      ],
      [
        'treats a one-item list like a single pattern',
        ['/docs/[locale]'],
        `[Guide](/docs/guide) and [MCP](/ai/docs/mcp)`,
        `[Guide](/docs/ja/guide) and [MCP](/ai/docs/mcp)`,
      ],
    ])('%s', async (_name, docsUrlPattern, content, expected) => {
      expect(
        await localize(content, {
          docsUrlPattern,
          experimentalHideDefaultLocale: true,
        })
      ).toBe(expected);
    });
  });

  describe('excludeStaticUrls', () => {
    it.each<[string, Options, string, string]>([
      [
        'skips markdown links and hrefs matching an exact path',
        { ...DOCS, excludeStaticUrls: ['/docs/en/images'] },
        `[Guide](/docs/en/guide) and [Images](/docs/en/images) and <a href="/docs/en/images">Images</a>`,
        `[Guide](/docs/ja/guide) and [Images](/docs/en/images) and <a href="/docs/en/images">Images</a>`,
      ],
      [
        'resolves [locale] in globs to the default locale',
        { ...DOCS, excludeStaticUrls: ['/docs/[locale]/{images,assets}/**'] },
        `[Image1](/docs/en/images/photos/photo1.jpg) [Image2](/docs/en/assets/logo.png) <a href="/docs/en/guide">Guide</a>`,
        `[Image1](/docs/en/images/photos/photo1.jpg) [Image2](/docs/en/assets/logo.png) <a href="/docs/ja/guide">Guide</a>`,
      ],
      [
        'matches unprefixed paths when the default locale is hidden',
        {
          ...DOCS_HIDDEN,
          excludeStaticUrls: ['/docs/images/**', '/docs/snippets/**'],
        },
        `[Guide](/docs/guide) [Images](/docs/images) [Logo](/docs/images/logo.png) <a href="/docs/snippets/code.js">Snippet</a>`,
        `[Guide](/docs/ja/guide) [Images](/docs/images) [Logo](/docs/images/logo.png) <a href="/docs/snippets/code.js">Snippet</a>`,
      ],
      [
        // [locale] resolves to /en/images/**, which no hidden-locale URL has.
        'does not match [locale] globs against hidden-locale paths',
        { ...ROOT_HIDDEN, excludeStaticUrls: ['/[locale]/images/**'] },
        `[Guide](/guide) and [Images](/images/logo.png)`,
        `[Guide](/ja/guide) and [Images](/ja/images/logo.png)`,
      ],
    ])('%s', async (_name, options, content, expected) => {
      expect(await localize(content, options)).toBe(expected);
    });
  });

  describe('baseDomain', () => {
    const baseDomain = 'https://example.com';

    it.each<[string, Options, string, string | null]>([
      [
        'localizes absolute URLs on the base domain',
        { ...DOCS, baseDomain },
        `[Docs](https://example.com/docs/en/guide) [Images](https://example.com/images/photo.jpg) <Card href="https://example.com/docs/en/api">API</Card>`,
        `[Docs](https://example.com/docs/fr/guide) [Images](https://example.com/images/photo.jpg) <Card href="https://example.com/docs/fr/api">API</Card>`,
      ],
      [
        'inserts the locale when the default locale is hidden',
        { ...ROOT_HIDDEN, baseDomain },
        `[Guide](https://example.com/docs/guide) and <Card href="https://example.com/docs/api">API</Card>`,
        `[Guide](https://example.com/fr/docs/guide) and <Card href="https://example.com/fr/docs/api">API</Card>`,
      ],
      [
        'leaves already localized URLs alone',
        { ...DOCS, baseDomain },
        `<a href="https://example.com/docs/fr/guide">Guide</a>`,
        null,
      ],
      [
        // A failed transformation must not write a literal "null" into the URL.
        'leaves URLs outside the pattern or without the default locale alone',
        { ...DOCS, baseDomain },
        `[External](https://example.com/other/page) and [Valid](https://example.com/docs/guide)`,
        null,
      ],
    ])('%s', async (_name, options, content, expected) => {
      expect(await localize(content, options, { locale: 'fr' })).toBe(expected);
    });
  });

  describe('skipUntranslatedPages', () => {
    const skip: Options = {
      ...ROOT_HIDDEN,
      experimentalLocalizeStaticUrls: { skipUntranslatedPages: true },
    };

    it.each<
      [string, Options, string, string[], Record<string, string>, string | null]
    >([
      [
        'keeps links to untranslated pages on the default locale when it is hidden',
        skip,
        '[Sandbox](/products/sandbox#write_file) <Card href="/products/sandbox">x</Card> [Guide](/guide)',
        ['products/sandbox.mdx', 'guide.mdx', 'ja/guide.mdx'],
        { 'guide.mdx': 'ja/guide.mdx' },
        '[Sandbox](/products/sandbox#write_file) <Card href="/products/sandbox">x</Card> [Guide](/ja/guide)',
      ],
      [
        'keeps links to untranslated pages on the default locale when it is shown',
        { ...skip, experimentalHideDefaultLocale: false },
        '[Sandbox](/en/products/sandbox) and [Guide](/en/guide)',
        ['en/products/sandbox.mdx', 'en/guide.mdx', 'ja/guide.md'],
        { 'en/guide.mdx': 'ja/guide.md' },
        '[Sandbox](/en/products/sandbox) and [Guide](/ja/guide)',
      ],
      [
        'still prefixes links to untranslated pages when the option is off',
        { ...skip, experimentalLocalizeStaticUrls: true },
        '[Sandbox](/products/sandbox)',
        ['products/sandbox.mdx'],
        {},
        '[Sandbox](/ja/products/sandbox)',
      ],
      [
        'keeps links to pages whose translation has not been written yet',
        skip,
        '[Guide](/guide)',
        ['guide.mdx'],
        { 'guide.mdx': 'ja/guide.mdx' },
        null,
      ],
      [
        'resolves folder links through index pages',
        skip,
        '[Products](/products/)',
        ['products/index.mdx'],
        {},
        null,
      ],
      [
        // Docusaurus stores translations outside a locale-prefixed copy of the URL.
        'localizes links whose translation lives at a transformed output path',
        skip,
        '[Guide](/docs/guide)',
        [
          'docs/guide.mdx',
          'i18n/ja/docusaurus-plugin-content-docs/current/guide.mdx',
        ],
        {
          'docs/guide.mdx':
            'i18n/ja/docusaurus-plugin-content-docs/current/guide.mdx',
        },
        '[Guide](/ja/docs/guide)',
      ],
      [
        'localizes links to translations that exist outside the file mapping',
        skip,
        '[Guide](/guide)',
        ['guide.mdx', 'ja/guide.mdx'],
        {},
        '[Guide](/ja/guide)',
      ],
      [
        'still localizes links whose source is not a page file, such as generated OpenAPI pages',
        skip,
        '[Create key](/api-reference/create-key)',
        [],
        {},
        '[Create key](/ja/api-reference/create-key)',
      ],
    ])(
      '%s',
      async (_name, options, content, existingFiles, mapping, expected) => {
        expect(
          await localize(content, options, { existingFiles, mapping })
        ).toBe(expected);
      }
    );
  });

  describe('configured attributes', () => {
    const content = [
      '<Banner href="/guide" href2="/guide" src="/images/a.png" />',
      '',
      '<Banner href2={"/guide"} />',
      '',
      '<Banner buttons={<a href2="/guide">Guide</a>} />',
    ].join('\n');

    it('localizes only href by default', async () => {
      expect(
        await localize(content, {
          ...ROOT_HIDDEN,
          experimentalLocalizeStaticUrls: true,
        })
      ).toBe(content.replace('href="/guide"', 'href="/ja/guide"'));
    });

    it('localizes attributes matching configured names or globs', async () => {
      expect(
        await localize(content, {
          ...ROOT_HIDDEN,
          experimentalLocalizeStaticUrls: { attributes: ['href*'] },
        })
      ).toBe(content.replaceAll('"/guide"', '"/ja/guide"'));
    });
  });
});

describe('transformUrlPath', () => {
  // [url, patternHead, targetLocale, hideDefaultLocale, expected]
  it.each<[string, string, string, boolean, string | null]>([
    // Default locale, shown: insert it
    ['/docs/guide', '/docs/', 'en', false, '/docs/en/guide'],
    ['/docs', '/docs/', 'en', false, '/docs/en'],
    ['/docs/en/guide', '/docs/', 'en', false, null],
    ['/other/guide', '/docs/', 'en', false, null],
    // Default locale, hidden: remove it
    ['/docs/en/guide', '/docs/', 'en', true, '/docs/guide'],
    ['/docs/en', '/docs/', 'en', true, '/docs'],
    ['/docs/guide', '/docs/', 'en', true, null],
    // Target locale, default shown: replace the default locale
    ['/docs/en/guide', '/docs/', 'ja', false, '/docs/ja/guide'],
    ['/docs/en', '/docs/', 'ja', false, '/docs/ja'],
    ['/docs/en/guide', '/docs/', 'zh-CN', false, '/docs/zh-CN/guide'],
    ['/docs/en/guide?tab=api', '/docs/', 'ja', false, '/docs/ja/guide?tab=api'],
    ['/docs/en/guide#section', '/docs/', 'ja', false, '/docs/ja/guide#section'],
    ['/docs', '/docs/', 'ja', false, null],
    ['/docs/', '/docs/', 'ja', false, null],
    ['/docs/guide', '/docs', 'ja', false, null],
    ['/other/guide', '/docs/', 'ja', false, null],
    ['/guide', '/', 'ja', false, null],
    ['/guide', '', 'ja', false, null],
    // Target locale, default hidden: insert the target locale
    ['/docs/guide', '/docs/', 'ja', true, '/docs/ja/guide'],
    ['/docs', '/docs/', 'ja', true, '/docs/ja'],
    ['/docs/ja/guide', '/docs/', 'ja', true, null],
    // Segments that merely start with a locale code are not locales
    ['/docs/english/guide', '/docs/', 'ja', true, '/docs/ja/english/guide'],
    ['/docs/japanese', '/docs/', 'ja', true, '/docs/ja/japanese'],
  ])(
    '%s under %j for %s (hidden default: %s) -> %s',
    (url, patternHead, targetLocale, hideDefaultLocale, expected) => {
      expect(
        transformUrlPath(
          url,
          patternHead,
          targetLocale,
          'en',
          hideDefaultLocale
        )
      ).toBe(expected);
    }
  );
});
