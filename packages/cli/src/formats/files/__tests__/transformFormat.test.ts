import { describe, it, expect } from 'vitest';
import {
  CONFIG_FILE_TYPE_TO_FILE_FORMAT,
  FILE_FORMAT_TO_CONFIG_FILE_TYPE,
  getFileExtensionForFormat,
} from '../transformFormat.js';

describe('transformFormat - .strings', () => {
  it('maps the config file key to the API file format enum value', () => {
    expect(CONFIG_FILE_TYPE_TO_FILE_FORMAT.dotStrings).toBe('DOT_STRINGS');
  });

  it('maps the API file format enum value back to the config file key', () => {
    expect(FILE_FORMAT_TO_CONFIG_FILE_TYPE.DOT_STRINGS).toBe('dotStrings');
  });

  it('writes translated files with the matching extension', () => {
    expect(getFileExtensionForFormat('DOT_STRINGS')).toBe('strings');
  });
});

describe('transformFormat - .stringsdict', () => {
  it('maps the config file key to the API file format enum value', () => {
    expect(CONFIG_FILE_TYPE_TO_FILE_FORMAT.dotStringsdict).toBe(
      'DOT_STRINGSDICT'
    );
  });

  it('maps the API file format enum value back to the config file key', () => {
    expect(FILE_FORMAT_TO_CONFIG_FILE_TYPE.DOT_STRINGSDICT).toBe(
      'dotStringsdict'
    );
  });

  it('writes translated files with the matching extension', () => {
    expect(getFileExtensionForFormat('DOT_STRINGSDICT')).toBe('stringsdict');
  });
});

describe('transformFormat - Android strings.xml', () => {
  it('maps the config file key to the API file format enum value', () => {
    expect(CONFIG_FILE_TYPE_TO_FILE_FORMAT.androidStrings).toBe(
      'ANDROID_STRINGS'
    );
  });

  it('maps the API file format enum value back to the config file key', () => {
    expect(FILE_FORMAT_TO_CONFIG_FILE_TYPE.ANDROID_STRINGS).toBe(
      'androidStrings'
    );
  });

  it('writes translated files with the matching extension', () => {
    expect(getFileExtensionForFormat('ANDROID_STRINGS')).toBe('xml');
  });
});
