import { describe, it, expect } from 'vitest';
import {
  CONFIG_FILE_TYPE_TO_FILE_FORMAT,
  FILE_FORMAT_TO_CONFIG_FILE_TYPE,
  getFileExtensionForFormat,
} from '../transformFormat.js';

// The config file key, the API file format enum value it is uploaded as, and
// the extension translated files are written with.
describe('transformFormat', () => {
  it.each([
    ['dotStrings', 'DOT_STRINGS', 'strings'],
    ['dotStringsdict', 'DOT_STRINGSDICT', 'stringsdict'],
    ['androidStrings', 'ANDROID_STRINGS', 'xml'],
    ['srt', 'SRT', 'srt'],
    ['resx', 'RESX', 'resx'],
  ] as const)('maps %s to %s and back, written as .%s', (key, format, ext) => {
    expect(CONFIG_FILE_TYPE_TO_FILE_FORMAT[key]).toBe(format);
    expect(FILE_FORMAT_TO_CONFIG_FILE_TYPE[format]).toBe(key);
    expect(getFileExtensionForFormat(format)).toBe(ext);
  });
});
