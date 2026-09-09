import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { upload } from '../upload';
import type {
  ResolvedFiles,
  Settings,
  TransformFiles,
} from '../../../types/index.js';
import type { UploadOptions } from '../../base.js';

vi.mock('../../../console/logger.js');
vi.mock('../../../console/logging.js', () => ({
  exitSync: vi.fn(() => {
    throw new Error('Process exit called');
  }),
  logErrorAndExit: vi.fn(),
}));
vi.mock('../../../fs/findFilepath.js', () => ({
  readFile: vi.fn((filePath: string) => {
    const files = (vi as unknown).__mockFiles;
    return files?.[filePath] ?? '';
  }),
  getRelative: vi.fn((filePath: string) => filePath),
  readBinaryFileBase64: vi.fn((filePath: string) => {
    const files = (vi as unknown).__mockBinaryFiles;
    return files?.[filePath] ?? '';
  }),
}));
vi.mock('../../../workflows/upload.js', () => ({
  runUploadFilesWorkflow: vi.fn(async () => ({
    branchData: { currentBranch: { id: 'branch-id' } },
  })),
}));
vi.mock('../../../workflows/publish.js', () => ({
  runPublishWorkflow: vi.fn(),
}));
vi.mock('../../../formats/files/fileMapping.js', () => ({
  createFileMapping: vi.fn(() => ({})),
}));
vi.mock('../../../utils/hash.js', () => ({
  hashStringSync: vi.fn((s: string) => `hash_${s.slice(0, 16)}`),
  hashVersionId: vi.fn(
    (s: string, requiresReview: boolean) =>
      `hash_${requiresReview ? 'rr_' : ''}${s.slice(0, 16)}`
  ),
}));
vi.mock('./utils/validation.js', () => ({
  hasValidCredentials: vi.fn(() => true),
}));

// Mock node:fs for the translation file reads readFileContent performs
const mockFs = vi.hoisted(() => ({
  existsSync: vi.fn(() => false),
  statSync: vi.fn(() => ({ isFile: () => true })),
  readFileSync: vi.fn(() => ''),
}));

vi.mock('node:fs', () => ({
  default: mockFs,
  existsSync: mockFs.existsSync,
  statSync: mockFs.statSync,
  readFileSync: mockFs.readFileSync,
}));
vi.mock('../../../fs/determineFramework/index.js', () => ({
  determineLibrary: vi.fn(() => ({ library: 'base', additionalModules: [] })),
}));

import { readFile, readBinaryFileBase64 } from '../../../fs/findFilepath.js';
import { runUploadFilesWorkflow } from '../../../workflows/upload.js';
import { runPublishWorkflow } from '../../../workflows/publish.js';
import { createFileMapping } from '../../../formats/files/fileMapping.js';
import { logger } from '../../../console/logger.js';
import { existsSync, readFileSync } from 'node:fs';
import { logErrorAndExit } from '../../../console/logging.js';
import { gt } from '../../../utils/gt.js';

function setMockFiles(files: Record<string, string>) {
  (vi as unknown).__mockFiles = files;
  vi.mocked(readFile).mockImplementation((filePath: string) => {
    return files[filePath] ?? '';
  });
}

// Binary fixtures are stored base64-encoded, mirroring readBinaryFileBase64.
function setMockBinaryFiles(files: Record<string, string>) {
  (vi as unknown).__mockBinaryFiles = files;
  vi.mocked(readBinaryFileBase64).mockImplementation((filePath: string) => {
    return files[filePath] ?? '';
  });
  // Translations go through readFileContent, which reads binary formats as
  // raw bytes off the filesystem rather than through findFilepath.
  vi.mocked(readFileSync).mockImplementation((filePath) => {
    const base64 = files[String(filePath)];
    return base64 === undefined ? '' : Buffer.from(base64, 'base64');
  });
}

