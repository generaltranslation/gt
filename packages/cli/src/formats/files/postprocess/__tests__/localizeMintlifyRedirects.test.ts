import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateSettings } from '../../../../config/generateSettings.js';
import { createFileMapping } from '../../fileMapping.js';
import {
  localizeMintlifyRedirects,
  type MintlifyRedirectSignals,
} from '../localizeMintlifyRedirects.js';

const ORIGINAL_CWD = process.cwd();
const LOCALES = ['fr-ca', 'ja-jp'];

type Redirect = { source: string; destination: string; permanent?: boolean };

const NO_SIGNALS: MintlifyRedirectSignals = {
  movedFiles: [],
  newFileNames: [],
  orphanedFileNames: [],
};
const signals = (
  partial: Partial<MintlifyRedirectSignals>
): MintlifyRedirectSignals => ({ ...NO_SIGNALS, ...partial });

/**
 * Mirrors the auth0 setup: locale directories inside docs/, locale codes from
 * customMapping, docs.json composed with $ref, and no `framework` field.
 */
const gtConfig = (
  overrides: { options?: Record<string, unknown> } & Record<
    string,
    unknown
  > = {}
) => ({
  framework: 'mintlify',
  defaultLocale: 'en',
  locales: LOCALES,
  customMapping: {
    'fr-ca': { code: 'fr-CA', name: 'French (Canada)' },
    'ja-jp': { code: 'ja', name: 'Japanese' },
  },
  files: {
    json: { include: ['./docs.json'] },
    mdx: {
      include: ['./docs/**/*.mdx'],
      exclude: ['./docs/[locales]/**'],
      transform: [{ match: '^(docs/)(.*)$', replace: 'docs/{locale}/$2' }],
    },
  },
  ...overrides,
  options: {
    jsonSchema: { './docs.json': { preset: 'mintlify' } },
    mintlify: { localizeRedirects: true },
    ...overrides.options,
  },
});

