import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig, parseConfigFile } from '../loadConfig.js';

describe('parseConfigFile', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-config-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns {} when the file does not exist', () => {
    expect(parseConfigFile(path.join(dir, 'missing.json'))).toEqual({});
  });

  it('parses a valid config file', () => {
    const file = path.join(dir, 'gt.config.json');
    fs.writeFileSync(file, '{ "defaultLocale": "en", "locales": ["fr"] }');
    expect(parseConfigFile(file)).toEqual({
      defaultLocale: 'en',
      locales: ['fr'],
    });
  });

  it('throws on an existing file with invalid JSON instead of silently returning {}', () => {
    const file = path.join(dir, 'gt.config.json');
    fs.writeFileSync(file, '{ "defaultLocale": "en", INVALID }');
    // loadConfig swallows this and loses every setting; parseConfigFile must not
    expect(loadConfig(file)).toEqual({});
    expect(() => parseConfigFile(file)).toThrow(/Failed to parse config file/);
  });
});
