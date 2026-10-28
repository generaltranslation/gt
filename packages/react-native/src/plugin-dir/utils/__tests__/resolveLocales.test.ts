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

  it('reports a config file that does not match the schema', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const configFilePath = writeConfig({ defaultLocale: 'en', locales: 'fr' });

    resolveLocales({ configFilePath });

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `gt-react-native Error: ${configFilePath} is invalid`
      )
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('locales: Invalid type')
    );
  });
});
