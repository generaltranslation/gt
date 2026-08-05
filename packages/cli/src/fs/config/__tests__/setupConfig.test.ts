import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createOrUpdateConfig } from '../setupConfig.js';

describe('createOrUpdateConfig', () => {
  let testDirectory: string;

  afterEach(() => {
    fs.rmSync(testDirectory, { recursive: true, force: true });
  });

  it('merges GT output without replacing existing config', async () => {
    testDirectory = fs.mkdtempSync(path.join(tmpdir(), 'gt-config-'));
    const configPath = path.join(testDirectory, 'gt.config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        defaultLocale: 'en',
        locales: ['fr'],
        files: {
          md: { include: ['docs/**/*.md'] },
          gt: { parsingFlags: { devHotReload: true } },
        },
      })
    );

    await createOrUpdateConfig(configPath, {
      files: { gt: { output: 'src/_gt/[locale].json' } },
    });

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(config.defaultLocale).toBe('en');
    expect(config.locales).toEqual(['fr']);
    expect(config.files.md).toEqual({ include: ['docs/**/*.md'] });
    expect(config.files.gt).toEqual({
      parsingFlags: { devHotReload: true },
      output: 'src/_gt/[locale].json',
    });
  });
});
