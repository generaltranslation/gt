import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logErrorAndExit } from '../../../console/logging.js';
import { loadConfig } from '../loadConfig.js';

vi.mock('../../../console/logging.js', () => ({
  logErrorAndExit: vi.fn((message: string) => {
    throw new Error(message);
  }),
}));

describe('loadConfig', () => {
  let configPath: string;

  beforeEach(() => {
    configPath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'gt-load-config-')),
      'gt.config.json'
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    fs.rmSync(path.dirname(configPath), { recursive: true, force: true });
  });

  function load(content: string) {
    fs.writeFileSync(configPath, content);
    return () => loadConfig(configPath);
  }

  it('exits naming the file and the parse error for malformed JSON', () => {
    expect(load('{ "locales": ["fr"], }')).toThrow(
      new RegExp(`gt Error: ${configPath} could not be read as JSON.*JSON`)
    );
    expect(logErrorAndExit).toHaveBeenCalledOnce();
  });

  it('does not quote credentials from malformed JSON', () => {
    const read = load('{ "devApiKey": gtx-dev-secret }');
    expect(read).toThrow('could not be read as JSON');
    expect(read).toThrow(/^(?!.*gtx-dev-secret)/s);
  });

  it.each([
    ['null', 'null', '(root): Invalid type: Expected Object but received null'],
    ['string locales', '{ "locales": "fr" }', 'locales: Invalid type'],
    [
      'a string file-type requiresReview',
      '{ "files": { "json": { "include": ["a.json"], "requiresReview": "false" } } }',
      'files.json.requiresReview: Invalid type',
    ],
    [
      'a requiresReview object with an unknown key',
      '{ "files": { "json": { "include": ["a.json"], "requiresReview": { "includes": ["a/**"] } } } }',
      'files.json.requiresReview.includes: Invalid key',
    ],
    [
      'an unsupported model provider',
      '{ "modelProvider": "CUSTOM_PROVIDER" }',
      'modelProvider: Invalid type',
    ],
    [
      'an unknown key in a nested object',
      '{ "files": { "gt": { "outputs": "a.json" } } }',
      'files.gt.outputs: Invalid key',
    ],
  ])('rejects %s', (_case, content, issue) => {
    const read = load(content);
    expect(read).toThrow(`gt Error: ${configPath} is invalid`);
    expect(read).toThrow(issue);
  });

  it('rejects an API key without echoing it', () => {
    const read = load('{ "apiKey": "gtx-secret-value" }');
    expect(read).toThrow('apiKey: Remove the API key from this file');
    expect(read).toThrow(/^(?!.*gtx-secret-value)/s);
  });

  it('returns a valid config with its unknown top-level keys', () => {
    expect(
      load('{ "locales": ["fr"], "skipVersionCheck": true, "custom": 1 }')()
    ).toEqual({ locales: ['fr'], skipVersionCheck: true, custom: 1 });
  });
});
