import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveLocales } from '../resolveLocales';

describe('resolveLocales', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function writeConfig(content: unknown): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-rn-locales-'));
    tempDirs.push(dir);
    const configFilePath = path.join(dir, 'gt.config.json');
    fs.writeFileSync(configFilePath, JSON.stringify(content));
    return configFilePath;
  }

  it('reads the locales from a config file', () => {
    const configFilePath = writeConfig({
      defaultLocale: 'en',
      locales: ['fr'],
    });

    expect(resolveLocales({ configFilePath })).toEqual(['en', 'fr']);
  });

  it('fails on a config file that does not match the schema', () => {
    const configFilePath = writeConfig({
      defaultLocale: 'en',
      locales: ['fr'],
      renderSettings: { timeout: 5000 },
    });

    expect(() => resolveLocales({ configFilePath })).toThrow(
      `gt-react-native Error: ${configFilePath} is invalid`
    );
    expect(() => resolveLocales({ configFilePath })).toThrow(
      'renderSettings.method: Invalid key'
    );
  });
});
