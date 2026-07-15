import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import updateConfig from '../updateConfig.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

function createConfig(content: string): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-config-'));
  const configPath = path.join(tempDir, 'gt.config.json');
  tempDirs.push(tempDir);
  fs.writeFileSync(configPath, content);
  return configPath;
}

describe('updateConfig', () => {
  it('does not rewrite the config when no values change', async () => {
    const content = '{\n\t"projectId": "project-id"\n}\n';
    const configPath = createConfig(content);

    await updateConfig(configPath, { _branchId: null });

    expect(fs.readFileSync(configPath, 'utf8')).toBe(content);
  });

  it('preserves existing formatting when updating a value', async () => {
    const content = [
      '{',
      '    "projectId" : "project-id",',
      '    "_versionId" : "old-version",',
      '    "locales" : [ "es", "fr" ]',
      '}',
      '',
    ].join('\r\n');
    const configPath = createConfig(content);

    await updateConfig(configPath, { _versionId: 'new-version' });

    expect(fs.readFileSync(configPath, 'utf8')).toBe(
      content.replace('old-version', 'new-version')
    );
  });

  it('uses the existing indentation when adding a value', async () => {
    const content = [
      '{',
      '\t"projectId": "project-id",',
      '\t"locales": ["es", "fr"]',
      '}',
      '',
    ].join('\n');
    const configPath = createConfig(content);

    await updateConfig(configPath, { _versionId: 'new-version' });

    expect(fs.readFileSync(configPath, 'utf8')).toBe(
      [
        '{',
        '\t"projectId": "project-id",',
        '\t"locales": ["es", "fr"],',
        '\t"_versionId": "new-version"',
        '}',
        '',
      ].join('\n')
    );
  });

  it('removes a value without reformatting adjacent properties', async () => {
    const content = [
      '{',
      '    "projectId" : "project-id",',
      '    "_branchId" : "branch-id",',
      '    "locales" : [ "es", "fr" ]',
      '}',
      '',
    ].join('\n');
    const configPath = createConfig(content);

    await updateConfig(configPath, { _branchId: null });

    expect(fs.readFileSync(configPath, 'utf8')).toBe(
      [
        '{',
        '    "projectId" : "project-id",',
        '    "locales" : [ "es", "fr" ]',
        '}',
        '',
      ].join('\n')
    );
  });
});