function makeSettings(
  overrides: Partial<Settings & UploadOptions> = {}
): Settings & UploadOptions {
  return {
    defaultLocale: 'en',
    locales: ['es', 'fr'],
    projectId: 'test-project',
    apiKey: 'test-key',
    files: {
      resolvedPaths: {},
      placeholderPaths: {},
      transformPaths: {},
      transformFormats: {},
      publishPaths: new Set<string>(),
      unpublishPaths: new Set<string>(),
      requiresReviewPaths: new Set<string>(),
      parsingFlags: {},
      gtJson: {
        parsingFlags: {},
      },
    },
    ...overrides,
  } as Settings & UploadOptions;
}

async function uploadWithFiles(
  filePaths: ResolvedFiles,
  settings: Settings & UploadOptions,
  placeholderPaths: ResolvedFiles = {},
  transformPaths: TransformFiles = {}
) {
  await upload({
    ...settings,
    files: {
      ...settings.files,
      resolvedPaths: filePaths,
      placeholderPaths,
      transformPaths,
    },
  } as Settings & UploadOptions);
}

describe('upload - Twilio Content JSON', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readFileSync).mockReturnValue('');
    vi.mocked(createFileMapping).mockReturnValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should upload Twilio Content JSON files with TWILIO_CONTENT_JSON fileFormat', async () => {
    const content = JSON.stringify({ body: 'Hello {{1}}' });
    setMockFiles({ 'twilio/content.json': content });

    const filePaths: ResolvedFiles = {
      twilioContentJson: ['twilio/content.json'],
    };
    const settings = makeSettings({ options: {} });

    await uploadWithFiles(filePaths, settings);

    expect(runUploadFilesWorkflow).toHaveBeenCalledTimes(1);
    const call = vi.mocked(runUploadFilesWorkflow).mock.calls[0][0];
    expect(call.files).toHaveLength(1);
    expect(call.files[0].source.fileFormat).toBe('TWILIO_CONTENT_JSON');
    expect(runPublishWorkflow).toHaveBeenCalledTimes(1);
    expect(vi.mocked(runPublishWorkflow).mock.calls[0][2]).toBe('branch-id');
  });

  it('should use fileMapping for Twilio Content JSON files (no composite)', async () => {
    const content = JSON.stringify({ body: 'Hello' });
    const translatedContent = JSON.stringify({ body: 'Hola' });
    setMockFiles({ 'twilio/content.json': content });

    const filePaths: ResolvedFiles = {
      twilioContentJson: ['twilio/content.json'],
    };
    const settings = makeSettings({ locales: ['es'], options: {} });

    vi.mocked(createFileMapping).mockReturnValue({
      es: { 'twilio/content.json': 'twilio/es/content.json' },
    });
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(translatedContent);

    await uploadWithFiles(filePaths, settings);

    const call = vi.mocked(runUploadFilesWorkflow).mock.calls[0][0];
    const fileData = call.files[0];

    expect(fileData.translations).toHaveLength(1);
    expect(fileData.translations[0].locale).toBe('es');
    expect(fileData.translations[0].content).toBe(translatedContent);
  });

  it('should handle mix of regular JSON and Twilio Content JSON', async () => {
    const jsonContent = JSON.stringify({ title: 'Hello' });
    const twilioContent = JSON.stringify({ body: 'Hi {{1}}' });
    setMockFiles({
      'messages.json': jsonContent,
      'twilio/content.json': twilioContent,
    });

    const filePaths: ResolvedFiles = {
      json: ['messages.json'],
      twilioContentJson: ['twilio/content.json'],
    };
    const settings = makeSettings({ locales: ['es'], options: {} });

    await uploadWithFiles(filePaths, settings);

    const call = vi.mocked(runUploadFilesWorkflow).mock.calls[0][0];
    expect(call.files).toHaveLength(2);

    const jsonFile = call.files.find(
      (f) => f.source.fileName === 'messages.json'
    );
    const twilioFile = call.files.find(
      (f) => f.source.fileName === 'twilio/content.json'
    );

    expect(jsonFile?.source.fileFormat).toBe('JSON');
    expect(twilioFile?.source.fileFormat).toBe('TWILIO_CONTENT_JSON');
  });
});

