import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectUnsupportedJsonFields } from '../utils';
import { logger } from '../../../console/logger.js';

vi.mock('../../../console/logger.js');

const mockLogWarn = vi.spyOn(logger, 'warn');

describe('detectUnsupportedJsonFields', () => {
  beforeEach(() => {
    mockLogWarn.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should not warn when no unsupported fields are present', () => {
    const json = {
      navigation: {
        languages: [
          { language: 'en', group: 'Getting Started', pages: ['intro'] },
        ],
      },
    };
    detectUnsupportedJsonFields(json, 'docs.json');
    expect(mockLogWarn).not.toHaveBeenCalled();
  });

  it('should warn on $ref at a top-level field', () => {
    const json = {
      navigation: { $ref: './config/navigation.json' },
    };
    detectUnsupportedJsonFields(json, 'docs.json');
    expect(mockLogWarn).toHaveBeenCalledWith(
      expect.stringContaining('Mintlify config splitting is not yet supported')
    );
    expect(mockLogWarn).toHaveBeenCalledWith(
      expect.stringContaining('./config/navigation.json')
    );
  });

  it('should warn on $ref nested inside an array', () => {
    const json = {
      navigation: {
        languages: [
          {
            language: 'en',
            group: 'Getting Started',
            pages: { $ref: './config/pages.json' },
          },
        ],
      },
    };
    detectUnsupportedJsonFields(json, 'docs.json');
    expect(mockLogWarn).toHaveBeenCalledWith(
      expect.stringContaining('./config/pages.json')
    );
  });

  it('should use dot-separated paths in warning', () => {
    const json = {
      navigation: {
        languages: { $ref: './config/nav.json' },
      },
    };
    detectUnsupportedJsonFields(json, 'docs.json');
    const warnMsg = mockLogWarn.mock.calls[0][0] as string;
    expect(warnMsg).toContain('navigation.languages');
    expect(warnMsg).not.toContain('/navigation/languages');
  });

  it('should report multiple unsupported field locations in one warning', () => {
    const json = {
      navigation: { $ref: './config/navigation.json' },
      redirects: { $ref: './config/redirects.json' },
    };
    detectUnsupportedJsonFields(json, 'docs.json');
    expect(mockLogWarn).toHaveBeenCalledTimes(1);
    const warnMsg = mockLogWarn.mock.calls[0][0] as string;
    expect(warnMsg).toContain('./config/navigation.json');
    expect(warnMsg).toContain('./config/redirects.json');
  });

  it('should not flag string values that happen to contain $ref text', () => {
    const json = {
      navigation: {
        languages: [
          {
            language: 'en',
            group: 'See $ref docs',
            pages: ['intro'],
          },
        ],
      },
    };
    detectUnsupportedJsonFields(json, 'docs.json');
    expect(mockLogWarn).not.toHaveBeenCalled();
  });

  it('should warn on $ref inside arrays at root level', () => {
    const json = [
      { title: 'Page 1' },
      { $ref: './pages/page2.json' },
      { title: 'Page 3' },
    ];
    detectUnsupportedJsonFields(json, 'pages.json');
    expect(mockLogWarn).toHaveBeenCalledWith(
      expect.stringContaining('./pages/page2.json')
    );
  });

  it('should not warn for empty objects or arrays', () => {
    detectUnsupportedJsonFields({}, 'empty.json');
    detectUnsupportedJsonFields([], 'empty.json');
    expect(mockLogWarn).not.toHaveBeenCalled();
  });

  it('should include the filename in the warning', () => {
    const json = {
      navigation: { $ref: './config/nav.json' },
    };
    detectUnsupportedJsonFields(json, '/path/to/docs.json');
    expect(mockLogWarn).toHaveBeenCalledWith(
      expect.stringContaining('`docs.json`')
    );
  });
});
