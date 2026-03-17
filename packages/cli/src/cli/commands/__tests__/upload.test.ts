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
    const files = (vi as any).__mockFiles;
    return files?.[filePath] ?? '';
  }),
  getRelative: vi.fn((filePath: string) => filePath),
}));
vi.mock('../../../workflows/upload.js', () => ({
  runUploadFilesWorkflow: vi.fn(),
}));
vi.mock('../../../formats/files/fileMapping.js', () => ({
  createFileMapping: vi.fn(() => ({})),
}));
vi.mock('../../../utils/hash.js', () => ({
  hashStringSync: vi.fn((s: string) => `hash_${s.slice(0, 16)}`),
}));
vi.mock('./utils/validation.js', () => ({
  hasValidCredentials: vi.fn(() => true),
}));

// Mock node:fs for existsSync/readFileSync (translation file reads)
vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => ''),
}));

import { readFile } from '../../../fs/findFilepath.js';
import { runUploadFilesWorkflow } from '../../../workflows/upload.js';
import { createFileMapping } from '../../../formats/files/fileMapping.js';
import { existsSync, readFileSync } from 'node:fs';

function setMockFiles(files: Record<string, string>) {
  (vi as any).__mockFiles = files;
  vi.mocked(readFile).mockImplementation((filePath: string) => {
    return files[filePath] ?? '';
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
    ...overrides,
  } as Settings & UploadOptions;
}

describe('upload - Twilio Content JSON', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    await upload(filePaths, {}, {} as TransformFiles, 'JSX', settings);

    expect(runUploadFilesWorkflow).toHaveBeenCalledTimes(1);
    const call = vi.mocked(runUploadFilesWorkflow).mock.calls[0][0];
    expect(call.files).toHaveLength(1);
    expect(call.files[0].source.fileFormat).toBe('TWILIO_CONTENT_JSON');
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

    await upload(filePaths, {}, {} as TransformFiles, 'JSX', settings);

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

    await upload(filePaths, {}, {} as TransformFiles, 'JSX', settings);

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

describe('upload - composite JSON', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    await upload(filePaths, {}, {} as TransformFiles, 'JSX', settings);

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

    await upload(filePaths, {}, {} as TransformFiles, 'JSX', settings);

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

    await upload(filePaths, {}, {} as TransformFiles, 'JSX', settings);

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
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(translatedContent);

    await upload(filePaths, {}, {} as TransformFiles, 'JSX', settings);

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

    await upload(filePaths, {}, {} as TransformFiles, 'JSX', settings);

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
