import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateSettings } from '../../../../config/generateSettings.js';
import { localizeMintlifyRedirects } from '../localizeMintlifyRedirects.js';

const ORIGINAL_CWD = process.cwd();
const LOCALES = ['fr-ca', 'ja-jp'];

type Redirect = { source: string; destination: string; permanent?: boolean };

/** Orphaned file names for pages under docs/, as the upload step reports them. */
const removed = (...names: string[]) => names.map((name) => `docs/${name}.mdx`);

/**
 * Mirrors the auth0 setup: locale directories inside docs/, locale codes from
 * customMapping, a hidden default locale, no `framework` field, and docs.json
 * not translated.
 */
const gtConfig = (options: Record<string, unknown> = {}) => ({
  defaultLocale: 'en',
  locales: LOCALES,
  customMapping: {
    'fr-ca': { code: 'fr-CA', name: 'French (Canada)' },
    'ja-jp': { code: 'ja', name: 'Japanese' },
  },
  files: {
    mdx: {
      include: ['./docs/**/*.mdx'],
      exclude: ['./docs/[locales]/**'],
      transform: [{ match: '^(docs/)(.*)$', replace: 'docs/{locale}/$2' }],
    },
  },
  options: {
    mintlify: { localizeRedirects: true },
    docsUrlPattern: '/docs/[locale]',
    experimentalHideDefaultLocale: true,
    ...options,
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

  const setup = (redirects: unknown, config: object = gtConfig()) => {
    writeJson('gt.config.json', config);
    writeJson('docs.json', {
      $schema: 'https://mintlify.com/docs.json',
      name: 'Docs',
      ...(redirects !== undefined && { redirects }),
    });
  };

  const run = async (orphanedFileNames: string[]) => {
    const settings = await generateSettings({}, dir, { requireConfig: true });
    return localizeMintlifyRedirects(settings, orphanedFileNames);
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

  it('adds a redirect per locale directly after a renamed page’s English redirect', async () => {
    setup([
      { source: '/docs/unrelated', destination: '/docs/new' },
      { source: '/docs/old', destination: '/docs/new' },
      { source: '/docs/another', destination: '/docs/new' },
    ]);
    page('new');

    const added = await run(removed('old'));

    expect(readRedirects()).toEqual([
      { source: '/docs/unrelated', destination: '/docs/new' },
      { source: '/docs/old', destination: '/docs/new' },
      { source: '/docs/fr-ca/old', destination: '/docs/fr-ca/new' },
      { source: '/docs/ja-jp/old', destination: '/docs/ja-jp/new' },
      { source: '/docs/another', destination: '/docs/new' },
    ]);
    expect(added).toHaveLength(2);
  });

  it('localizes a redirect from a removed page', async () => {
    setup([{ source: '/docs/removed', destination: '/docs/overview' }]);
    page('overview');

    await run(removed('removed'));

    expect(readRedirects().slice(1)).toEqual([
      { source: '/docs/fr-ca/removed', destination: '/docs/fr-ca/overview' },
      { source: '/docs/ja-jp/removed', destination: '/docs/ja-jp/overview' },
    ]);
  });

  it('keeps anchors and permanent', async () => {
    setup([
      { source: '/docs/old', destination: '/docs/new#setup', permanent: true },
    ]);
    page('new');

    await run(removed('old'));

    expect(readRedirects()[1]).toEqual({
      source: '/docs/fr-ca/old',
      destination: '/docs/fr-ca/new#setup',
      permanent: true,
    });
  });

  it('matches index pages and URLs regardless of leading or trailing slashes', async () => {
    setup([{ source: 'docs/guides/', destination: '/docs/tutorials/' }]);
    page('tutorials/index');

    await run(removed('guides/index'));

    expect(readRedirects()[1]).toEqual({
      source: '/docs/fr-ca/guides',
      destination: '/docs/fr-ca/tutorials',
    });
  });

  it('matches explicit /index spellings of index pages', async () => {
    setup([
      { source: '/docs/guides/index', destination: '/docs/tutorials/index' },
    ]);
    page('tutorials/index');

    await run(removed('guides/index'));

    expect(readRedirects()[1]).toEqual({
      source: '/docs/fr-ca/guides',
      destination: '/docs/fr-ca/tutorials',
    });
  });

  it('replaces the default locale segment when the default locale is not hidden', async () => {
    setup([{ source: '/en/old', destination: '/en/new' }], {
      defaultLocale: 'en',
      locales: ['fr'],
      files: { mdx: { include: ['./[locale]/**/*.mdx'] } },
      options: {
        mintlify: { localizeRedirects: true },
        docsUrlPattern: '/[locale]',
      },
    });
    write('en/new.mdx', '# new\n');
    write('fr/new.mdx', '# nouveau\n');

    await run(['en/old.mdx']);

    expect(readRedirects()[1]).toEqual({
      source: '/fr/old',
      destination: '/fr/new',
    });
  });

  it('skips a source outside docsUrlPattern', async () => {
    const config = gtConfig();
    setup([{ source: '/guides/old', destination: '/docs/new' }], config);
    page('new');

    // docsUrlPattern only places the locale under /docs/
    const added = await run(['guides/old.mdx']);

    expect(added).toEqual([]);
  });

  it('never writes a localized redirect to itself', async () => {
    // guide/index.mdx moved to guide.mdx, which keeps the same URL
    setup([{ source: '/docs/guide/index', destination: '/docs/guide' }]);
    page('guide');
    const before = read('docs.json');

    await run(removed('guide/index'));

    expect(read('docs.json')).toBe(before);
  });

  it('ignores orphaned files that are not pages', async () => {
    setup([{ source: '/docs/spec', destination: '/docs/new' }]);
    page('new');
    const before = read('docs.json');

    await run(['docs/spec.json']);

    expect(read('docs.json')).toBe(before);
  });

  it('leaves redirects alone whose source was not orphaned', async () => {
    setup([
      { source: '/docs/legacy', destination: '/docs/edited' },
      { source: '/docs/other', destination: '/docs/overview' },
    ]);
    page('edited');
    page('overview');
    const before = read('docs.json');

    // "edited" only changed, so it is not orphaned; "unmatched" has no redirect
    await run(removed('unmatched'));
    await run([]);

    expect(read('docs.json')).toBe(before);
  });

  it('skips locales missing the destination’s translation', async () => {
    setup([
      { source: '/docs/old', destination: '/docs/new' },
      { source: '/docs/old', destination: 'https://example.com/new' },
    ]);
    page('new', ['ja-jp']);

    const added = await run(removed('old'));

    expect(added).toEqual([
      { source: '/docs/ja-jp/old', destination: '/docs/ja-jp/new' },
    ]);
  });

  it('never duplicates or overwrites an existing localized redirect', async () => {
    setup([
      { source: '/docs/old', destination: '/docs/new' },
      { source: '/docs/old', destination: '/docs/new' },
      { source: '/docs/fr-ca/old/', destination: '/docs/fr-ca/custom' },
    ]);
    page('new');

    await run(removed('old'));
    const afterFirst = read('docs.json');
    const second = await run(removed('old'));

    expect(readRedirects()).toEqual([
      { source: '/docs/old', destination: '/docs/new' },
      { source: '/docs/ja-jp/old', destination: '/docs/ja-jp/new' },
      { source: '/docs/old', destination: '/docs/new' },
      { source: '/docs/fr-ca/old/', destination: '/docs/fr-ca/custom' },
    ]);
    expect(second).toEqual([]);
    expect(read('docs.json')).toBe(afterFirst);
  });

  it('writes to the file docs.json references with $ref', async () => {
    setup({ $ref: './config/redirects.json' });
    writeJson('config/redirects.json', [
      { source: '/docs/old', destination: '/docs/new' },
    ]);
    page('new');
    const docsJsonBefore = read('docs.json');

    await run(removed('old'));

    expect(read('docs.json')).toBe(docsJsonBefore);
    expect(readRedirects('config/redirects.json')).toHaveLength(3);
  });

  it('follows a chain of $ref files to the redirects array', async () => {
    setup({ $ref: './config/redirects.json' });
    writeJson('config/redirects.json', { $ref: './generated/redirects.json' });
    writeJson('config/generated/redirects.json', [
      { source: '/docs/old', destination: '/docs/new' },
    ]);
    page('new');

    await run(removed('old'));

    expect(readRedirects('config/generated/redirects.json')).toHaveLength(3);
  });

  it('stops at a $ref cycle', async () => {
    setup({ $ref: './a.json' });
    writeJson('a.json', { $ref: './b.json' });
    writeJson('b.json', { $ref: './a.json' });
    page('new');

    expect(await run(removed('old'))).toEqual([]);
  });

  it('does nothing unless localizeRedirects is enabled', async () => {
    setup(
      [{ source: '/docs/old', destination: '/docs/new' }],
      gtConfig({ mintlify: {} })
    );
    page('new');
    const before = read('docs.json');

    expect(await run(removed('old'))).toEqual([]);
    expect(read('docs.json')).toBe(before);
  });

  it('does nothing without docsUrlPattern', async () => {
    setup(
      [{ source: '/docs/old', destination: '/docs/new' }],
      gtConfig({ docsUrlPattern: undefined })
    );
    page('new');

    expect(await run(removed('old'))).toEqual([]);
  });

  it('does nothing without docs.json redirects', async () => {
    setup(undefined);
    page('new');
    const before = read('docs.json');

    expect(await run(removed('old'))).toEqual([]);
    expect(read('docs.json')).toBe(before);
  });
});
