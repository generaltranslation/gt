import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import localizeMintlifyFrontmatterUrls, {
  localizeMintlifyFrontmatterUrlForContent,
} from '../localizeMintlifyFrontmatterUrls.js';
import type { Settings } from '../../types/index.js';

describe('localizeMintlifyFrontmatterUrlForContent', () => {
  it('prefixes an absolute Mintlify frontmatter url with the target locale and preserves the leading slash', () => {
    const result = localizeMintlifyFrontmatterUrlForContent(
      [
        '---',
        'title: "Serverless Sandboxes"',
        'url: "/sandboxes"',
        'tag: Preview',
        '---',
        '',
      ].join('\n'),
      'ja',
      ['en', 'ja']
    );

    expect(result.changed).toBe(true);
    expect(result.content).toContain('url: "/ja/sandboxes"');
  });

  it('prefixes a relative Mintlify frontmatter url without adding a leading slash', () => {
    const result = localizeMintlifyFrontmatterUrlForContent(
      ['---', 'url: "sandboxes"', '---', ''].join('\n'),
      'ja',
      ['en', 'ja']
    );

    expect(result.changed).toBe(true);
    expect(result.content).toContain('url: "ja/sandboxes"');
  });

  it('replaces an existing known locale prefix and stays idempotent', () => {
    const content = ['---', 'url: "/en/sandboxes"', '---', ''].join('\n');
    const result = localizeMintlifyFrontmatterUrlForContent(content, 'ja', [
      'en',
      'ja',
    ]);
    const repeated = localizeMintlifyFrontmatterUrlForContent(
      result.content,
      'ja',
      ['en', 'ja']
    );

    expect(result.changed).toBe(true);
    expect(result.content).toContain('url: "/ja/sandboxes"');
    expect(repeated.changed).toBe(false);
    expect(repeated.content).toBe(result.content);
  });

  it('skips external and fragment-only urls', () => {
    const external = localizeMintlifyFrontmatterUrlForContent(
      ['---', 'url: "https://example.com/sandboxes"', '---', ''].join('\n'),
      'ja',
      ['en', 'ja']
    );
    const fragment = localizeMintlifyFrontmatterUrlForContent(
      ['---', 'url: "#sandboxes"', '---', ''].join('\n'),
      'ja',
      ['en', 'ja']
    );

    expect(external.changed).toBe(false);
    expect(fragment.changed).toBe(false);
  });
});

describe('localizeMintlifyFrontmatterUrls', () => {
  const originalCwd = process.cwd();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-mintlify-url-'));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('localizes translated mdx frontmatter url fields from file mappings', async () => {
    const sourcePath = path.join(tmpDir, 'sandboxes.mdx');
    const targetPath = path.join(tmpDir, 'ja', 'sandboxes.mdx');
    fs.writeFileSync(sourcePath, '---\nurl: "/sandboxes"\n---\n');
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, '---\nurl: "/sandboxes"\n---\n');

    const settings = {
      config: path.join(tmpDir, 'gt.config.json'),
      configDirectory: path.join(tmpDir, '.gt'),
      baseUrl: '',
      dashboardUrl: '',
      defaultLocale: 'en',
      locales: ['ja'],
      files: {
        resolvedPaths: { mdx: [sourcePath] },
        placeholderPaths: {
          mdx: [path.join(tmpDir, '[locale]', 'sandboxes.mdx')],
        },
        transformPaths: {},
        transformFormats: {},
      },
      stageTranslations: false,
      framework: 'mintlify',
      parsingOptions: { conditionNames: [] },
      branchOptions: { enabled: false, remoteName: 'origin' },
    } as Settings;

    await localizeMintlifyFrontmatterUrls(settings);

    expect(fs.readFileSync(targetPath, 'utf8')).toContain(
      'url: "/ja/sandboxes"'
    );
  });
});