describe('upload - binary (LOTTIE) files', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readFileSync).mockReturnValue('');
    vi.mocked(createFileMapping).mockReturnValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('round-trips source and translation bytes through base64 without UTF-8 decoding', async () => {
    // Zip magic plus bytes that are invalid UTF-8 — a utf8 read would corrupt them.
    const sourceBytes = Buffer.from([
      0x50, 0x4b, 0x03, 0x04, 0x00, 0xff, 0xfe, 0x80,
    ]);
    const translatedBytes = Buffer.from([
      0x50, 0x4b, 0x03, 0x04, 0x01, 0xfd, 0x00, 0x81,
    ]);
    setMockFiles({});
    setMockBinaryFiles({
      'anim/en.lottie': sourceBytes.toString('base64'),
      'anim/es.lottie': translatedBytes.toString('base64'),
    });

    const filePaths: ResolvedFiles = { lottie: ['anim/en.lottie'] };
    const settings = makeSettings({ locales: ['es'], options: {} });

    vi.mocked(createFileMapping).mockReturnValue({
      es: { 'anim/en.lottie': 'anim/es.lottie' },
    });
    vi.mocked(existsSync).mockReturnValue(true);

    await uploadWithFiles(filePaths, settings);

    expect(runUploadFilesWorkflow).toHaveBeenCalledTimes(1);
    const call = vi.mocked(runUploadFilesWorkflow).mock.calls[0][0];
    expect(call.files).toHaveLength(1);
    const { source, translations } = call.files[0];

    expect(source.fileFormat).toBe('LOTTIE');
    expect(Buffer.from(source.content, 'base64').equals(sourceBytes)).toBe(
      true
    );

    expect(translations).toHaveLength(1);
    expect(translations[0].locale).toBe('es');
    expect(translations[0].fileFormat).toBe('LOTTIE');
    expect(
      Buffer.from(translations[0].content, 'base64').equals(translatedBytes)
    ).toBe(true);
    // The translated bundle must never be read as UTF-8 text.
    for (const call of vi.mocked(readFileSync).mock.calls) {
      expect(call[1]).toBeUndefined();
    }
  });
});

describe('upload - empty file list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readFileSync).mockReturnValue('');
    vi.mocked(createFileMapping).mockReturnValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits only the upload-specific empty files message', async () => {
    setMockFiles({});

    await uploadWithFiles({}, makeSettings({ options: {} }));

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      'No files to upload were found. Check your configuration and try again.'
    );
    expect(runUploadFilesWorkflow).not.toHaveBeenCalled();
    expect(runPublishWorkflow).not.toHaveBeenCalled();
  });
});

describe('upload - companion metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readFileSync).mockReturnValue('');
    vi.mocked(createFileMapping).mockReturnValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('attaches companion metadata to the source file instead of uploading it separately', async () => {
    const sourceContent = JSON.stringify({
      title: 'Hello',
      body: 'World',
    });
    const metadataContent = JSON.stringify({
      title: { context: 'Hero title' },
      body: { maxChars: 120 },
    });
    setMockFiles({
      'source.json': sourceContent,
      'source.metadata.json': metadataContent,
    });

    const filePaths: ResolvedFiles = {
      json: ['source.json', 'source.metadata.json'],
    };
    const settings = makeSettings({ locales: [], options: {} });

    vi.mocked(existsSync).mockImplementation(
      (filePath) => filePath === 'source.metadata.json'
    );
    vi.mocked(readFileSync).mockImplementation((filePath) => {
      if (filePath === 'source.metadata.json') {
        return metadataContent;
      }
      return '';
    });

    await uploadWithFiles(filePaths, settings);

    expect(runUploadFilesWorkflow).toHaveBeenCalledTimes(1);
    const call = vi.mocked(runUploadFilesWorkflow).mock.calls[0][0];

    expect(call.files).toHaveLength(1);
    expect(call.files[0].source.fileName).toBe('source.json');
    expect(call.files[0].source.formatMetadata).toEqual({
      keyedMetadata: {
        title: { context: 'Hero title' },
        body: { maxChars: 120 },
      },
    });
  });
});

