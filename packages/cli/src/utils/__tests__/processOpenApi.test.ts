import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import processOpenApi from '../processOpenApi.js';
import { Settings } from '../../types/index.js';

const ORIGINAL_CWD = process.cwd();

function createSettings(tmpDir: string, openapiFiles: string[]): Settings {
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
      resolvedPaths: { mdx: [], json: [] },
      placeholderPaths: { mdx: [], json: [] },
      transformPaths: {},
    },
    parsingOptions: { conditionNames: [] },
    branchOptions: { enabled: false, remoteName: 'origin' },
    options: {
      mintlify: {
        openapi: {
          files: openapiFiles,
        },
      },
    },
  } as Settings;
}

describe('processOpenApi', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-openapi-'));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(ORIGINAL_CWD);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rewrites source and translated frontmatter with locale-specific spec path (root-relative)', async () => {
    const spec = { openapi: '3.0.0', paths: { '/foo': { post: {} } } };

    const specPath = path.join(tmpDir, 'openapi.demo.json');
    fs.writeFileSync(specPath, JSON.stringify(spec));
    const translatedSpecPath = path.join(tmpDir, 'es', 'openapi.demo.json');
    fs.mkdirSync(path.dirname(translatedSpecPath), { recursive: true });
    fs.writeFileSync(translatedSpecPath, JSON.stringify(spec));

    const sourceMdxPath = path.join(tmpDir, 'openapiPage.mdx');
    fs.writeFileSync(sourceMdxPath, '---\nopenapi: POST /foo\n---\n');
    const translatedMdxPath = path.join(tmpDir, 'es', 'openapiPage.mdx');
    fs.mkdirSync(path.dirname(translatedMdxPath), { recursive: true });
    fs.writeFileSync(translatedMdxPath, '---\nopenapi: POST /foo\n---\n');

    const settings = createSettings(tmpDir, ['./openapi.demo.json']);
    settings.files = {
      resolvedPaths: {
        mdx: [sourceMdxPath],
        json: [specPath],
      },
      placeholderPaths: {
        mdx: [path.join(tmpDir, '[locale]', 'openapiPage.mdx')],
        json: [specPath],
      },
      transformPaths: {
        json: {
          match: 'openapi.demo.json$',
          replace: '{locale}/openapi.demo.json',
        },
      },
    };

    await processOpenApi(settings);

    const updatedSource = fs.readFileSync(sourceMdxPath, 'utf8');
    const updatedTranslated = fs.readFileSync(translatedMdxPath, 'utf8');
    expect(updatedSource).toContain('/openapi.demo.json POST /foo');
    expect(updatedTranslated).toContain('/es/openapi.demo.json POST /foo');
  });

  it('skips ambiguous operations when multiple specs match and leaves frontmatter unchanged', async () => {
    const specA = { openapi: '3.0.0', paths: { '/dup': { get: {} } } };
    const specB = { openapi: '3.0.0', paths: { '/dup': { get: {} } } };

    const specAPath = path.join(tmpDir, 'spec-a.json');
    const specBPath = path.join(tmpDir, 'spec-b.json');
    fs.writeFileSync(specAPath, JSON.stringify(specA));
    fs.writeFileSync(specBPath, JSON.stringify(specB));
    const specALocalized = path.join(tmpDir, 'es', 'spec-a.json');
    fs.mkdirSync(path.dirname(specALocalized), { recursive: true });
    fs.writeFileSync(specALocalized, JSON.stringify(specA));

    const sourceMdxPath = path.join(tmpDir, 'page.mdx');
    fs.writeFileSync(sourceMdxPath, '---\nopenapi: GET /dup\n---\n');
    const translatedMdxPath = path.join(tmpDir, 'es', 'page.mdx');
    fs.mkdirSync(path.dirname(translatedMdxPath), { recursive: true });
    fs.writeFileSync(translatedMdxPath, '---\nopenapi: GET /dup\n---\n');

    const settings = createSettings(tmpDir, ['./spec-a.json', './spec-b.json']);
    settings.files = {
      resolvedPaths: { mdx: [sourceMdxPath], json: [specAPath, specBPath] },
      placeholderPaths: {
        mdx: [path.join(tmpDir, '[locale]', 'page.mdx')],
        json: [specAPath, specBPath],
      },
      transformPaths: {
        json: {
          match: 'spec-a.json$|spec-b.json$',
          replace: '{locale}/$&',
        },
      },
    };

    await processOpenApi(settings);

    const updatedSource = fs.readFileSync(sourceMdxPath, 'utf8');
    const updatedTranslated = fs.readFileSync(translatedMdxPath, 'utf8');
    expect(updatedSource).toContain('openapi: GET /dup');
    expect(updatedTranslated).toContain('openapi: GET /dup');
    expect(updatedTranslated).not.toContain('/es/spec-a.json');
  });

  it('respects explicit spec identifiers without extensions and localizes correctly', async () => {
    const specV1 = {
      openapi: '3.0.0',
      paths: { '/batch/scrape/{id}': { delete: {} } },
    };
    const specV2 = {
      openapi: '3.0.0',
      paths: { '/batch/scrape/{id}': { delete: {} } },
    };

    const specDir = path.join(tmpDir, 'api-reference');
    const specV1Path = path.join(specDir, 'v1-openapi.json');
    const specV2Path = path.join(specDir, 'v2-openapi.json');
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(specV1Path, JSON.stringify(specV1));
    fs.writeFileSync(specV2Path, JSON.stringify(specV2));

    const localizedSpecDir = path.join(tmpDir, 'es', 'api-reference');
    const localizedSpecV1Path = path.join(localizedSpecDir, 'v1-openapi.json');
    const localizedSpecV2Path = path.join(localizedSpecDir, 'v2-openapi.json');
    fs.mkdirSync(localizedSpecDir, { recursive: true });
    fs.writeFileSync(localizedSpecV1Path, JSON.stringify(specV1));
    fs.writeFileSync(localizedSpecV2Path, JSON.stringify(specV2));

    const sourceMdxPath = path.join(tmpDir, 'page.mdx');
    fs.writeFileSync(
      sourceMdxPath,
      "---\nopenapi: v2-openapi DELETE /batch/scrape/{id}\n---\n"
    );
    const translatedMdxPath = path.join(tmpDir, 'es', 'page.mdx');
    fs.mkdirSync(path.dirname(translatedMdxPath), { recursive: true });
    fs.writeFileSync(
      translatedMdxPath,
      "---\nopenapi: v2-openapi DELETE /batch/scrape/{id}\n---\n"
    );

    const settings = createSettings(tmpDir, [
      './api-reference/v1-openapi.json',
      './api-reference/v2-openapi.json',
    ]);
    settings.files = {
      resolvedPaths: {
        mdx: [sourceMdxPath],
        json: [specV1Path, specV2Path],
      },
      placeholderPaths: {
        mdx: [path.join(tmpDir, '[locale]', 'page.mdx')],
        json: [specV1Path, specV2Path],
      },
      transformPaths: {
        json: {
          match: 'api-reference/v1-openapi.json$|api-reference/v2-openapi.json$',
          replace: '{locale}/$&',
        },
      },
    };

    await processOpenApi(settings);

    const updatedSource = fs.readFileSync(sourceMdxPath, 'utf8');
    const updatedTranslated = fs.readFileSync(translatedMdxPath, 'utf8');
    expect(updatedSource).toContain(
      '/api-reference/v2-openapi.json DELETE /batch/scrape/{id}'
    );
    expect(updatedTranslated).toContain(
      '/es/api-reference/v2-openapi.json DELETE /batch/scrape/{id}'
    );
  });

  it('handles nested spec paths with transforms and emits root-relative paths', async () => {
    const spec = { openapi: '3.0.0', paths: { '/foo': { post: {} } } };
    const specPath = path.join(
      tmpDir,
      'openapi',
      'dirA',
      'dirAa',
      'openapi.json'
    );
    fs.mkdirSync(path.dirname(specPath), { recursive: true });
    fs.writeFileSync(specPath, JSON.stringify(spec));
    const localizedSpecPath = path.join(
      tmpDir,
      'es',
      'openapi',
      'dirA',
      'dirAa',
      'openapi.json'
    );
    fs.mkdirSync(path.dirname(localizedSpecPath), { recursive: true });
    fs.writeFileSync(localizedSpecPath, JSON.stringify(spec));

    const sourceMdxPath = path.join(tmpDir, 'nested', 'page.mdx');
    fs.mkdirSync(path.dirname(sourceMdxPath), { recursive: true });
    fs.writeFileSync(sourceMdxPath, '---\nopenapi: POST /foo\n---\n');
    const translatedMdxPath = path.join(tmpDir, 'es', 'nested', 'page.mdx');
    fs.mkdirSync(path.dirname(translatedMdxPath), { recursive: true });
    fs.writeFileSync(translatedMdxPath, '---\nopenapi: POST /foo\n---\n');

    const settings = createSettings(tmpDir, [
      './openapi/dirA/dirAa/openapi.json',
    ]);
    settings.files = {
      resolvedPaths: { mdx: [sourceMdxPath], json: [specPath] },
      placeholderPaths: {
        mdx: [path.join(tmpDir, '[locale]', 'nested', 'page.mdx')],
        json: [specPath],
      },
      transformPaths: {
        json: {
          match: 'openapi/dirA/dirAa/openapi.json$',
          replace: '{locale}/openapi/dirA/dirAa/openapi.json',
        },
      },
    };

    await processOpenApi(settings);

    const updatedTranslated = fs.readFileSync(translatedMdxPath, 'utf8');
    expect(updatedTranslated).toContain(
      '/es/openapi/dirA/dirAa/openapi.json POST /foo'
    );
  });

  it('resolves explicit leading-slash spec paths against config dir', async () => {
    const spec = { openapi: '3.0.0', paths: { '/foo': { post: {} } } };
    const specPath = path.join(tmpDir, 'openapi.demo.json');
    fs.writeFileSync(specPath, JSON.stringify(spec));
    const localizedSpecPath = path.join(tmpDir, 'es', 'openapi.demo.json');
    fs.mkdirSync(path.dirname(localizedSpecPath), { recursive: true });
    fs.writeFileSync(localizedSpecPath, JSON.stringify(spec));

    const sourceMdxPath = path.join(tmpDir, 'page.mdx');
    fs.writeFileSync(
      sourceMdxPath,
      '---\nopenapi: /openapi.demo.json POST /foo\n---\n'
    );
    const translatedMdxPath = path.join(tmpDir, 'es', 'page.mdx');
    fs.mkdirSync(path.dirname(translatedMdxPath), { recursive: true });
    fs.writeFileSync(
      translatedMdxPath,
      '---\nopenapi: /openapi.demo.json POST /foo\n---\n'
    );

    const settings = createSettings(tmpDir, ['./openapi.demo.json']);
    settings.files = {
      resolvedPaths: { mdx: [sourceMdxPath], json: [specPath] },
      placeholderPaths: {
        mdx: [path.join(tmpDir, '[locale]', 'page.mdx')],
        json: [specPath],
      },
      transformPaths: {
        json: {
          match: 'openapi.demo.json$',
          replace: '{locale}/openapi.demo.json',
        },
      },
    };

    await processOpenApi(settings);

    const updatedTranslated = fs.readFileSync(translatedMdxPath, 'utf8');
    expect(updatedTranslated).toContain('/es/openapi.demo.json POST /foo');
  });

  it('preserves flow-style frontmatter formatting when updating openapi', async () => {
    const spec = { openapi: '3.0.0', paths: { '/foo': { post: {} } } };
    const specPath = path.join(tmpDir, 'openapi.demo.json');
    fs.writeFileSync(specPath, JSON.stringify(spec));
    const localizedSpecPath = path.join(tmpDir, 'es', 'openapi.demo.json');
    fs.mkdirSync(path.dirname(localizedSpecPath), { recursive: true });
    fs.writeFileSync(localizedSpecPath, JSON.stringify(spec));

    const sourceMdxPath = path.join(tmpDir, 'page.mdx');
    fs.writeFileSync(
      sourceMdxPath,
      '---\nopenapi: POST /foo\nkeywords: ["agent job", "create"]\n---\n'
    );
    const translatedMdxPath = path.join(tmpDir, 'es', 'page.mdx');
    fs.mkdirSync(path.dirname(translatedMdxPath), { recursive: true });
    fs.writeFileSync(
      translatedMdxPath,
      '---\nopenapi: POST /foo\nkeywords: ["tarea de agente", "crear"]\n---\n'
    );

    const settings = createSettings(tmpDir, ['./openapi.demo.json']);
    settings.files = {
      resolvedPaths: { mdx: [sourceMdxPath], json: [specPath] },
      placeholderPaths: {
        mdx: [path.join(tmpDir, '[locale]', 'page.mdx')],
        json: [specPath],
      },
      transformPaths: {
        json: {
          match: 'openapi.demo.json$',
          replace: '{locale}/openapi.demo.json',
        },
      },
    };

    await processOpenApi(settings);

    const updatedSource = fs.readFileSync(sourceMdxPath, 'utf8');
    const updatedTranslated = fs.readFileSync(translatedMdxPath, 'utf8');
    expect(updatedSource).toContain('/openapi.demo.json POST /foo');
    expect(updatedSource).toMatch(
      /keywords:\s*\[\s*"agent job",\s*"create"\s*\]/
    );
    expect(updatedSource).not.toMatch(/keywords:\\s*\\n\\s*- /);
    expect(updatedTranslated).toContain('/es/openapi.demo.json POST /foo');
    expect(updatedTranslated).toMatch(
      /keywords:\s*\[\s*"tarea de agente",\s*"crear"\s*\]/
    );
    expect(updatedTranslated).not.toMatch(/keywords:\\s*\\n\\s*- /);
  });
});
