import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aggregateFiles } from '../aggregateFiles.js';
import { logger } from '../../../console/logger.js';
import { logErrorAndExit } from '../../../console/logging.js';
import { readFile, getRelative } from '../../../fs/findFilepath.js';
import { readFileContent } from '../../../fs/fileContent.js';
import { parseJson } from '../../json/parseJson.js';
import parseYaml from '../../yaml/parseYaml.js';
import sanitizeFileContent from '../../../utils/sanitizeFileContent.js';
import { determineLibraryForCLI } from '../../../fs/determineFramework/index.js';
import { isValidMdx } from '../../../utils/validateMdx.js';
import { hashStringSync, hashVersionId } from '../../../utils/hash.js';
import { configureCustomMapping } from '../../../utils/api.js';
import type { Settings } from '../../../types/index.js';

const aggregateTestFiles = (settings: Partial<Settings>) =>
  aggregateFiles(settings as Settings);

/** Settings whose source files live under /full/path, by file type. */
const settingsFor = (
  files: Record<string, string[]>,
  {
    transformFormats,
    ...settings
  }: Record<string, unknown> & { transformFormats?: object } = {}
) =>
  ({
    files: {
      resolvedPaths: Object.fromEntries(
        Object.entries(files).map(([type, names]) => [
          type,
          names.map((name) => `/full/path/${name}`),
        ])
      ),
      placeholderPaths: {},
      ...(transformFormats && { transformFormats }),
    },
    options: {},
    defaultLocale: 'en',
    ...settings,
  }) as Partial<Settings>;

