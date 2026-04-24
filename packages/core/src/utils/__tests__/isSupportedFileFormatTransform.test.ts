import { describe, expect, it } from 'vitest';
import { isSupportedFileFormatTransform } from '../isSupportedFileFormatTransform';
import type { FileFormat } from '../../types-dir/api/file';

describe('isSupportedFileFormatTransform', () => {
  const fileFormats: FileFormat[] = [
    'GTJSON',
    'JSON',
    'PO',
    'POT',
    'YAML',
    'MDX',
    'MD',
    'TS',
    'JS',
    'HTML',
    'TXT',
    'TWILIO_CONTENT_JSON',
  ];

  it('supports identity transforms by default', () => {
    for (const fileFormat of fileFormats) {
      expect(isSupportedFileFormatTransform(fileFormat, fileFormat)).toBe(true);
    }
  });

  it('does not support cross-format transforms yet', () => {
    expect(isSupportedFileFormatTransform('YAML', 'JSON')).toBe(false);
    expect(isSupportedFileFormatTransform('POT', 'PO')).toBe(false);
  });
});
