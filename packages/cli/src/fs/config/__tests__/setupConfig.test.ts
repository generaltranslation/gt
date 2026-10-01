import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { GT_CONFIG_SCHEMA_URL } from '../../../utils/constants.js';
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
      framework: 'vite',
    });

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(config.defaultLocale).toBe('en');
    expect(config.locales).toEqual(['fr']);
    expect(config.framework).toBe('vite');
    expect(config.files.md).toEqual({ include: ['docs/**/*.md'] });
    expect(config.files.gt).toEqual({
      parsingFlags: { devHotReload: true },
      output: 'src/_gt/[locale].json',
    });
  });

  it('writes explicitly selected source patterns to the requested config', async () => {
    testDirectory = fs.mkdtempSync(path.join(tmpdir(), 'gt-config-'));
    const configPath = path.join(testDirectory, 'custom.gt.config.json');

    await createOrUpdateConfig(configPath, {
      defaultLocale: 'en',
      locales: ['fr'],
      src: ['src/**/*.vue', 'app.vue'],
      framework: 'vite',
    });

    expect(JSON.parse(fs.readFileSync(configPath, 'utf8'))).toMatchObject({
      defaultLocale: 'en',
      locales: ['fr'],
      src: ['src/**/*.vue', 'app.vue'],
      framework: 'vite',
    });
  });

  it('replaces the configured locale list', async () => {
    testDirectory = fs.mkdtempSync(path.join(tmpdir(), 'gt-config-'));
    const configPath = path.join(testDirectory, 'gt.config.json');
    fs.writeFileSync(configPath, JSON.stringify({ locales: ['fr', 'de'] }));

    await createOrUpdateConfig(configPath, { locales: ['ja'] });

    expect(JSON.parse(fs.readFileSync(configPath, 'utf8')).locales).toEqual([
      'ja',
    ]);
  });

  it('reports a new config as created and ends it with a newline', async () => {
    testDirectory = fs.mkdtempSync(path.join(tmpdir(), 'gt-config-'));
    const configPath = path.join(testDirectory, 'gt.config.json');

    expect(await createOrUpdateConfig(configPath, { locales: ['ja'] })).toBe(
      'created'
    );
    expect(fs.readFileSync(configPath, 'utf8')).toMatch(/^\{\n  ".*\}\n$/s);
  });

  it('leaves a config that already has the update untouched', async () => {
    testDirectory = fs.mkdtempSync(path.join(tmpdir(), 'gt-config-'));
    const configPath = path.join(testDirectory, 'gt.config.json');
    const content = `{\n    "locales": ["ja"],\n    "$schema": "${GT_CONFIG_SCHEMA_URL}"\n}`;
    fs.writeFileSync(configPath, content);

    expect(await createOrUpdateConfig(configPath, { locales: ['ja'] })).toBe(
      'unchanged'
    );
    expect(fs.readFileSync(configPath, 'utf8')).toBe(content);
  });

  it('keeps the indentation and trailing newline of an updated config', async () => {
    testDirectory = fs.mkdtempSync(path.join(tmpdir(), 'gt-config-'));
    const configPath = path.join(testDirectory, 'gt.config.json');
    fs.writeFileSync(
      configPath,
      `${JSON.stringify({ $schema: GT_CONFIG_SCHEMA_URL, locales: ['fr'] }, null, 4)}\n`
    );

    expect(await createOrUpdateConfig(configPath, { locales: ['ja'] })).toBe(
      'updated'
    );
    expect(fs.readFileSync(configPath, 'utf8')).toBe(
      `${JSON.stringify({ $schema: GT_CONFIG_SCHEMA_URL, locales: ['ja'] }, null, 4)}\n`
    );
  });

  it('fails instead of overwriting an unreadable config', async () => {
    testDirectory = fs.mkdtempSync(path.join(tmpdir(), 'gt-config-'));
    const configPath = path.join(testDirectory, 'gt.config.json');
    fs.writeFileSync(configPath, '[]');

    await expect(
      createOrUpdateConfig(configPath, { locales: ['ja'] })
    ).rejects.toThrow('does not contain a JSON object');
    expect(fs.readFileSync(configPath, 'utf8')).toBe('[]');
  });
});
