import { describe, it, expect } from 'vitest';
import {
  CONFIG_FILE_TYPE_TO_FILE_FORMAT,
  FILE_FORMAT_TO_CONFIG_FILE_TYPE,
  getFileExtensionForFormat,
} from '../transformFormat.js';

describe('transformFormat - Apple .strings', () => {
  it('maps the config file key to the API file format enum value', () => {
    expect(CONFIG_FILE_TYPE_TO_FILE_FORMAT.strings).toBe('DOT_STRINGS');
  });

  it('maps the API file format enum value back to the config file key', () => {
    expect(FILE_FORMAT_TO_CONFIG_FILE_TYPE.DOT_STRINGS).toBe('strings');
  });

  it('writes translated files with the matching extension', () => {
    expect(getFileExtensionForFormat('DOT_STRINGS')).toBe('strings');
  });
});

describe('transformFormat - Apple .stringsdict', () => {
  it('maps the config file key to the API file format enum value', () => {
    expect(CONFIG_FILE_TYPE_TO_FILE_FORMAT.stringsdict).toBe('DOT_STRINGSDICT');
  });

  it('maps the API file format enum value back to the config file key', () => {
    expect(FILE_FORMAT_TO_CONFIG_FILE_TYPE.DOT_STRINGSDICT).toBe('stringsdict');
  });

  it('writes translated files with the matching extension', () => {
    expect(getFileExtensionForFormat('DOT_STRINGSDICT')).toBe('stringsdict');
  });
});