describe('upload - composite JSON', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readFileSync).mockReturnValue('');
    vi.mocked(createFileMapping).mockReturnValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should extract translations from composite array JSON', async () => {
    const compositeContent = JSON.stringify({
      items: [
        { locale: 'en', title: 'Hello', desc: 'World' },
        { locale: 'es', title: 'Hola', desc: 'Mundo' },
        { locale: 'fr', title: 'Bonjour', desc: 'Monde' },
      ],
    });

    setMockFiles({ 'source.json': compositeContent });

    const filePaths: ResolvedFiles = { json: ['source.json'] };
    const settings = makeSettings({
      locales: ['es', 'fr'],
      options: {
        jsonSchema: {
          '**/*.json': {
            composite: {
              '$.items': {
                type: 'array',
                include: ['$.title', '$.desc'],
                key: '$.locale',
              },
            },
          },
        },
      },
    });

    await uploadWithFiles(filePaths, settings);

    expect(runUploadFilesWorkflow).toHaveBeenCalledTimes(1);
    const call = vi.mocked(runUploadFilesWorkflow).mock.calls[0][0];
    const fileData = call.files[0];

    // Source should be the parsed composite (default locale extracted)
    expect(fileData.source.locale).toBe('en');

    // Should have 2 translations extracted from the same file
    expect(fileData.translations).toHaveLength(2);
    expect(fileData.translations[0].locale).toBe('es');
    expect(fileData.translations[1].locale).toBe('fr');

    // Verify extracted content contains translated values
    const esContent = JSON.parse(fileData.translations[0].content);
    expect(esContent['/items']['/0']['/title']).toBe('Hola');
    expect(esContent['/items']['/0']['/desc']).toBe('Mundo');

    const frContent = JSON.parse(fileData.translations[1].content);
    expect(frContent['/items']['/0']['/title']).toBe('Bonjour');
    expect(frContent['/items']['/0']['/desc']).toBe('Monde');
  });

  it('should extract translations from composite object JSON', async () => {
    const compositeContent = JSON.stringify({
      translations: {
        en: { title: 'Hello', desc: 'World' },
        es: { title: 'Hola', desc: 'Mundo' },
      },
    });

    setMockFiles({ 'source.json': compositeContent });

    const filePaths: ResolvedFiles = { json: ['source.json'] };
    const settings = makeSettings({
      locales: ['es'],
      options: {
        jsonSchema: {
          '**/*.json': {
            composite: {
              '$.translations': {
                type: 'object',
                include: ['$.title', '$.desc'],
              },
            },
          },
        },
      },
    });

    await uploadWithFiles(filePaths, settings);

    expect(runUploadFilesWorkflow).toHaveBeenCalledTimes(1);
    const call = vi.mocked(runUploadFilesWorkflow).mock.calls[0][0];
    const fileData = call.files[0];

    expect(fileData.translations).toHaveLength(1);
    expect(fileData.translations[0].locale).toBe('es');

    const esContent = JSON.parse(fileData.translations[0].content);
    expect(esContent['/translations']['/title']).toBe('Hola');
    expect(esContent['/translations']['/desc']).toBe('Mundo');
  });

  it('should skip locale when extractJson returns null (locale not in file)', async () => {
    const compositeContent = JSON.stringify({
      items: [
        { locale: 'en', title: 'Hello' },
        { locale: 'es', title: 'Hola' },
      ],
    });

    setMockFiles({ 'source.json': compositeContent });

    const filePaths: ResolvedFiles = { json: ['source.json'] };
    const settings = makeSettings({
      locales: ['es', 'fr'], // fr is not in the file
      options: {
        jsonSchema: {
          '**/*.json': {
            composite: {
              '$.items': {
                type: 'array',
                include: ['$.title'],
                key: '$.locale',
              },
            },
          },
        },
      },
    });

    await uploadWithFiles(filePaths, settings);

    const call = vi.mocked(runUploadFilesWorkflow).mock.calls[0][0];
    const fileData = call.files[0];

    // es should be extracted with content, fr gets an empty composite result
    expect(fileData.translations).toHaveLength(2);
    expect(fileData.translations[0].locale).toBe('es');
    expect(fileData.translations[1].locale).toBe('fr');

    // es has real content
    const esContent = JSON.parse(fileData.translations[0].content);
    expect(esContent['/items']['/0']['/title']).toBe('Hola');

    // fr has empty composite result
    const frContent = JSON.parse(fileData.translations[1].content);
    expect(frContent).toEqual({});
  });

  it('should use fileMapping for non-composite JSON files', async () => {
    const plainContent = JSON.stringify({ title: 'Hello' });
    const translatedContent = JSON.stringify({ title: 'Hola' });

    setMockFiles({ 'source.json': plainContent });

    // No jsonSchema = no composite detection
    const filePaths: ResolvedFiles = { json: ['source.json'] };
    const settings = makeSettings({
      locales: ['es'],
      options: {},
    });

    vi.mocked(createFileMapping).mockReturnValue({
      es: { 'source.json': 'es/source.json' },
    });
    vi.mocked(existsSync).mockImplementation((p) => p === 'es/source.json');
    vi.mocked(readFileSync).mockReturnValue(translatedContent);

    await uploadWithFiles(filePaths, settings);

    const call = vi.mocked(runUploadFilesWorkflow).mock.calls[0][0];
    const fileData = call.files[0];

    // Should use fileMapping to find separate translation file
    expect(fileData.translations).toHaveLength(1);
    expect(fileData.translations[0].locale).toBe('es');
    expect(fileData.translations[0].content).toBe(translatedContent);
  });

  it('should handle mix of composite and non-composite JSON files', async () => {
    const compositeContent = JSON.stringify({
      items: [
        { locale: 'en', title: 'Hello' },
        { locale: 'es', title: 'Hola' },
      ],
    });
    const plainContent = JSON.stringify({ greeting: 'Hi' });
    const translatedPlain = JSON.stringify({ greeting: 'Hola' });

    setMockFiles({
      'composite.json': compositeContent,
      'plain.json': plainContent,
    });

    const filePaths: ResolvedFiles = {
      json: ['composite.json', 'plain.json'],
    };
    const settings = makeSettings({
      locales: ['es'],
      options: {
        jsonSchema: {
          'composite.json': {
            composite: {
              '$.items': {
                type: 'array',
                include: ['$.title'],
                key: '$.locale',
              },
            },
          },
        },
      },
    });

    vi.mocked(createFileMapping).mockReturnValue({
      es: { 'plain.json': 'es/plain.json' },
    });
    vi.mocked(existsSync).mockImplementation((p) => p === 'es/plain.json');
    vi.mocked(readFileSync).mockReturnValue(translatedPlain);

    await uploadWithFiles(filePaths, settings);

    const call = vi.mocked(runUploadFilesWorkflow).mock.calls[0][0];

    // composite.json: translations extracted from same file
    const compositeFile = call.files.find(
      (f) => f.source.fileName === 'composite.json'
    );
    expect(compositeFile?.translations).toHaveLength(1);
    expect(compositeFile?.translations[0].locale).toBe('es');
    const esContent = JSON.parse(compositeFile!.translations[0].content);
    expect(esContent['/items']['/0']['/title']).toBe('Hola');

    // plain.json: translations from separate file via fileMapping
    const plainFile = call.files.find(
      (f) => f.source.fileName === 'plain.json'
    );
    expect(plainFile?.translations).toHaveLength(1);
    expect(plainFile?.translations[0].content).toBe(translatedPlain);
  });
});

