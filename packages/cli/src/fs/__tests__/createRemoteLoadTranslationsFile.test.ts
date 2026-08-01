import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultCacheUrl } from 'generaltranslation/internal';
import { createRemoteLoadTranslationsFile } from '../createRemoteLoadTranslationsFile.js';

describe('createRemoteLoadTranslationsFile', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-vue-cdn-loader-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates a Vite-compatible CDN loader next to Vue source files', async () => {
    fs.mkdirSync(path.join(tmpDir, 'src'));

    const filePath = await createRemoteLoadTranslationsFile(tmpDir);
    const content = fs.readFileSync(filePath, 'utf8');

    expect(filePath).toBe(path.join(tmpDir, 'src', 'loadTranslations.js'));
    expect(content).toContain(
      'const projectId = import.meta.env.VITE_GT_PROJECT_ID'
    );
    expect(content).toContain(JSON.stringify(defaultCacheUrl));
    expect(content).toContain(
      '`${cacheUrl}/${projectId}/${encodeURIComponent(locale)}`'
    );
    expect(content).toContain('return response.json()');
  });

  it('does not overwrite an application-owned loader', async () => {
    fs.mkdirSync(path.join(tmpDir, 'src'));
    const filePath = path.join(tmpDir, 'src', 'loadTranslations.js');
    fs.writeFileSync(filePath, '// custom loader');

    await createRemoteLoadTranslationsFile(tmpDir);

    expect(fs.readFileSync(filePath, 'utf8')).toBe('// custom loader');
  });
});
