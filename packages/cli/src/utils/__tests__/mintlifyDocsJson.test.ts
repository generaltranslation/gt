import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyMintlifyDocsJsonFilter } from '../mintlifyDocsJson.js';
import { Settings } from '../../types/index.js';

const ORIGINAL_CWD = process.cwd();

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function createSettings(
  tmpDir: string,
  useDocsJsonNavigation: boolean
): Settings {
  return {
    config: path.join(tmpDir, 'gt.config.json'),
    configDirectory: path.join(tmpDir, '.gt'),
    baseUrl: '',
    dashboardUrl: '',
    defaultLocale: 'en',
    locales: ['es'],
    src: [],
    stageTranslations: false,
    publish: false,
    files: {
      resolvedPaths: { mdx: [], md: [] },
      placeholderPaths: { mdx: [], md: [] },
      transformPaths: {},
    },
    parsingOptions: { conditionNames: [] },
    branchOptions: { enabled: false, remoteName: 'origin' },
    options: {
      mintlify: {
        useDocsJsonNavigation,
      },
    },
  } as Settings;
}

describe('applyMintlifyDocsJsonFilter', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-mintlify-docs-'));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(ORIGINAL_CWD);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('filters mdx files to exact docs.json pages for the default locale', () => {
    const docsJsonPath = path.join(tmpDir, 'docs.json');
    writeFile(
      docsJsonPath,
      JSON.stringify({
        $schema: 'https://mintlify.com/docs.json',
        navigation: {
          languages: [
            {
              language: 'en',
              tabs: [
                {
                  groups: [
                    {
                      pages: [
                        'index',
                        'guide/intro',
                        {
                          group: 'Nested',
                          pages: ['docs/index'],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              language: 'es',
              tabs: [
                {
                  groups: [
                    {
                      pages: ['es/index'],
                    },
                  ],
                },
              ],
            },
          ],
        },
      })
    );

    const files = [
      path.join(tmpDir, 'index.mdx'),
      path.join(tmpDir, 'guide', 'intro.mdx'),
      path.join(tmpDir, 'guide', 'index.mdx'),
      path.join(tmpDir, 'docs', 'index.mdx'),
      path.join(tmpDir, 'other.mdx'),
    ];
    files.forEach((file) => writeFile(file, '# test'));

    const settings = createSettings(tmpDir, true);
    settings.files.resolvedPaths.mdx = [...files];
    settings.files.placeholderPaths.mdx = [...files];

    applyMintlifyDocsJsonFilter(settings, tmpDir);

    const filtered = settings.files.resolvedPaths.mdx.map((filePath) =>
      path.relative(tmpDir, filePath).replace(/\\/g, '/')
    );

    expect(filtered).toEqual([
      'index.mdx',
      'guide/intro.mdx',
      'docs/index.mdx',
    ]);
  });

  it('keeps files untouched when disabled', () => {
    const docsJsonPath = path.join(tmpDir, 'docs.json');
    writeFile(
      docsJsonPath,
      JSON.stringify({
        $schema: 'https://mintlify.com/docs.json',
        navigation: {
          groups: [
            {
              pages: ['index'],
            },
          ],
        },
      })
    );

    const files = [path.join(tmpDir, 'index.mdx')];
    files.forEach((file) => writeFile(file, '# test'));

    const settings = createSettings(tmpDir, false);
    settings.files.resolvedPaths.mdx = [...files];
    settings.files.placeholderPaths.mdx = [...files];

    applyMintlifyDocsJsonFilter(settings, tmpDir);

    expect(settings.files.resolvedPaths.mdx).toEqual(files);
    expect(settings.files.placeholderPaths.mdx).toEqual(files);
  });
});