describe('localizeMintlifyRedirects', () => {
  let dir: string;

  const write = (file: string, content: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), content);
  };
  const writeJson = (file: string, value: unknown) =>
    write(file, JSON.stringify(value, null, 2));
  const read = (file: string) => fs.readFileSync(path.join(dir, file), 'utf8');
  const readRedirects = (file = 'docs.json'): Redirect[] => {
    const json = JSON.parse(read(file));
    return Array.isArray(json) ? json : json.redirects;
  };

  /** English page plus its translations (every locale unless given). */
  const page = (name: string, locales: string[] = LOCALES) => {
    write(`docs/${name}.mdx`, `# ${name}\n`);
    for (const locale of locales) {
      write(`docs/${locale}/${name}.mdx`, `# ${name} (${locale})\n`);
    }
  };

  /** Translations left on disk after their English page was removed. */
  const staleTranslation = (name: string, locales: string[] = LOCALES) => {
    for (const locale of locales) {
      write(`docs/${locale}/${name}.mdx`, `# ${name} (${locale})\n`);
    }
  };

  const setup = ({
    redirects,
    config = gtConfig(),
  }: {
    redirects?: unknown;
    config?: Record<string, unknown>;
  }) => {
    writeJson('gt.config.json', config);
    writeJson('docs.json', {
      $schema: 'https://mintlify.com/docs.json',
      name: 'Docs',
      navigation: { languages: [{ language: 'en', pages: [] }] },
      ...(redirects !== undefined && { redirects }),
    });
  };

  const run = async (runSignals: MintlifyRedirectSignals) => {
    const settings = await generateSettings({}, dir, { requireConfig: true });
    return await localizeMintlifyRedirects(settings, runSignals);
  };

  beforeEach(() => {
    dir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'gt-redirects-'))
    );
    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(ORIGINAL_CWD);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  describe('fixture', () => {
    it('maps English pages into locale directories named by the configured codes', async () => {
      setup({ redirects: [] });
      page('get-started');
      const settings = await generateSettings({}, dir, {
        requireConfig: true,
      });
      const mapping = createFileMapping(
        settings.files.resolvedPaths,
        settings.files.placeholderPaths,
        settings.files.transformPaths,
        settings.files.transformFormats,
        settings.locales,
        settings.defaultLocale
      );

      expect(settings.files.resolvedPaths.mdx).toEqual([
        path.join(dir, 'docs/get-started.mdx'),
      ]);
      expect(mapping['fr-ca']['docs/get-started.mdx']).toBe(
        path.join('docs', 'fr-ca', 'get-started.mdx')
      );
      expect(mapping['ja-jp']['docs/get-started.mdx']).toBe(
        path.join('docs', 'ja-jp', 'get-started.mdx')
      );
    });
  });

  describe('renamed pages (detected moves)', () => {
    it('adds a redirect per locale directly after the English redirect', async () => {
      setup({
        redirects: [
          { source: '/docs/unrelated', destination: '/docs/elsewhere' },
          {
            source: '/docs/get-started',
            destination: '/docs/how-to-get-started',
          },
          { source: '/docs/another', destination: '/docs/elsewhere' },
        ],
      });
      page('how-to-get-started');

      const report = await run(
        signals({
          movedFiles: [
            {
              oldFileName: 'docs/get-started.mdx',
              newFileName: 'docs/how-to-get-started.mdx',
            },
          ],
        })
      );

      expect(readRedirects()).toEqual([
        { source: '/docs/unrelated', destination: '/docs/elsewhere' },
        {
          source: '/docs/get-started',
          destination: '/docs/how-to-get-started',
        },
        {
          source: '/docs/fr-ca/get-started',
          destination: '/docs/fr-ca/how-to-get-started',
        },
        {
          source: '/docs/ja-jp/get-started',
          destination: '/docs/ja-jp/how-to-get-started',
        },
        { source: '/docs/another', destination: '/docs/elsewhere' },
      ]);
      expect(report.added).toEqual([
        {
          locale: 'fr-ca',
          source: '/docs/fr-ca/get-started',
          destination: '/docs/fr-ca/how-to-get-started',
        },
        {
          locale: 'ja-jp',
          source: '/docs/ja-jp/get-started',
          destination: '/docs/ja-jp/how-to-get-started',
        },
      ]);
      expect(report.skipped).toEqual([]);
    });

    it('localizes the destination the writer chose, even when it is not the renamed page', async () => {
      setup({
        redirects: [{ source: '/docs/old', destination: '/docs/overview' }],
      });
      page('new');
      page('overview');

      await run(
        signals({
          movedFiles: [
            { oldFileName: 'docs/old.mdx', newFileName: 'docs/new.mdx' },
          ],
        })
      );

      expect(readRedirects()).toEqual([
        { source: '/docs/old', destination: '/docs/overview' },
        { source: '/docs/fr-ca/old', destination: '/docs/fr-ca/overview' },
        { source: '/docs/ja-jp/old', destination: '/docs/ja-jp/overview' },
      ]);
    });

    it('keeps anchors on the destination', async () => {
      setup({
        redirects: [{ source: '/docs/old', destination: '/docs/new#setup' }],
      });
      page('new');

      await run(
        signals({
          movedFiles: [
            { oldFileName: 'docs/old.mdx', newFileName: 'docs/new.mdx' },
          ],
        })
      );

      expect(readRedirects().slice(1)).toEqual([
        { source: '/docs/fr-ca/old', destination: '/docs/fr-ca/new#setup' },
        { source: '/docs/ja-jp/old', destination: '/docs/ja-jp/new#setup' },
      ]);
    });

    it('copies permanent when the English redirect sets it and omits it otherwise', async () => {
      setup({
        redirects: [
          { source: '/docs/a', destination: '/docs/a2', permanent: false },
          { source: '/docs/b', destination: '/docs/b2' },
        ],
      });
      page('a2');
      page('b2');

      await run(
        signals({
          movedFiles: [
            { oldFileName: 'docs/a.mdx', newFileName: 'docs/a2.mdx' },
            { oldFileName: 'docs/b.mdx', newFileName: 'docs/b2.mdx' },
          ],
        })
      );

      const localized = readRedirects().filter((r) =>
        r.source.startsWith('/docs/fr-ca/')
      );
      expect(localized).toEqual([
        {
          source: '/docs/fr-ca/a',
          destination: '/docs/fr-ca/a2',
          permanent: false,
        },
        { source: '/docs/fr-ca/b', destination: '/docs/fr-ca/b2' },
      ]);
    });

    it('matches index pages by their folder URL', async () => {
      setup({
        redirects: [{ source: '/docs/guides', destination: '/docs/tutorials' }],
      });
      page('tutorials/index');

      await run(
        signals({
          movedFiles: [
            {
              oldFileName: 'docs/guides/index.mdx',
              newFileName: 'docs/tutorials/index.mdx',
            },
          ],
        })
      );

      expect(readRedirects().slice(1)).toEqual([
        { source: '/docs/fr-ca/guides', destination: '/docs/fr-ca/tutorials' },
        { source: '/docs/ja-jp/guides', destination: '/docs/ja-jp/tutorials' },
      ]);
    });

    it('treats .md pages like .mdx pages', async () => {
      const config = gtConfig({
        files: {
          json: { include: ['./docs.json'] },
          md: {
            include: ['./docs/**/*.md'],
            exclude: ['./docs/[locales]/**'],
            transform: [
              { match: '^(docs/)(.*)$', replace: 'docs/{locale}/$2' },
            ],
          },
        },
      });
      setup({
        config,
        redirects: [{ source: '/docs/old', destination: '/docs/new' }],
      });
      write('docs/new.md', '# new\n');
      for (const locale of LOCALES) write(`docs/${locale}/new.md`, '# new\n');

      await run(
        signals({
          movedFiles: [
            { oldFileName: 'docs/old.md', newFileName: 'docs/new.md' },
          ],
        })
      );

      expect(readRedirects()).toHaveLength(3);
    });

    it('does nothing when the renamed page has no English redirect', async () => {
      setup({
        redirects: [{ source: '/docs/unrelated', destination: '/docs/new' }],
      });
      page('new');

      const report = await run(
        signals({
          movedFiles: [
            { oldFileName: 'docs/old.mdx', newFileName: 'docs/new.mdx' },
          ],
        })
      );

      expect(readRedirects()).toEqual([
        { source: '/docs/unrelated', destination: '/docs/new' },
      ]);
      expect(report.added).toEqual([]);
    });

    it('ignores moves of files that are not pages', async () => {
      setup({
        redirects: [
          { source: '/openapi/old', destination: '/openapi/new' },
          { source: '/openapi/old.json', destination: '/openapi/new.json' },
        ],
      });

      const report = await run(
        signals({
          movedFiles: [
            {
              oldFileName: 'openapi/old.json',
              newFileName: 'openapi/new.json',
            },
          ],
        })
      );

      expect(readRedirects()).toHaveLength(2);
      expect(report.added).toEqual([]);
      expect(report.skipped).toEqual([]);
    });
  });

  describe('new pages (renamed with edits)', () => {
    it('localizes a redirect whose destination is a page that is new in this run', async () => {
      setup({
        redirects: [
          {
            source: '/docs/get-started',
            destination: '/docs/how-to-get-started',
          },
        ],
      });
      page('how-to-get-started');

      await run(signals({ newFileNames: ['docs/how-to-get-started.mdx'] }));

      expect(readRedirects().slice(1)).toEqual([
        {
          source: '/docs/fr-ca/get-started',
          destination: '/docs/fr-ca/how-to-get-started',
        },
        {
          source: '/docs/ja-jp/get-started',
          destination: '/docs/ja-jp/how-to-get-started',
        },
      ]);
    });

    it('matches the new page against destinations that carry an anchor', async () => {
      setup({
        redirects: [{ source: '/docs/old', destination: '/docs/new#intro' }],
      });
      page('new');

      await run(signals({ newFileNames: ['docs/new.mdx'] }));

      expect(readRedirects().slice(1)).toEqual([
        { source: '/docs/fr-ca/old', destination: '/docs/fr-ca/new#intro' },
        { source: '/docs/ja-jp/old', destination: '/docs/ja-jp/new#intro' },
      ]);
    });

    it('ignores legacy redirects that point at pages that were only edited', async () => {
      setup({
        redirects: [
          { source: '/docs/legacy-a', destination: '/docs/edited' },
          { source: '/docs/legacy-b', destination: '/docs/edited#section' },
        ],
      });
      page('edited');
      page('brand-new');

      // "edited" got a new version this run, so it is not a new page
      const report = await run(
        signals({ newFileNames: ['docs/brand-new.mdx'] })
      );

      expect(readRedirects()).toEqual([
        { source: '/docs/legacy-a', destination: '/docs/edited' },
        { source: '/docs/legacy-b', destination: '/docs/edited#section' },
      ]);
      expect(report.added).toEqual([]);
      expect(report.skipped).toEqual([]);
    });
  });

  describe('deleted pages (orphans)', () => {
    it('localizes a redirect whose source is an orphaned page', async () => {
      setup({
        redirects: [{ source: '/docs/removed', destination: '/docs/overview' }],
      });
      page('overview');

      await run(signals({ orphanedFileNames: ['docs/removed.mdx'] }));

      expect(readRedirects().slice(1)).toEqual([
        { source: '/docs/fr-ca/removed', destination: '/docs/fr-ca/overview' },
        { source: '/docs/ja-jp/removed', destination: '/docs/ja-jp/overview' },
      ]);
    });

    it('still adds the redirect when stale translations of the removed page are on disk', async () => {
      setup({
        redirects: [{ source: '/docs/removed', destination: '/docs/overview' }],
      });
      page('overview');
      staleTranslation('removed');

      await run(signals({ orphanedFileNames: ['docs/removed.mdx'] }));

      expect(readRedirects()).toHaveLength(3);
    });

    it('skips orphans whose English page still exists (excluded, not deleted)', async () => {
      const config = gtConfig();
      config.files.mdx.exclude.push('./docs/kept.mdx');
      setup({
        config,
        redirects: [{ source: '/docs/kept', destination: '/docs/overview' }],
      });
      page('overview');
      page('kept');

      const report = await run(
        signals({ orphanedFileNames: ['docs/kept.mdx'] })
      );

      expect(readRedirects()).toHaveLength(1);
      expect(report.skipped).toEqual([
        {
          source: '/docs/kept',
          destination: '/docs/overview',
          reason: 'source-is-a-page',
        },
      ]);
    });

    it('ignores orphaned files that are not pages', async () => {
      setup({
        redirects: [
          { source: '/snippets/data', destination: '/docs/overview' },
        ],
      });
      page('overview');

      await run(signals({ orphanedFileNames: ['snippets/data.json'] }));

      expect(readRedirects()).toHaveLength(1);
    });

    it('does nothing for orphans without a redirect', async () => {
      setup({
        redirects: [{ source: '/docs/other', destination: '/docs/overview' }],
      });
      page('overview');

      const report = await run(
        signals({ orphanedFileNames: ['docs/removed.mdx'] })
      );

      expect(readRedirects()).toHaveLength(1);
      expect(report.added).toEqual([]);
      expect(report.skipped).toEqual([]);
    });
  });

  describe('legacy redirects', () => {
    it('leaves every redirect alone without signals, even when every localized page exists', async () => {
      // What a --force-download run or a deleted lockfile looks like: nothing
      // was renamed, added, or removed in this run.
      const legacy = [
        { source: '/docs/a', destination: '/docs/overview' },
        { source: '/docs/b', destination: '/docs/guide' },
        { source: '/docs/c/:slug*', destination: '/docs/guide/:slug*' },
      ];
      setup({ redirects: legacy });
      page('overview');
      page('guide');
      const before = read('docs.json');

      const report = await run(NO_SIGNALS);

      expect(read('docs.json')).toBe(before);
      expect(report).toEqual({ added: [], skipped: [] });
    });

    it('only reports on redirects that a signal matched', async () => {
      setup({
        redirects: [
          { source: '/docs/legacy', destination: 'https://example.com' },
          { source: '/docs/legacy-2', destination: '/docs/missing' },
          { source: '/docs/old', destination: '/docs/new' },
        ],
      });
      page('new');

      const report = await run(
        signals({
          movedFiles: [
            { oldFileName: 'docs/old.mdx', newFileName: 'docs/new.mdx' },
          ],
        })
      );

      expect(report.added).toHaveLength(2);
      expect(report.skipped).toEqual([]);
    });
  });

  describe('skips', () => {
    it('does not duplicate or overwrite an existing localized redirect', async () => {
      setup({
        redirects: [
          { source: '/docs/old', destination: '/docs/new' },
          { source: '/docs/fr-ca/old', destination: '/docs/fr-ca/custom' },
        ],
      });
      page('new');
      page('custom', ['fr-ca']);

      const report = await run(
        signals({
          movedFiles: [
            { oldFileName: 'docs/old.mdx', newFileName: 'docs/new.mdx' },
          ],
        })
      );

      expect(readRedirects()).toEqual([
        { source: '/docs/old', destination: '/docs/new' },
        { source: '/docs/ja-jp/old', destination: '/docs/ja-jp/new' },
        { source: '/docs/fr-ca/old', destination: '/docs/fr-ca/custom' },
      ]);
      expect(report.skipped).toEqual([
        {
          source: '/docs/old',
          destination: '/docs/new',
          locale: 'fr-ca',
          reason: 'localized-source-taken',
        },
      ]);
    });

    it('treats a taken localized source as taken regardless of trailing slash', async () => {
      setup({
        redirects: [
          { source: '/docs/old', destination: '/docs/new' },
          { source: '/docs/fr-ca/old/', destination: '/docs/fr-ca/new' },
        ],
      });
      page('new');

      await run(
        signals({
          movedFiles: [
            { oldFileName: 'docs/old.mdx', newFileName: 'docs/new.mdx' },
          ],
        })
      );

      expect(
        readRedirects().filter((r) => r.source.startsWith('/docs/fr-ca/'))
      ).toHaveLength(1);
    });

    it('skips only the locales whose translated destination is missing', async () => {
      setup({
        redirects: [{ source: '/docs/old', destination: '/docs/new' }],
      });
      page('new', ['fr-ca']);

      const report = await run(
        signals({
          movedFiles: [
            { oldFileName: 'docs/old.mdx', newFileName: 'docs/new.mdx' },
          ],
        })
      );

      expect(readRedirects()).toEqual([
        { source: '/docs/old', destination: '/docs/new' },
        { source: '/docs/fr-ca/old', destination: '/docs/fr-ca/new' },
      ]);
      expect(report.skipped).toEqual([
        {
          source: '/docs/old',
          destination: '/docs/new',
          locale: 'ja-jp',
          reason: 'localized-destination-missing',
        },
      ]);
    });

    it('skips destinations that are not pages, such as redirect chains or typos', async () => {
      setup({
        redirects: [
          { source: '/docs/removed', destination: '/docs/moved-again' },
          { source: '/docs/moved-again', destination: '/docs/overview' },
        ],
      });
      page('overview');

      const report = await run(
        signals({ orphanedFileNames: ['docs/removed.mdx'] })
      );

      expect(readRedirects()).toHaveLength(2);
      expect(report.skipped).toEqual([
        {
          source: '/docs/removed',
          destination: '/docs/moved-again',
          reason: 'destination-not-a-page',
        },
      ]);
    });

    it('skips external destinations', async () => {
      setup({
        redirects: [
          {
            source: '/docs/removed',
            destination: 'https://example.com/docs',
          },
        ],
      });

      const report = await run(
        signals({ orphanedFileNames: ['docs/removed.mdx'] })
      );

      expect(readRedirects()).toHaveLength(1);
      expect(report.skipped).toEqual([
        {
          source: '/docs/removed',
          destination: 'https://example.com/docs',
          reason: 'external-destination',
        },
      ]);
    });

    it.each([
      ['a trailing wildcard', '/docs/new/:slug*'],
      ['a partial wildcard', '/docs/new-*'],
    ])('skips destinations with %s', async (_label, destination) => {
      setup({ redirects: [{ source: '/docs/removed', destination }] });
      page('new');

      const report = await run(
        signals({ orphanedFileNames: ['docs/removed.mdx'] })
      );

      expect(readRedirects()).toHaveLength(1);
      expect(report.skipped).toEqual([
        { source: '/docs/removed', destination, reason: 'wildcard' },
      ]);
    });

    it('never matches wildcard sources', async () => {
      setup({
        redirects: [
          { source: '/docs/:slug*', destination: '/docs/new' },
          { source: '/docs/old*', destination: '/docs/new' },
        ],
      });
      page('new');

      const report = await run(
        signals({
          movedFiles: [
            { oldFileName: 'docs/old.mdx', newFileName: 'docs/new.mdx' },
          ],
          newFileNames: ['docs/new.mdx'],
        })
      );

      expect(readRedirects()).toHaveLength(2);
      expect(report.added).toEqual([]);
    });

    it('leaves malformed redirect entries alone', async () => {
      const malformed = [
        { source: '/docs/old' },
        { destination: '/docs/new' },
        { source: 42, destination: '/docs/new' },
        'not-an-object',
        null,
      ];
      setup({
        redirects: [
          ...malformed,
          { source: '/docs/old', destination: '/docs/new' },
        ],
      });
      page('new');

      await run(
        signals({
          movedFiles: [
            { oldFileName: 'docs/old.mdx', newFileName: 'docs/new.mdx' },
          ],
        })
      );

      const result = JSON.parse(read('docs.json')).redirects;
      expect(result.slice(0, malformed.length)).toEqual(malformed);
      expect(result).toHaveLength(malformed.length + 3);
    });
  });

  describe('URL matching', () => {
    it('tolerates trailing slashes and keeps the English formatting', async () => {
      setup({
        redirects: [{ source: '/docs/old/', destination: '/docs/new/' }],
      });
      page('new');

      await run(
        signals({
          movedFiles: [
            { oldFileName: 'docs/old.mdx', newFileName: 'docs/new.mdx' },
          ],
        })
      );

      expect(readRedirects().slice(1)).toEqual([
        { source: '/docs/fr-ca/old/', destination: '/docs/fr-ca/new/' },
        { source: '/docs/ja-jp/old/', destination: '/docs/ja-jp/new/' },
      ]);
    });

    it('tolerates a missing leading slash and keeps the English formatting', async () => {
      setup({
        redirects: [{ source: 'docs/old', destination: 'docs/new' }],
      });
      page('new');

      await run(
        signals({
          movedFiles: [
            { oldFileName: 'docs/old.mdx', newFileName: 'docs/new.mdx' },
          ],
        })
      );

      expect(readRedirects().slice(1)).toEqual([
        { source: 'docs/fr-ca/old', destination: 'docs/fr-ca/new' },
        { source: 'docs/ja-jp/old', destination: 'docs/ja-jp/new' },
      ]);
    });

    it('matches paths case-sensitively', async () => {
      setup({
        redirects: [{ source: '/docs/Old', destination: '/docs/new' }],
      });
      page('new');

      const report = await run(
        signals({
          movedFiles: [
            { oldFileName: 'docs/old.mdx', newFileName: 'docs/new.mdx' },
          ],
        })
      );

      expect(readRedirects()).toHaveLength(1);
      expect(report.added).toEqual([]);
    });

    it('builds URLs relative to the directory that contains docs.json', async () => {
      // Config and pages live in a subfolder, like auth0's main/
      writeJson('main/gt.config.json', gtConfig());
      writeJson('main/docs.json', {
        name: 'Docs',
        redirects: [{ source: '/docs/old', destination: '/docs/new' }],
      });
      write('main/docs/new.mdx', '# new\n');
      for (const locale of LOCALES) {
        write(`main/docs/${locale}/new.mdx`, '# new\n');
      }
      process.chdir(path.join(dir, 'main'));
      const settings = await generateSettings({}, path.join(dir, 'main'), {
        requireConfig: true,
      });

      await localizeMintlifyRedirects(
        settings,
        signals({
          movedFiles: [
            { oldFileName: 'docs/old.mdx', newFileName: 'docs/new.mdx' },
          ],
        })
      );

      expect(readRedirects('main/docs.json')).toHaveLength(3);
    });
  });

  describe('idempotency', () => {
    it('adds nothing when run twice with the same signals', async () => {
      setup({
        redirects: [{ source: '/docs/old', destination: '/docs/new' }],
      });
      page('new');
      const runSignals = signals({
        movedFiles: [
          { oldFileName: 'docs/old.mdx', newFileName: 'docs/new.mdx' },
        ],
      });

      await run(runSignals);
      const afterFirst = read('docs.json');
      const second = await run(runSignals);

      expect(read('docs.json')).toBe(afterFirst);
      expect(second).toEqual({ added: [], skipped: [] });
    });

    it('stays quiet about a removed page whose localized redirects already exist', async () => {
      setup({
        redirects: [
          { source: '/docs/removed', destination: '/docs/new#intro' },
          {
            source: '/docs/fr-ca/removed/',
            destination: '/docs/fr-ca/new#intro',
          },
          {
            source: '/docs/ja-jp/removed',
            destination: '/docs/ja-jp/new#intro',
          },
        ],
      });
      page('new');
      const before = read('docs.json');

      const report = await run(
        signals({ orphanedFileNames: ['docs/removed.mdx'] })
      );

      expect(read('docs.json')).toBe(before);
      expect(report).toEqual({ added: [], skipped: [] });
    });

    it('localizes a redirect once when several signals match it', async () => {
      setup({
        redirects: [{ source: '/docs/old', destination: '/docs/new' }],
      });
      page('new');

      const report = await run(
        signals({
          movedFiles: [
            { oldFileName: 'docs/old.mdx', newFileName: 'docs/new.mdx' },
          ],
          newFileNames: ['docs/new.mdx'],
          orphanedFileNames: ['docs/old.mdx'],
        })
      );

      expect(readRedirects()).toHaveLength(3);
      expect(report.added).toHaveLength(2);
    });

    it('localizes duplicate English redirects once', async () => {
      setup({
        redirects: [
          { source: '/docs/old', destination: '/docs/new' },
          { source: '/docs/old', destination: '/docs/new' },
        ],
      });
      page('new');

      await run(
        signals({
          movedFiles: [
            { oldFileName: 'docs/old.mdx', newFileName: 'docs/new.mdx' },
          ],
        })
      );

      expect(
        readRedirects().filter((r) => r.source === '/docs/fr-ca/old')
      ).toHaveLength(1);
    });
  });

  describe('redirect file location', () => {
    it('writes to the $ref file and leaves docs.json untouched', async () => {
      setup({ redirects: { $ref: './redirects.json' } });
      writeJson('redirects.json', [
        { source: '/docs/old', destination: '/docs/new' },
      ]);
      page('new');
      const docsJsonBefore = read('docs.json');

      await run(
        signals({
          movedFiles: [
            { oldFileName: 'docs/old.mdx', newFileName: 'docs/new.mdx' },
          ],
        })
      );

      expect(read('docs.json')).toBe(docsJsonBefore);
      expect(readRedirects('redirects.json')).toEqual([
        { source: '/docs/old', destination: '/docs/new' },
        { source: '/docs/fr-ca/old', destination: '/docs/fr-ca/new' },
        { source: '/docs/ja-jp/old', destination: '/docs/ja-jp/new' },
      ]);
    });

    it('resolves the $ref relative to docs.json', async () => {
      setup({ redirects: { $ref: './config/redirects.json' } });
      writeJson('config/redirects.json', [
        { source: '/docs/old', destination: '/docs/new' },
      ]);
      page('new');

      await run(
        signals({
          movedFiles: [
            { oldFileName: 'docs/old.mdx', newFileName: 'docs/new.mdx' },
          ],
        })
      );

      expect(readRedirects('config/redirects.json')).toHaveLength(3);
    });

    it('does not create redirects when docs.json has none', async () => {
      setup({});
      page('new');
      const before = read('docs.json');

      const report = await run(
        signals({
          movedFiles: [
            { oldFileName: 'docs/old.mdx', newFileName: 'docs/new.mdx' },
          ],
        })
      );

      expect(read('docs.json')).toBe(before);
      expect(report.added).toEqual([]);
    });

    it('does not rewrite the file when nothing was added', async () => {
      setup({});
      // Compact formatting would change if the file were rewritten
      write(
        'docs.json',
        JSON.stringify({
          name: 'Docs',
          redirects: [{ source: '/docs/old', destination: '/docs/missing' }],
        })
      );
      const before = read('docs.json');

      await run(
        signals({
          movedFiles: [
            { oldFileName: 'docs/old.mdx', newFileName: 'docs/new.mdx' },
          ],
        })
      );

      expect(read('docs.json')).toBe(before);
    });
  });

  describe('opt-in', () => {
    it('does nothing unless localizeRedirects is enabled', async () => {
      setup({
        config: gtConfig({ options: { mintlify: {} } }),
        redirects: [{ source: '/docs/old', destination: '/docs/new' }],
      });
      page('new');
      const before = read('docs.json');

      const report = await run(
        signals({
          movedFiles: [
            { oldFileName: 'docs/old.mdx', newFileName: 'docs/new.mdx' },
          ],
        })
      );

      expect(read('docs.json')).toBe(before);
      expect(report).toEqual({ added: [], skipped: [] });
    });

    it('finds docs.json in the working directory when it is not an included file', async () => {
      setup({
        config: gtConfig({
          files: {
            mdx: gtConfig().files.mdx,
          },
        }),
        redirects: [{ source: '/docs/old', destination: '/docs/new' }],
      });
      page('new');

      const report = await run(
        signals({
          movedFiles: [
            { oldFileName: 'docs/old.mdx', newFileName: 'docs/new.mdx' },
          ],
        })
      );

      expect(report.added.map(({ source }) => source)).toEqual([
        '/docs/fr-ca/old',
        '/docs/ja-jp/old',
      ]);
    });

    it('does nothing without a docs.json', async () => {
      setup({});
      fs.rmSync(path.join(dir, 'docs.json'));
      page('new');

      const report = await run(
        signals({
          movedFiles: [
            { oldFileName: 'docs/old.mdx', newFileName: 'docs/new.mdx' },
          ],
        })
      );

      expect(report).toEqual({ added: [], skipped: [] });
    });
  });
});