describe('upload - Apple .strings translations that cannot be decoded', () => {
  const SOURCE = 'Guardian/en.lproj/Localizable.strings';
  const TRANSLATION = 'Guardian/es.lproj/Localizable.strings';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readFileSync).mockReturnValue('');
    vi.mocked(createFileMapping).mockReturnValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('names the file that could not be read and uploads the rest', async () => {
    const source = Buffer.from('"welcome" = "Welcome!";\n', 'utf8');
    // A UTF-16 byte order mark over an odd number of bytes: the file claims an
    // encoding its contents cannot be read as.
    const truncated = Buffer.from([0xff, 0xfe, 0x22, 0x61, 0x22]);

    setMockFiles({});
    vi.mocked(readFileSync).mockImplementation((filePath) =>
      String(filePath) === TRANSLATION ? truncated : source
    );
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(createFileMapping).mockReturnValue({
      es: { [SOURCE]: TRANSLATION },
    });

    await uploadWithFiles(
      { dotStrings: [SOURCE] },
      makeSettings({ locales: ['es'], options: {} })
    );

    // The run continues rather than aborting on the one unreadable file.
    expect(logErrorAndExit).not.toHaveBeenCalled();

    const warning = vi
      .mocked(logger.warn)
      .mock.calls.map((call) => String(call[0]))
      .find((message) => message.includes(TRANSLATION));
    expect(warning).toBeDefined();

    // The source still uploads; only the locale that could not be decoded is
    // left out, so the rest of the run is unaffected.
    const call = vi.mocked(runUploadFilesWorkflow).mock.calls[0][0];
    const uploaded = call.files.find((f) => f.source.fileName === SOURCE);
    expect(uploaded).toBeDefined();
    expect(uploaded?.translations).toHaveLength(0);
  });
});

