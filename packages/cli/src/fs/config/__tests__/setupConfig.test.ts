import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createOrUpdateConfig } from '../setupConfig.js';

describe('createOrUpdateConfig', () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('preserves existing file config while adding local GT output', async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gt-setup-config-')
    );
    temporaryDirectories.push(directory);
    const configPath = path.join(directory, 'gt.config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        customSetting: true,
        files: {
          json: { include: ['locales/[locale].json'] },
          gt: { parsingFlags: { jsx: true } },
        },
      })
    );

    await createOrUpdateConfig(configPath, {
      framework: 'next-pages',
      files: {
        gt: { output: 'public/_gt/[locale].json' },
      },
    });

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(config.customSetting).toBe(true);
    expect(config.files.json).toEqual({
      include: ['locales/[locale].json'],
    });
    expect(config.files.gt).toEqual({
      parsingFlags: { jsx: true },
      output: 'public/_gt/[locale].json',
    });
  });
});