vi.mock('../../../console/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock('../../../fs/findFilepath.js');
vi.mock('../../../fs/fileContent.js');
vi.mock('../../json/parseJson.js');
vi.mock('../../yaml/parseYaml.js');
vi.mock('../../../utils/sanitizeFileContent.js');
vi.mock('../../../fs/determineFramework/index.js');
vi.mock('../../../utils/validateMdx.js');
// Surface logErrorAndExit as a throw so tests can assert on it
vi.mock('../../../console/logging.js', () => ({
  logErrorAndExit: vi.fn((message: string) => {
    throw new Error(message);
  }),
}));

const mockLogWarning = vi.mocked(logger.warn);
const mockLogErrorAndExit = vi.mocked(logErrorAndExit);
const mockReadFile = vi.mocked(readFile);
const mockReadFileContent = vi.mocked(readFileContent);
const mockGetRelative = vi.mocked(getRelative);
const mockParseJson = vi.mocked(parseJson);
const mockParseYaml = vi.mocked(parseYaml);
const mockSanitizeFileContent = vi.mocked(sanitizeFileContent);
const mockDetermineLibrary = vi.mocked(determineLibraryForCLI);
const mockIsValidMdx = vi.mocked(isValidMdx);

describe('aggregateFiles - Empty File Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    mockGetRelative.mockImplementation((path) =>
      path.replace('/full/path/', '')
    );
    mockReadFileContent.mockReturnValue('');
    mockDetermineLibrary.mockReturnValue({
      library: 'next-intl',
      additionalModules: [],
      directlyDeclaresVue: false,
    });

    // Mock parseJson to return empty string for empty/null content, valid content otherwise
    mockParseJson.mockImplementation((content) => {
      if (!content || !content.trim()) {
        return ''; // Empty files result in empty parsed content
      }
      return 'parsed-json-content';
    });

    // Mock parseYaml to return empty string for empty/null content, valid content otherwise
    mockParseYaml.mockImplementation((content) => {
      if (!content || !content.trim()) {
        return { content: '', fileFormat: 'YAML' }; // Empty files result in empty parsed content
      }
      return {
        content: 'parsed-yaml-content',
        fileFormat: 'YAML',
      };
    });

    mockSanitizeFileContent.mockImplementation((content) => content);
    mockIsValidMdx.mockReset();
    mockIsValidMdx.mockReturnValue({ isValid: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('files with nothing to translate', () => {
    const VALID = {
      json: ['json', '{"key": "value"}'],
      twilioContentJson: ['json', '{"key": "value"}'],
      // .yaml is covered by the mixed-type test below
      yaml: ['yml', 'key: value'],
      mdx: ['mdx', '# Valid MDX'],
    } as const;

    it.each([
      ['an empty JSON file', 'json', '', 'JSON file is not parsable'],
      [
        'an empty Twilio Content JSON file',
        'twilioContentJson',
        '',
        'JSON file is not parsable',
      ],
      [
        'an unparsable Twilio Content JSON file',
        'twilioContentJson',
        '{ invalid json',
        'JSON file is not parsable',
      ],
      [
        'a whitespace-only YAML file',
        'yaml',
        '   \n\t  ',
        'YAML file is empty',
      ],
      ['an empty MDX file', 'mdx', '', 'File is empty after sanitization'],
    ] as const)(
      'skips %s with a warning and keeps the valid files',
      async (_name, type, content, reason) => {
        const [extension, valid] = VALID[type];
        mockReadFile.mockReturnValueOnce(content).mockReturnValueOnce(valid);

        const { files } = await aggregateTestFiles(
          settingsFor({
            [type]: [`skipped.${extension}`, `valid.${extension}`],
          })
        );

        expect(mockLogWarning).toHaveBeenCalledWith(
          `Skipping skipped.${extension}: ${reason}`
        );
        expect(files.map((file) => file.fileName)).toEqual([
          `valid.${extension}`,
        ]);
      }
    );

    it.each([
      ['empty', 'md', '<!-- only comments -->', ''],
      ['whitespace', 'ts', 'some content', '   \n\t  '],
    ])(
      'skips a file that is %s after sanitization',
      async (_name, type, content, sanitized) => {
        mockReadFile
          .mockReturnValueOnce(content)
          .mockReturnValueOnce('# Valid content');
        mockSanitizeFileContent
          .mockReturnValueOnce(sanitized)
          .mockReturnValueOnce('# Valid content');

        const { files } = await aggregateTestFiles(
          settingsFor({ [type]: [`skipped.${type}`, `valid.${type}`] })
        );

        expect(mockLogWarning).toHaveBeenCalledWith(
          `Skipping skipped.${type}: File is empty after sanitization`
        );
        expect(files.map((file) => file.fileName)).toEqual([`valid.${type}`]);
      }
    );

    it('drops a JSON file whose parsed content is empty', async () => {
      mockReadFile
        .mockReturnValueOnce('{"some": "input"}')
        .mockReturnValueOnce('{"key": "value"}');
      mockParseJson
        .mockReturnValueOnce('')
        .mockReturnValueOnce('parsed content');

      const { files } = await aggregateTestFiles(
        settingsFor({ json: ['empty-output.json', 'valid.json'] })
      );

      expect(files).toHaveLength(1);
      expect(files[0]).toMatchObject({
        fileName: 'valid.json',
        content: 'parsed content',
      });
    });

    it('skips empty files of every type and keeps the valid ones in order', async () => {
      mockReadFile
        .mockReturnValueOnce('') // empty.json
        .mockReturnValueOnce('{"key": "value"}') // valid.json
        .mockReturnValueOnce('') // empty.yaml
        .mockReturnValueOnce('{"twilio": "content"}') // valid-twilio.json
        .mockReturnValueOnce('# Valid markdown'); // valid.md

      const { files } = await aggregateTestFiles(
        settingsFor({
          json: ['empty.json', 'valid.json'],
          yaml: ['empty.yaml'],
          twilioContentJson: ['valid-twilio.json'],
          md: ['valid.md'],
        })
      );

      expect(mockLogWarning).toHaveBeenCalledWith(
        'Skipping empty.json: JSON file is not parsable'
      );
      expect(mockLogWarning).toHaveBeenCalledWith(
        'Skipping empty.yaml: YAML file is empty'
      );
      expect(files.map((file) => file.fileName).sort()).toEqual([
        'valid-twilio.json',
        'valid.json',
        'valid.md',
      ]);
    });
  });

  describe('file validation and metadata', () => {
    it('detects JSON data format without project warnings', async () => {
      mockDetermineLibrary.mockReturnValueOnce({
        library: 'base',
        additionalModules: [],
        directlyDeclaresVue: false,
      });
      mockReadFile.mockReturnValueOnce('{"key": "value"}');

      await aggregateTestFiles(settingsFor({ json: ['valid.json'] }));

      expect(mockDetermineLibrary).toHaveBeenCalledWith();
      expect(mockLogWarning).not.toHaveBeenCalledWith(
        expect.stringContaining('No package.json')
      );
    });

    it('uploads Twilio Content JSON as strings with its own file format', async () => {
      mockReadFile.mockReturnValueOnce('{"key": "value"}');

      const { files } = await aggregateTestFiles(
        settingsFor({ twilioContentJson: ['content.json'] })
      );

      expect(files).toHaveLength(1);
      expect(files[0]).toMatchObject({
        fileName: 'content.json',
        fileFormat: 'TWILIO_CONTENT_JSON',
        dataFormat: 'STRING',
      });
    });

    it.each(['json', 'twilioContentJson'])(
      'uploads invalid %s when JSON validation is skipped',
      async (type) => {
        mockReadFile.mockReturnValueOnce('{ invalid json');

        const { files } = await aggregateTestFiles(
          settingsFor(
            { [type]: ['invalid.json'] },
            { options: { skipFileValidation: { json: true } } }
          )
        );

        expect(mockLogWarning).not.toHaveBeenCalled();
        expect(files.map((file) => file.fileName)).toEqual(['invalid.json']);
      }
    );

    it('uploads invalid MDX without validating it when MDX validation is skipped', async () => {
      mockReadFile.mockReturnValueOnce('<>Invalid mdx');
      mockIsValidMdx.mockReturnValueOnce({ isValid: false, error: 'bad' });

      const { files } = await aggregateTestFiles(
        settingsFor(
          { mdx: ['invalid.mdx'] },
          { options: { skipFileValidation: { mdx: true } } }
        )
      );

      expect(mockIsValidMdx).not.toHaveBeenCalled();
      expect(mockLogWarning).not.toHaveBeenCalled();
      expect(files.map((file) => file.fileName)).toEqual(['invalid.mdx']);
    });

    it('attaches the configured transformFormat to POT files', async () => {
      mockReadFile.mockReturnValueOnce('msgid "Hello"');

      const { files } = await aggregateTestFiles(
        settingsFor(
          { pot: ['messages.pot'] },
          { transformFormats: { pot: 'PO' } }
        )
      );

      expect(files).toHaveLength(1);
      expect(files[0]).toMatchObject({
        fileName: 'messages.pot',
        fileFormat: 'POT',
        transformFormat: 'PO',
      });
    });
  });

  describe('Mintlify title inference', () => {
    const mintlify = (file: string, defaultLocale = 'en') =>
      settingsFor(
        { mdx: [file] },
        {
          defaultLocale,
          framework: 'mintlify',
          options: { mintlify: { inferTitleFromFilename: true } },
        }
      );

    it.each([
      ['the file name', 'my-file.mdx', 'en', 'My File'],
      [
        'the parent directory of an index file',
        'docs/getting-started/index.mdx',
        'en',
        'Getting Started',
      ],
      [
        '"Index" for a default-locale index file',
        'es/index.mdx',
        'es',
        'Index',
      ],
    ])(
      'infers a missing title from %s',
      async (_name, file, defaultLocale, title) => {
        mockReadFile.mockReturnValueOnce(
          '---\nsummary: "Hello"\n---\n\n# Content'
        );

        const { files } = await aggregateTestFiles(
          mintlify(file, defaultLocale)
        );

        expect(files).toHaveLength(1);
        expect(files[0].content).toMatch(new RegExp(`title:\\s*"?${title}"?`));
      }
    );

    it('leaves frontmatter that already has a title untouched', async () => {
      const content =
        '---\ntitle: Assistant\ndescription: "Test"\n---\n\n# Content';
      mockReadFile.mockReturnValueOnce(content);

      const { files } = await aggregateTestFiles(mintlify('assistant.mdx'));

      expect(files).toHaveLength(1);
      expect(files[0].content).toBe(content);
    });
  });

  // Both Apple formats read through the same byte-order-mark-aware helper and
  // upload the decoded text, so they assert the same things.
  describe.each([
    {
      label: '.strings',
      settingsKey: 'dotStrings',
      fileFormat: 'DOT_STRINGS',
      extension: 'strings',
      // The escapes below are load-bearing: they must reach the API verbatim.
      content:
        '/* Greeting */\n"hello" = "Line1\\nLine2 \\"quoted\\" 100%%";\n',
    },
    {
      label: '.stringsdict',
      settingsKey: 'dotStringsdict',
      fileFormat: 'DOT_STRINGSDICT',
      extension: 'stringsdict',
      content:
        '<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n<dict>\n  <key>%d file(s) \\"quoted\\"</key>\n</dict>\n</plist>\n',
    },
  ])('$label files', ({ settingsKey, fileFormat, extension, content }) => {
    beforeEach(() => {
      // Make any trip through the markdown-oriented sanitizer detectable: it
      // would strip the backslash escapes the assertions below depend on.
      mockSanitizeFileContent.mockImplementation((value) =>
        value.replace(/\\/g, '')
      );
    });

    it(`should upload ${extension} files verbatim with the ${fileFormat} format`, async () => {
      const settings = {
        files: {
          resolvedPaths: {
            [settingsKey]: [`/full/path/en.lproj/Localizable.${extension}`],
          },
          placeholderPaths: {},
        },
        options: {},
        defaultLocale: 'en',
      };

      mockReadFileContent.mockReturnValueOnce(content);

      const { files: result } = await aggregateTestFiles(settings);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        fileName: `en.lproj/Localizable.${extension}`,
        fileFormat,
        locale: 'en',
      });
      expect(result[0].content).toBe(content);
      expect(result[0].fileId).toBe(
        hashStringSync(`en.lproj/Localizable.${extension}`)
      );
      expect(result[0].versionId).toBe(hashVersionId(content, false));
    });

    it(`should upload the decoded text of a UTF-16 ${extension} file`, async () => {
      const settings = {
        files: {
          resolvedPaths: {
            [settingsKey]: [`/full/path/ja.lproj/Localizable.${extension}`],
          },
          placeholderPaths: {},
        },
        options: {},
        defaultLocale: 'en',
      };

      mockReadFileContent.mockReturnValueOnce(content);

      const { files: result } = await aggregateTestFiles(settings);

      expect(result).toHaveLength(1);
      // The source encoding stays on the client; the API is handed text.
      expect(result[0].content).toBe(content);
      expect(result[0].content).not.toContain('�');
    });

    it(`should skip empty ${extension} files and log a warning`, async () => {
      const settings = {
        files: {
          resolvedPaths: {
            [settingsKey]: [
              `/full/path/empty.${extension}`,
              `/full/path/valid.${extension}`,
            ],
          },
          placeholderPaths: {},
        },
        options: {},
        defaultLocale: 'en',
      };

      mockReadFileContent
        .mockReturnValueOnce('   \n\t  ') // whitespace only
        .mockReturnValueOnce(content); // valid file

      const { files: result } = await aggregateTestFiles(settings);

      expect(mockLogWarning).toHaveBeenCalledWith(
        `Skipping empty.${extension}: File is empty`
      );
      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe(`valid.${extension}`);
    });
  });

  describe('SubRip .srt files', () => {
    // Timing lines, CRLF line endings and the byte order mark are load-bearing:
    // the API splices translated text into this exact content.
    const srtContent =
      '\uFEFF1\r\n00:00:01,000 --> 00:00:02,500\r\n<i>Hello</i>, and welcome back.\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\n- Where were we?\r\n- You were about to leave.\r\n';

    beforeEach(() => {
      mockSanitizeFileContent.mockImplementation((content) =>
        content.replace(/\r/g, '')
      );
    });

    it('uploads .srt files verbatim with the SRT format', async () => {
      const settings = {
        files: {
          resolvedPaths: {
            srt: ['/full/path/subs/film.en.srt'],
          },
          placeholderPaths: {},
        },
        options: {},
        defaultLocale: 'en',
      };

      mockReadFileContent.mockReturnValueOnce(srtContent);

      const { files: result } = await aggregateTestFiles(settings);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        fileName: 'subs/film.en.srt',
        fileFormat: 'SRT',
        locale: 'en',
      });
      expect(result[0].content).toBe(srtContent);
      expect(result[0].fileId).toBe(hashStringSync('subs/film.en.srt'));
      expect(result[0].versionId).toBe(hashVersionId(srtContent, false));
    });

    it('skips an empty .srt file and logs a warning', async () => {
      const settings = {
        files: {
          resolvedPaths: {
            srt: ['/full/path/empty.srt', '/full/path/subs/film.en.srt'],
          },
          placeholderPaths: {},
        },
        options: {},
        defaultLocale: 'en',
      };

      mockReadFileContent
        .mockReturnValueOnce('   \n')
        .mockReturnValueOnce(srtContent);

      const { files: result } = await aggregateTestFiles(settings);

      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe('subs/film.en.srt');
      expect(mockLogWarning).toHaveBeenCalledWith(
        expect.stringContaining('empty.srt')
      );
    });
  });

  describe('.NET .resx files', () => {
    // CRLF line endings, entity escapes and comments are load-bearing: the API
    // writes translated values into this exact content. The reader has already
    // removed any byte order mark, so the content starts at the declaration.
    const resxContent =
      '<?xml version="1.0" encoding="utf-8"?>\r\n<root>\r\n  <data name="Save" xml:space="preserve">\r\n    <value>Save &amp; exit</value>\r\n    <comment>Toolbar button</comment>\r\n  </data>\r\n  <data name="Greeting" xml:space="preserve">\r\n    <value>Hello, {0}!</value>\r\n  </data>\r\n</root>\r\n';

    beforeEach(() => {
      mockSanitizeFileContent.mockImplementation((content) =>
        content.replace(/\r/g, '')
      );
    });

    it('uploads .resx and .resw files verbatim with the RESX format', async () => {
      const settings = {
        files: {
          resolvedPaths: {
            resx: [
              '/full/path/Properties/Resources.resx',
              '/full/path/Strings/en-US/Resources.resw',
            ],
          },
          placeholderPaths: {},
        },
        options: {},
        defaultLocale: 'en',
      };

      mockReadFileContent
        .mockReturnValueOnce(resxContent)
        .mockReturnValueOnce(resxContent);

      const { files: result } = await aggregateTestFiles(settings);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        fileName: 'Properties/Resources.resx',
        fileFormat: 'RESX',
        locale: 'en',
      });
      expect(result[0].content).toBe(resxContent);
      expect(result[0].fileId).toBe(
        hashStringSync('Properties/Resources.resx')
      );
      expect(result[0].versionId).toBe(hashVersionId(resxContent, false));
      expect(result[1]).toMatchObject({
        fileName: 'Strings/en-US/Resources.resw',
        fileFormat: 'RESX',
      });
      expect(result[1].content).toBe(resxContent);
    });

    it('skips an empty .resx file and logs a warning', async () => {
      const settings = {
        files: {
          resolvedPaths: {
            resx: ['/full/path/Empty.resx', '/full/path/Resources.resx'],
          },
          placeholderPaths: {},
        },
        options: {},
        defaultLocale: 'en',
      };

      mockReadFileContent
        .mockReturnValueOnce('  \r\n')
        .mockReturnValueOnce(resxContent);

      const { files: result } = await aggregateTestFiles(settings);

      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe('Resources.resx');
      expect(mockLogWarning).toHaveBeenCalledWith(
        expect.stringContaining('Empty.resx')
      );
    });
  });

  describe('Android strings.xml files', () => {
    // The escapes below are load-bearing: AAPT requires \' and \", and the
    // API relies on receiving them exactly as authored.
    const androidStringsContent =
      '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <string name="greeting">You can\\\'t say \\\"no\\\"</string>\n</resources>\n';

    beforeEach(() => {
      // Make any trip through the markdown-oriented sanitizer detectable: it
      // would strip the backslash escapes the assertions below depend on.
      mockSanitizeFileContent.mockImplementation((content) =>
        content.replace(/\\/g, '')
      );
    });

    it('should upload strings.xml files verbatim with the ANDROID_STRINGS format', async () => {
      const settings = {
        files: {
          resolvedPaths: {
            androidStrings: ['/full/path/res/values/strings.xml'],
          },
          placeholderPaths: {},
        },
        options: {},
        defaultLocale: 'en',
      };

      mockReadFileContent.mockReturnValueOnce(androidStringsContent);

      const { files: result } = await aggregateTestFiles(settings);

      // Exactly one entry: the generic preprocessing loop must skip this file
      // type, or it uploads a second copy under the bogus format
      // `fileType.toUpperCase()`.
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        fileName: 'res/values/strings.xml',
        fileFormat: 'ANDROID_STRINGS',
        locale: 'en',
      });
      expect(result[0].content).toBe(androidStringsContent);
      expect(result[0].fileId).toBe(hashStringSync('res/values/strings.xml'));
      expect(result[0].versionId).toBe(
        hashVersionId(androidStringsContent, false)
      );
    });

    it('should skip empty strings.xml files and log a warning', async () => {
      const settings = {
        files: {
          resolvedPaths: {
            androidStrings: [
              '/full/path/empty.xml',
              '/full/path/res/values/strings.xml',
            ],
          },
          placeholderPaths: {},
        },
        options: {},
        defaultLocale: 'en',
      };

      mockReadFileContent
        .mockReturnValueOnce('   \n\t  ') // whitespace only
        .mockReturnValueOnce(androidStringsContent); // valid file

      const { files: result } = await aggregateTestFiles(settings);

      expect(mockLogWarning).toHaveBeenCalledWith(
        'Skipping empty.xml: File is empty'
      );
      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe('res/values/strings.xml');
    });
  });
});

