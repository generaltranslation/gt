import { describe, it, expect } from 'vitest';
import {
  CONFIG_FILE_TYPE_TO_FILE_FORMAT,
  FILE_FORMAT_TO_CONFIG_FILE_TYPE,
  getFileExtensionForFormat,
} from '../transformFormat.js';

describe('transformFormat - Apple string catalog formats', () => {
  it('maps config file keys to API file format enum values', () => {
    expect(CONFIG_FILE_TYPE_TO_FILE_FORMAT.strings).toBe('APPLE_STRINGS');
    expect(CONFIG_FILE_TYPE_TO_FILE_FORMAT.stringsdict).toBe(
      'APPLE_STRINGSDICT'
    );
    expect(CONFIG_FILE_TYPE_TO_FILE_FORMAT.xcstrings).toBe('XCSTRINGS');
  });

  it('maps API file format enum values back to config file keys', () => {
    expect(FILE_FORMAT_TO_CONFIG_FILE_TYPE.APPLE_STRINGS).toBe('strings');
    expect(FILE_FORMAT_TO_CONFIG_FILE_TYPE.APPLE_STRINGSDICT).toBe(
      'stringsdict'
    );
    expect(FILE_FORMAT_TO_CONFIG_FILE_TYPE.XCSTRINGS).toBe('xcstrings');
  });

  it('writes translated files with the matching extension', () => {
    expect(getFileExtensionForFormat('APPLE_STRINGS')).toBe('strings');
    expect(getFileExtensionForFormat('APPLE_STRINGSDICT')).toBe('stringsdict');
    expect(getFileExtensionForFormat('XCSTRINGS')).toBe('xcstrings');
  });
});