describe('upload - Apple .xcstrings catalogs', () => {
  const CATALOG = 'App/Localizable.xcstrings';
  const catalogContent = JSON.stringify({
    sourceLanguage: 'en',
    unknownRoot: { keep: true },
    strings: {
      Save: {},
      greeting: {
        comment: 'Home screen',
        unknownEntryField: 7,
        localizations: {
          en: { stringUnit: { state: 'translated', value: 'Hello' } },
          de: { stringUnit: { state: 'translated', value: 'Hallo' } },
          fr: { stringUnit: { state: 'translated', value: 'Bonjour' } },
          ar: {
            stringUnit: { state: 'translated', value: 'مرحبا' },
            unknownLocalizationField: { deep: 'value' },
          },
        },
      },
      'items.count': {
        localizations: {
          en: { stringUnit: { state: 'translated', value: '%d items' } },
          de: { stringUnit: { state: 'translated', value: '%d Elemente' } },
        },
      },
    },
    version: '1.0',
  });

  type Catalog = {
    sourceLanguage: string;
    strings: Record<
      string,
      { localizations?: Record<string, unknown>; [key: string]: unknown }
    >;
    [key: string]: unknown;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('');
    // Every locale maps to the shared catalog path; the file always exists,
    // which is exactly what used to make the whole catalog upload per locale.
    vi.mocked(createFileMapping).mockReturnValue({
      de: { [CATALOG]: CATALOG },
      fr: { [CATALOG]: CATALOG },
      ar: { [CATALOG]: CATALOG },
      ja: { [CATALOG]: CATALOG },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('slices an aliased locale by its canonical tag and uploads it under the alias', async () => {
    setMockFiles({ [CATALOG]: catalogContent });
    vi.mocked(createFileMapping).mockReturnValue({
      french: { [CATALOG]: CATALOG },
    });
    gt.setConfig({ customMapping: { french: { code: 'fr' } } });
    try {
      await uploadWithFiles(
        { xcstrings: [CATALOG] },
        makeSettings({ locales: ['french'], options: {} })
      );
    } finally {
      gt.setConfig({ customMapping: {} });
    }

    expect(logErrorAndExit).not.toHaveBeenCalled();
    const { translations } = vi.mocked(runUploadFilesWorkflow).mock.calls[0][0]
      .files[0];
    expect(translations.map((t) => t.locale)).toEqual(['french']);
    const slice = JSON.parse(translations[0].content) as Catalog;
    expect(Object.keys(slice.strings.greeting.localizations!)).toEqual(['fr']);
  });

  it('uploads one single-locale slice per locale the catalog carries', async () => {
    setMockFiles({ [CATALOG]: catalogContent });

    await uploadWithFiles(
      { xcstrings: [CATALOG] },
      makeSettings({ locales: ['de', 'fr', 'ar', 'ja'], options: {} })
    );

    expect(logErrorAndExit).not.toHaveBeenCalled();
    const call = vi.mocked(runUploadFilesWorkflow).mock.calls[0][0];
    expect(call.files).toHaveLength(1);
    const { source, translations } = call.files[0];

    expect(source.fileFormat).toBe('XCSTRINGS');
    const sourceSlice = JSON.parse(source.content) as Catalog;
    expect(Object.keys(sourceSlice.strings)).toEqual([
      'Save',
      'greeting',
      'items.count',
    ]);
    expect(Object.keys(sourceSlice.strings.greeting.localizations!)).toEqual([
      'en',
    ]);

    // ja is configured but absent from the catalog, so it is skipped
    expect(translations.map((t) => t.locale)).toEqual(['de', 'fr', 'ar']);
    for (const translation of translations) {
      expect(translation.fileName).toBe(CATALOG);
      expect(translation.fileFormat).toBe('XCSTRINGS');
      expect(translation.fileId).toBe(source.fileId);
      expect(translation.versionId).toBe(source.versionId);
      const slice = JSON.parse(translation.content) as Catalog;
      expect(slice.sourceLanguage).toBe('en');
      for (const entry of Object.values(slice.strings)) {
        expect(Object.keys(entry.localizations!)).toEqual([translation.locale]);
      }
    }

    const de = JSON.parse(translations[0].content) as Catalog;
    const ar = JSON.parse(translations[2].content) as Catalog;
    // Entries without the locale are absent; the implicit "Save" never appears
    expect(Object.keys(de.strings)).toEqual(['greeting', 'items.count']);
    expect(Object.keys(ar.strings)).toEqual(['greeting']);
    expect(de.strings.greeting.localizations!.de).toEqual({
      stringUnit: { state: 'translated', value: 'Hallo' },
    });

    // Unknown fields survive at every level; entry-level fields travel along
    expect(ar.unknownRoot).toEqual({ keep: true });
    expect(ar.version).toBe('1.0');
    expect(ar.strings.greeting.comment).toBe('Home screen');
    expect(ar.strings.greeting.unknownEntryField).toBe(7);
    expect(ar.strings.greeting.localizations!.ar).toEqual({
      stringUnit: { state: 'translated', value: 'مرحبا' },
      unknownLocalizationField: { deep: 'value' },
    });

    // The whole catalog is never uploaded as a translation
    for (const translation of translations) {
      expect(translation.content).not.toBe(catalogContent);
      expect(translation.content).toBe(
        JSON.stringify(JSON.parse(translation.content), null, 2) + '\n'
      );
    }
  });

  it('uploads the source alone when the catalog carries no target locale', async () => {
    setMockFiles({
      [CATALOG]: JSON.stringify({
        sourceLanguage: 'en',
        strings: {
          Save: {},
          greeting: {
            localizations: {
              en: { stringUnit: { state: 'translated', value: 'Hello' } },
            },
          },
        },
      }),
    });

    await uploadWithFiles(
      { xcstrings: [CATALOG] },
      makeSettings({ locales: ['de', 'fr'], options: {} })
    );

    const call = vi.mocked(runUploadFilesWorkflow).mock.calls[0][0];
    expect(call.files).toHaveLength(1);
    expect(call.files[0].translations).toHaveLength(0);
  });
});