describe('aggregateFiles - Apple .xcstrings catalogs', () => {
  const catalog = (sourceLanguage: string) =>
    JSON.stringify({
      sourceLanguage,
      version: '1.0',
      strings: {
        greeting: {
          localizations: {
            [sourceLanguage]: {
              stringUnit: { state: 'translated', value: 'Hello' },
            },
          },
        },
      },
    });

  const settingsFor = (
    contents: Record<string, string>,
    defaultLocale = 'en'
  ) => {
    mockReadFile.mockImplementation((filePath) => contents[filePath] ?? '');
    return {
      files: {
        resolvedPaths: { xcstrings: Object.keys(contents) },
        placeholderPaths: {},
      },
      options: {},
      defaultLocale,
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRelative.mockImplementation((path) =>
      path.replace('/full/path/', '')
    );
  });

  afterEach(() => {
    configureCustomMapping({});
  });

  it('stops the run before anything is uploaded when a catalog sourceLanguage does not match defaultLocale', async () => {
    const settings = settingsFor({
      '/full/path/App/Localizable.xcstrings': catalog('en'),
      '/full/path/Legacy/Localizable.xcstrings': catalog('de'),
    });

    await expect(aggregateTestFiles(settings)).rejects.toThrow();

    expect(mockLogErrorAndExit).toHaveBeenCalledTimes(1);
    const message = mockLogErrorAndExit.mock.calls[0][0];
    expect(message).toContain('Legacy/Localizable.xcstrings');
    expect(message).toContain('sourceLanguage "de"');
    expect(message).toContain('defaultLocale "en"');
    expect(message).toContain('gt.config.json');
    expect(message).not.toContain('App/Localizable.xcstrings');
    // A configuration error is not reported as a skipped file
    expect(mockLogWarning).not.toHaveBeenCalled();
  });

  it('accepts a defaultLocale alias whose canonical tag is the catalog sourceLanguage', async () => {
    configureCustomMapping({ french: { code: 'fr' } });
    const settings = settingsFor(
      { '/full/path/App/Localizable.xcstrings': catalog('fr') },
      'french'
    );

    const { files } = await aggregateTestFiles(settings);

    expect(mockLogErrorAndExit).not.toHaveBeenCalled();
    expect(mockLogWarning).not.toHaveBeenCalled();
    expect(files.map((file) => file.fileName)).toEqual([
      'App/Localizable.xcstrings',
    ]);
    // The upload keeps the configured locale, as translation slices do
    expect(files[0].locale).toBe('french');
  });

  it('skips a catalog that cannot be parsed and uploads the rest', async () => {
    const settings = settingsFor({
      '/full/path/Broken/Localizable.xcstrings': '{"strings": {}}',
      '/full/path/App/Localizable.xcstrings': catalog('en'),
    });

    const { files } = await aggregateTestFiles(settings);

    expect(mockLogErrorAndExit).not.toHaveBeenCalled();
    expect(mockLogWarning).toHaveBeenCalledTimes(1);
    expect(mockLogWarning).toHaveBeenCalledWith(
      expect.stringMatching(/^Skipping Broken\/Localizable\.xcstrings: /)
    );
    expect(files.map((file) => file.fileName)).toEqual([
      'App/Localizable.xcstrings',
    ]);
    expect(files[0].fileFormat).toBe('XCSTRINGS');
  });
});
