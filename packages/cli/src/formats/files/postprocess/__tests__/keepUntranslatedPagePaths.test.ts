import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateSettings } from '../../../../config/generateSettings.js';
import { keepUntranslatedPagePaths } from '../keepUntranslatedPagePaths.js';

const ORIGINAL_CWD = process.cwd();

describe('keepUntranslatedPagePaths', () => {
  let dir: string;

  const write = (file: string, content: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), content);
  };
  const writeJson = (file: string, value: unknown) =>
    write(file, JSON.stringify(value, null, 2));
  const readJson = (file: string) =>
    JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const run = async (config: Record<string, unknown>) => {
    writeJson('gt.config.json', {
      defaultLocale: 'en',
      locales: ['ja'],
      ...config,
    });
    const settings = await generateSettings({}, dir, { requireConfig: true });
    keepUntranslatedPagePaths(settings);
  };
  const mintlifyConfig = (
    preset: string,
    staticUrls: unknown = { skipUntranslatedPages: true }
  ) => ({
    files: { json: { include: ['./docs.json'] } },
    options: {
      jsonSchema: { './docs.json': { preset } },
      experimentalLocalizeStaticUrls: staticUrls,
    },
  });

  beforeEach(() => {
    dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gt-keep-')));
    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(ORIGINAL_CWD);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('points Mintlify navigation at default-locale pages that were not translated', async () => {
    for (const page of ['guide', 'ja/guide', 'terms', 'overview']) {
      write(`${page}.mdx`, '# Page\n');
    }
    writeJson('docs.json', {
      navigation: {
        languages: [
          {
            language: 'en',
            groups: [
              {
                group: 'Docs',
                root: 'overview',
                pages: ['guide', 'terms', 'GET /models'],
              },
            ],
          },
          {
            language: 'ja',
            groups: [
              {
                group: 'ドキュメント',
                root: 'ja/overview',
                pages: ['ja/guide', 'ja/terms', 'GET /models'],
              },
            ],
          },
        ],
      },
    });

    await run(mintlifyConfig('mintlify-hide-default'));

    const [en, ja] = readJson('docs.json').navigation.languages;
    expect(ja.groups[0].root).toBe('overview');
    expect(ja.groups[0].pages).toEqual(['ja/guide', 'terms', 'GET /models']);
    expect(en.groups[0].pages).toEqual(['guide', 'terms', 'GET /models']);
  });

  it('handles Mintlify sites that show the default locale in URLs', async () => {
    for (const page of ['en/guide', 'ja/guide', 'en/terms']) {
      write(`${page}.mdx`, '# Page\n');
    }
    writeJson('docs.json', {
      navigation: {
        languages: [
          { language: 'en', pages: ['en/guide', 'en/terms'] },
          { language: 'ja', pages: ['ja/guide', 'ja/terms'] },
        ],
      },
    });

    await run(mintlifyConfig('mintlify'));

    const [, ja] = readJson('docs.json').navigation.languages;
    expect(ja.pages).toEqual(['ja/guide', 'en/terms']);
  });

  it('rebases page paths in a per-locale YAML navigation file and leaves non-page values alone', async () => {
    for (const file of [
      'docs/guide.mdx',
      'docs/terms.mdx',
      'translations/ja/guide.mdx',
      'docs/logo.png',
    ]) {
      write(file, 'x');
    }
    const nav = (paths: string[], logo: string) => ({
      logo,
      navigation: [
        { layout: [{ contents: paths.map((p) => ({ page: 'P', path: p })) }] },
      ],
    });
    write(
      'en.yml',
      YAML.stringify(nav(['docs/guide.mdx', 'docs/terms.mdx'], 'docs/logo.png'))
    );
    write(
      'translations/ja.yml',
      YAML.stringify(nav(['./ja/guide.mdx', './ja/terms.mdx'], './ja/logo.png'))
    );

    await run({
      files: {
        yaml: {
          include: ['./en.yml'],
          transform: { match: '^(.*)$', replace: 'translations/{locale}.yml' },
        },
      },
      options: {
        yamlSchema: {
          'en.yml': {
            include: ['$.navigation[*].layout[*].contents[*].page'],
            transform: {
              '$.navigation[*].layout[*].contents[*].path': {
                match: '^docs/(.*)$',
                replace: './{locale}/$1',
              },
              '$.logo': { match: '^docs/(.*)$', replace: './{locale}/$1' },
            },
          },
        },
        experimentalLocalizeStaticUrls: { skipUntranslatedPages: true },
      },
    });

    const ja = YAML.parse(
      fs.readFileSync(path.join(dir, 'translations/ja.yml'), 'utf8')
    );
    expect(
      ja.navigation[0].layout[0].contents.map((c: { path: string }) => c.path)
    ).toEqual(['./ja/guide.mdx', '../docs/terms.mdx']);
    expect(ja.logo).toBe('./ja/logo.png');
  });

  it('fixes every entry when a locale has several, such as redirects', async () => {
    write('en/terms.mdx', '# Terms\n');
    write('en/privacy.mdx', '# Privacy\n');
    writeJson('docs.json', {
      navigation: { languages: [{ language: 'en', pages: [] }] },
      redirects: [
        { language: 'en', source: '/en/old-terms', destination: '/en/terms' },
        {
          language: 'en',
          source: '/en/old-privacy',
          destination: '/en/privacy',
        },
        { language: 'ja', source: '/ja/old-terms', destination: '/ja/terms' },
        {
          language: 'ja',
          source: '/ja/old-privacy',
          destination: '/ja/privacy',
        },
      ],
    });

    await run(mintlifyConfig('mintlify'));

    const redirects = readJson('docs.json').redirects;
    expect(
      redirects
        .filter((r: { language: string }) => r.language === 'ja')
        .map((r: { destination: string }) => r.destination)
    ).toEqual(['/en/terms', '/en/privacy']);
  });

  it('finds entries written with canonical locale keys', async () => {
    write('terms.mdx', '# Terms\n');
    writeJson('docs.json', {
      navigation: {
        languages: [
          { language: 'en', pages: ['terms'] },
          { language: 'fr-CA', pages: ['fr-ca/terms'] },
        ],
      },
    });

    const config = mintlifyConfig('mintlify-hide-default');
    await run({
      ...config,
      locales: ['fr-ca'],
      options: { ...config.options, experimentalCanonicalLocaleKeys: true },
    });

    const [, fr] = readJson('docs.json').navigation.languages;
    expect(fr.pages).toEqual(['terms']);
  });

  it('is a no-op on a second run', async () => {
    write('guide.mdx', '# Guide\n');
    write('ja/guide.mdx', '# Guide\n');
    write('terms.mdx', '# Terms\n');
    writeJson('docs.json', {
      navigation: {
        languages: [
          { language: 'en', pages: ['guide', 'terms'] },
          { language: 'ja', pages: ['ja/guide', 'ja/terms'] },
        ],
      },
    });

    await run(mintlifyConfig('mintlify-hide-default'));
    const afterFirst = fs.readFileSync(path.join(dir, 'docs.json'), 'utf8');
    await run(mintlifyConfig('mintlify-hide-default'));

    expect(fs.readFileSync(path.join(dir, 'docs.json'), 'utf8')).toBe(
      afterFirst
    );
    expect(readJson('docs.json').navigation.languages[1].pages).toEqual([
      'ja/guide',
      'terms',
    ]);
  });

  it('changes nothing unless skipUntranslatedPages is set', async () => {
    write('terms.mdx', '# Page\n');
    const docs = {
      navigation: {
        languages: [
          { language: 'en', pages: ['terms'] },
          { language: 'ja', pages: ['ja/terms'] },
        ],
      },
    };
    writeJson('docs.json', docs);

    await run(mintlifyConfig('mintlify-hide-default', true));

    expect(readJson('docs.json')).toEqual(docs);
  });
});
