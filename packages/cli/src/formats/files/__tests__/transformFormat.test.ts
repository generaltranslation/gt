import { describe, it, expect } from 'vitest';
import {
  CONFIG_FILE_TYPE_TO_FILE_FORMAT,
  FILE_FORMAT_TO_CONFIG_FILE_TYPE,
  getFileExtensionForFormat,
} from '../transformFormat.js';

describe('transformFormat - Apple .strings', () => {
  it('maps the config file key to the API file format enum value', () => {
    expect(CONFIG_FILE_TYPE_TO_FILE_FORMAT.strings).toBe('APPLE_STRINGS');
  });

  it('maps the API file format enum value back to the config file key', () => {
    expect(FILE_FORMAT_TO_CONFIG_FILE_TYPE.APPLE_STRINGS).toBe('strings');
  });

  it('writes translated files with the matching extension', () => {
    expect(getFileExtensionForFormat('APPLE_STRINGS')).toBe('strings');
  });
});

describe('transformFormat - Apple .stringsdict', () => {
  it('maps the config file key to the API file format enum value', () => {
    expect(CONFIG_FILE_TYPE_TO_FILE_FORMAT.stringsdict).toBe(
      'APPLE_STRINGSDICT'
    );
  });

  it('maps the API file format enum value back to the config file key', () => {
    expect(FILE_FORMAT_TO_CONFIG_FILE_TYPE.APPLE_STRINGSDICT).toBe(
      'stringsdict'
    );
  });

  it('writes translated files with the matching extension', () => {
    expect(getFileExtensionForFormat('APPLE_STRINGSDICT')).toBe('stringsdict');
  });
});
