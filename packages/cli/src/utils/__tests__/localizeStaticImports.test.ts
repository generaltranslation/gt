import * as fs from 'fs';
import * as path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import localizeStaticImports, {
  type StaticImportSettings,
} from '../localizeStaticImports';
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

type Options = NonNullable<StaticImportSettings['options']>;

const SOURCE = '/project/docs/test.mdx';

const COMPONENTS: Options = { docsImportPattern: '/components/[locale]' };
const COMPONENTS_HIDDEN: Options = {
  ...COMPONENTS,
  docsHideDefaultLocaleImport: true,
};
const SNIPPETS: Options = { docsImportPattern: '/snippets/[locale]' };
const SNIPPETS_HIDDEN: Options = {
  ...SNIPPETS,
  docsHideDefaultLocaleImport: true,
};

/**
 * Localizes one page and returns what was written back. The page is the
 * translated copy for `locale`; a `locale` equal to the default locale runs
 * the default-locale pass over the source page instead.
 */
async function localize(
  content: string,
  options?: Options,
  {
    locale = 'ja',
    defaultLocale = 'en',
    page = `/project/docs/${locale}/test.mdx`,
    importExists = () => true,
  }: {
    locale?: string;
    defaultLocale?: string;
    page?: string;
    /** Whether the file a rewritten import points at is on disk. */
    importExists?: (file: string) => boolean;
  } = {}
): Promise<string> {
  const isDefault = locale === defaultLocale;
  const file = isDefault ? SOURCE : page;
  vi.mocked(fs.promises.readFile).mockResolvedValue(content);
  vi.mocked(fs.existsSync).mockImplementation(
    (p) => p === file || importExists(String(p))
  );
  vi.mocked(createFileMapping).mockReturnValue(
    isDefault ? {} : { [locale]: { [SOURCE]: file } }
  );

  await localizeStaticImports({
    files: {
      placeholderPaths: { mdx: ['/project/docs/[locale]/test.mdx'] },
      resolvedPaths: isDefault ? { mdx: [SOURCE] } : {},
      transformPaths: {},
    },
    defaultLocale,
    locales: [...new Set([defaultLocale, locale])],
    options,
  } as StaticImportSettings);

  expect(fs.promises.writeFile).toHaveBeenCalledTimes(1);
  const [writtenFile, written] = vi.mocked(fs.promises.writeFile).mock.calls[0];
  expect(writtenFile).toBe(file);
  return String(written);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('localizeStaticImports', () => {
  it.each([
    ['no files are configured', null],
    [
      'only the gt placeholder path exists',
      { placeholderPaths: { gt: 'some-path' }, resolvedPaths: {} },
    ],
  ])('does nothing when %s', async (_name, files) => {
    await localizeStaticImports({
      files,
      defaultLocale: 'en',
      locales: ['en', 'ja'],
    } as StaticImportSettings);

    expect(createFileMapping).not.toHaveBeenCalled();
  });

  it('rewrites the md/mdx files that exist for every locale in the mapping', async () => {
    vi.mocked(createFileMapping).mockReturnValue({
      en: { 'file1.md': 'en/file1.md' },
      ja: {
        'file1.md': 'ja/file1.md',
        'file2.mdx': 'ja/file2.mdx',
        'file3.txt': 'ja/file3.txt',
        'file4.mdx': 'ja/missing.mdx',
      },
    });
    vi.mocked(fs.existsSync).mockImplementation(
      (p) => !String(p).endsWith('missing.mdx')
    );
    vi.mocked(fs.promises.readFile).mockResolvedValue(
      `import Component from '/components/special-component.mdx'`
    );

    await localizeStaticImports({
      files: {
        placeholderPaths: { docs: '/docs' },
        resolvedPaths: { md: ['file1.md'], mdx: ['file2.mdx', 'file4.mdx'] },
      },
      defaultLocale: 'en',
      locales: ['en', 'ja'],
      options: COMPONENTS,
    } as unknown as StaticImportSettings);

    expect(createFileMapping).toHaveBeenCalledWith(
      { md: ['file1.md'], mdx: ['file2.mdx', 'file4.mdx'] },
      { docs: '/docs' },
      {},
      {},
      ['en', 'ja'],
      'en'
    );
    // The default locale is in the mapping, so its sources are not processed
    // a second time.
    const translated = `import Component from '/components/ja/special-component.mdx'`;
    expect(vi.mocked(fs.promises.writeFile).mock.calls).toEqual([
      [
        'en/file1.md',
        `import Component from '/components/en/special-component.mdx'`,
      ],
      ['ja/file1.md', translated],
      ['ja/file2.mdx', translated],
    ]);
  });

  describe('translated pages', () => {
    it.each<[string, Options | undefined, string, string]>([
      [
        'swaps the default locale for the target locale, keeping quote style',
        COMPONENTS,
        `
import Component1 from '/components/en/component1.mdx'
import Component2 from "/components/en/component2.mdx"
import { Button, Table as DataTable } from '/components/en/ui/table.mdx'
import Index from '/components/en'
`,
        `
import Component1 from '/components/ja/component1.mdx'
import Component2 from "/components/ja/component2.mdx"
import { Button, Table as DataTable } from '/components/ja/ui/table.mdx'
import Index from '/components/ja'
`,
      ],
      [
        'adds the target locale to imports that have none',
        SNIPPETS,
        `---
title: "Extraits réutilisables"
---

import SnippetIntro from '/snippets/snippet-intro.mdx';

<SnippetIntro />`,
        `---
title: "Extraits réutilisables"
---

import SnippetIntro from '/snippets/ja/snippet-intro.mdx';

<SnippetIntro />`,
      ],
      [
        'leaves imports that already have the target locale alone',
        COMPONENTS,
        `import Snip from "/components/ja/special-component.mdx"\n\nexport default function Page() { return null }`,
        `import Snip from "/components/ja/special-component.mdx"\n\nexport default function Page() { return null }`,
      ],
      [
        'leaves imports that mention the pattern elsewhere in their path alone',
        COMPONENTS,
        `import Nested from '/other/components/en/nested.mdx'`,
        `import Nested from '/other/components/en/nested.mdx'`,
      ],
      [
        'leaves pages that never mention the pattern alone',
        COMPONENTS,
        `
import SomeOtherThing from '@/other/path';

export default function Component() {}
`,
        `
import SomeOtherThing from '@/other/path';

export default function Component() {}
`,
      ],
      [
        'rewrites real import statements only, not code snippets or text',
        COMPONENTS,
        `
import Real from '/components/en/real.mdx'

Here is code: \`import Fake from '/components/en/fake.mdx'\`

\`\`\`js
import Fence from '/components/en/fence.mdx'
\`\`\`
`,
        `
import Real from '/components/ja/real.mdx'

Here is code: \`import Fake from '/components/en/fake.mdx'\`

\`\`\`js
import Fence from '/components/en/fence.mdx'
\`\`\`
`,
      ],
      [
        'accepts a pattern without a leading slash',
        { docsImportPattern: 'components/[locale]' },
        `import Component from '/components/en/special-component.mdx'`,
        `import Component from '/components/ja/special-component.mdx'`,
      ],
      [
        'defaults to the root pattern when there are no options',
        undefined,
        `import Component from '/en/components/special-component.mdx'`,
        `import Component from '/ja/components/special-component.mdx'`,
      ],
      [
        'defaults to the root pattern with the default locale hidden',
        { docsHideDefaultLocaleImport: true },
        `import Component from '/special-component.mdx'`,
        `import Component from '/ja/special-component.mdx'`,
      ],
      [
        'ignores the part of the pattern after [locale]',
        { docsImportPattern: '/docs/advanced/[locale]/tutorials/' },
        `import Guide from '/docs/advanced/en/tutorials/guide.mdx'`,
        `import Guide from '/docs/advanced/ja/tutorials/guide.mdx'`,
      ],
      [
        'swaps the locale in relative imports',
        { docsImportPattern: '../../shared/[locale]/components/' },
        `import Shared from '../../shared/en/components/header.mdx'`,
        `import Shared from '../../shared/ja/components/header.mdx'`,
      ],
      [
        'adds the locale to relative imports that have none',
        { docsImportPattern: './shared/[locale]/' },
        `import Modal from './shared/modal.mdx'`,
        `import Modal from './shared/ja/modal.mdx'`,
      ],
      [
        'adds the target locale when the default locale is hidden',
        COMPONENTS_HIDDEN,
        `
import Component from '/components/special-component.mdx'
import Index from '/components'
`,
        `
import Component from '/components/ja/special-component.mdx'
import Index from '/components/ja'
`,
      ],
      [
        'still swaps a default locale that is present when it is hidden',
        COMPONENTS_HIDDEN,
        `
import Component from '/components/en/special-component.mdx'
import Done from '/components/ja/done.mdx'
`,
        `
import Component from '/components/ja/special-component.mdx'
import Done from '/components/ja/done.mdx'
`,
      ],
    ])('%s', async (_name, options, content, expected) => {
      expect(await localize(content, options)).toBe(expected);
    });

    it('uses the configured default locale', async () => {
      expect(
        await localize(
          `import Component from '/components/fr/special-component.mdx'`,
          COMPONENTS,
          { defaultLocale: 'fr' }
        )
      ).toBe(`import Component from '/components/ja/special-component.mdx'`);
    });

    it('applies docsImportRewrites before the locale pattern', async () => {
      expect(
        await localize(
          `import SystemTableCloud from '@site/docs/_snippets/_system_table_cloud.md';`,
          {
            experimentalLocalizeStaticImports: true,
            docsImportRewrites: [
              {
                match: '@site/docs',
                replace:
                  '@site/i18n/[locale]/docusaurus-plugin-content-docs/current',
              },
            ],
          },
          { page: '/project/ja/system.md' }
        )
      ).toBe(
        `import SystemTableCloud from '@site/i18n/ja/docusaurus-plugin-content-docs/current/_snippets/_system_table_cloud.md';`
      );
    });
  });

  describe('default-locale pages', () => {
    it.each<[string, Options, string, string]>([
      [
        'adds the default locale to imports that lack it',
        SNIPPETS,
        `---
title: "Reusable snippets"
---

import Component1 from '/snippets/intro.mdx';
import Component2 from '/snippets/en/existing.mdx';
import Component3 from "/snippets/advanced/outro.mdx";

<Component1 />`,
        `---
title: "Reusable snippets"
---

import Component1 from '/snippets/en/intro.mdx';
import Component2 from '/snippets/en/existing.mdx';
import Component3 from "/snippets/en/advanced/outro.mdx";

<Component1 />`,
      ],
      [
        'removes the default locale from imports when it is hidden',
        SNIPPETS_HIDDEN,
        `
import Component1 from '/snippets/en/intro.mdx';
import Component2 from '/snippets/existing.mdx';
import Component3 from "/snippets/en/advanced/outro.mdx";
`,
        `
import Component1 from '/snippets/intro.mdx';
import Component2 from '/snippets/existing.mdx';
import Component3 from "/snippets/advanced/outro.mdx";
`,
      ],
      [
        'respects exclusions',
        { ...SNIPPETS, excludeStaticImports: ['/snippets/excluded.mdx'] },
        `
import Component1 from '/snippets/intro.mdx';
import Component2 from '/snippets/excluded.mdx';
`,
        `
import Component1 from '/snippets/en/intro.mdx';
import Component2 from '/snippets/excluded.mdx';
`,
      ],
    ])('%s', async (_name, options, content, expected) => {
      expect(await localize(content, options, { locale: 'en' })).toBe(expected);
    });

    it('uses the configured default locale', async () => {
      expect(
        await localize(
          `import Component from '/snippets/component.mdx';`,
          SNIPPETS,
          { locale: 'fr', defaultLocale: 'fr' }
        )
      ).toBe(`import Component from '/snippets/fr/component.mdx';`);
    });
  });

  describe('excludeStaticImports', () => {
    it.each<[string, Options, string, string]>([
      [
        'skips imports matching exact paths and globs',
        {
          ...COMPONENTS,
          excludeStaticImports: [
            '/components/en/images.mdx',
            '/components/en/snippets/**',
          ],
        },
        `
import Guide from '/components/en/guide.mdx'
import Images from '/components/en/images.mdx'
import Snippet from '/components/en/snippets/code.mdx'
`,
        `
import Guide from '/components/ja/guide.mdx'
import Images from '/components/en/images.mdx'
import Snippet from '/components/en/snippets/code.mdx'
`,
      ],
      [
        'resolves [locale] in globs to the default locale',
        {
          ...COMPONENTS,
          excludeStaticImports: ['/components/[locale]/{images,assets}/**'],
        },
        `
import Image1 from '/components/en/images/photos/photo1.mdx'
import Asset from '/components/en/assets/logo.mdx'
import Guide from '/components/en/guide.mdx'
`,
        `
import Image1 from '/components/en/images/photos/photo1.mdx'
import Asset from '/components/en/assets/logo.mdx'
import Guide from '/components/ja/guide.mdx'
`,
      ],
      [
        'matches unprefixed paths when the default locale is hidden',
        {
          ...COMPONENTS_HIDDEN,
          excludeStaticImports: [
            '/components/images.mdx',
            '/components/snippets/**',
            '/components/[locale]/assets/**',
          ],
        },
        `
import Index from '/components'
import Images from '/components/images.mdx'
import Snippet from '/components/snippets/code.mdx'
import Asset from '/components/en/assets/logo.mdx'
`,
        `
import Index from '/components/ja'
import Images from '/components/images.mdx'
import Snippet from '/components/snippets/code.mdx'
import Asset from '/components/en/assets/logo.mdx'
`,
      ],
    ])('%s', async (_name, options, content, expected) => {
      expect(await localize(content, options)).toBe(expected);
    });
  });

  // Content MDX cannot parse falls back to matching import statements as text.
  describe('pages with invalid MDX', () => {
    it.each([
      [
        'a closing tag with no opening tag',
        `</Component>
import ValidComponent from '/components/en/valid.mdx'`,
      ],
      [
        'an unclosed JSX tag',
        `<Card title="Test">
import Component from '/components/en/test.mdx'
<!-- Missing closing tag for Card -->`,
      ],
      [
        'an invalid JSX attribute',
        `<Card title=invalid-attribute>
  import Component from '/components/en/test.mdx'
</Card>`,
      ],
      [
        'mismatched tags around several imports',
        `import Component from '/components/en/valid.mdx'
<Card>
  <nested-tag without-proper-closing>
    import AnotherComponent from '/components/en/another.mdx'
  </different-closing-tag>
</Card`,
      ],
    ])('still localizes imports in a page with %s', async (_name, content) => {
      expect(await localize(content, COMPONENTS)).toBe(
        content.replaceAll('/components/en/', '/components/ja/')
      );
    });
  });

  describe('missing import targets', () => {
    it('leaves an import alone when its localized file does not exist', async () => {
      const content = `
import ExistingComponent from '/components/en/existing.mdx'
import MissingComponent from '/components/en/missing.mdx'
`;

      expect(
        await localize(content, COMPONENTS, {
          importExists: (file) => !file.endsWith('missing.mdx'),
        })
      ).toBe(`
import ExistingComponent from '/components/ja/existing.mdx'
import MissingComponent from '/components/en/missing.mdx'
`);
    });

    it.each([
      [
        'root-relative imports against the working directory',
        COMPONENTS,
        `import Component from '/components/en/component.mdx'`,
        path.join(process.cwd(), 'components/ja/component.mdx'),
        `import Component from '/components/ja/component.mdx'`,
      ],
      [
        'relative imports against the importing page',
        { docsImportPattern: '../[locale]/' },
        `import Component from '../en/component.mdx'`,
        path.resolve('/project/subdir/ja/component.mdx'),
        `import Component from '../ja/component.mdx'`,
      ],
    ])('resolves %s', async (_name, options, content, target, expected) => {
      const page = '/project/subdir/pages/test.mdx';

      expect(
        await localize(content, options, {
          page,
          importExists: (file) => file === target,
        })
      ).toBe(expected);
      vi.mocked(fs.promises.writeFile).mockClear();
      expect(
        await localize(content, options, { page, importExists: () => false })
      ).toBe(content);
    });
  });
});
