import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aggregateFiles } from '../translate';
import { logWarning } from '../../../console/logging.js';
import { readFile, getRelative } from '../../../fs/findFilepath.js';
import { parseJson } from '../../json/parseJson.js';
import parseYaml from '../../yaml/parseYaml.js';
import sanitizeFileContent from '../../../utils/sanitizeFileContent.js';
import { determineLibrary } from '../../../fs/determineFramework.js';
import { isValidMdx } from '../../../utils/validateMdx.js';

vi.mock('../../../console/logging.js');
vi.mock('../../../fs/findFilepath.js');
vi.mock('../../json/parseJson.js');
vi.mock('../../yaml/parseYaml.js');
vi.mock('../../../utils/sanitizeFileContent.js');
vi.mock('../../../fs/determineFramework.js');
vi.mock('../../../utils/validateMdx.js');

const mockLogWarning = vi.mocked(logWarning);
const mockReadFile = vi.mocked(readFile);
const mockGetRelative = vi.mocked(getRelative);
const mockParseJson = vi.mocked(parseJson);
const mockParseYaml = vi.mocked(parseYaml);
const mockSanitizeFileContent = vi.mocked(sanitizeFileContent);
const mockDetermineLibrary = vi.mocked(determineLibrary);
const mockIsValidMdx = vi.mocked(isValidMdx);

describe('aggregateFiles - Empty File Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mocks
    mockGetRelative.mockImplementation((path) => path.replace('/full/path/', ''));
    mockDetermineLibrary.mockReturnValue({ library: 'next-intl', additionalModules: [] });
    mockParseJson.mockReturnValue('parsed-json-content');
    mockParseYaml.mockReturnValue({ content: 'parsed-yaml-content', fileFormat: 'YAML' });
    mockSanitizeFileContent.mockImplementation((content) => content);
    mockIsValidMdx.mockReturnValue({ isValid: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('JSON files', () => {
    it('should skip empty JSON files and log warning', async () => {
      const settings = {
        files: {
          resolvedPaths: {
            json: ['/full/path/empty.json', '/full/path/valid.json']
          },
          placeholderPaths: {}
        },
        options: {},
        defaultLocale: 'en'
      };

      mockReadFile
        .mockReturnValueOnce('') // empty file
        .mockReturnValueOnce('{"key": "value"}'); // valid file

      const result = await aggregateFiles(settings as any);

      expect(mockLogWarning).toHaveBeenCalledWith('Skipping empty.json: File is empty');
      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe('valid.json');
    });

    it('should skip JSON files with only whitespace and log warning', async () => {
      const settings = {
        files: {
          resolvedPaths: {
            json: ['/full/path/whitespace.json', '/full/path/valid.json']
          },
          placeholderPaths: {}
        },
        options: {},
        defaultLocale: 'en'
      };

      mockReadFile
        .mockReturnValueOnce('   \n\t  ') // whitespace only
        .mockReturnValueOnce('{"key": "value"}'); // valid file

      const result = await aggregateFiles(settings as any);

      expect(mockLogWarning).toHaveBeenCalledWith('Skipping whitespace.json: File is empty');
      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe('valid.json');
    });

    it('should skip JSON files that return null content and log warning', async () => {
      const settings = {
        files: {
          resolvedPaths: {
            json: ['/full/path/null.json', '/full/path/valid.json']
          },
          placeholderPaths: {}
        },
        options: {},
        defaultLocale: 'en'
      };

      mockReadFile
        .mockReturnValueOnce(null as any) // null content
        .mockReturnValueOnce('{"key": "value"}'); // valid file

      const result = await aggregateFiles(settings as any);

      expect(mockLogWarning).toHaveBeenCalledWith('Skipping null.json: File is empty');
      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe('valid.json');
    });
  });

  describe('YAML files', () => {
    it('should skip empty YAML files and log warning', async () => {
      const settings = {
        files: {
          resolvedPaths: {
            yaml: ['/full/path/empty.yaml', '/full/path/valid.yaml']
          },
          placeholderPaths: {}
        },
        options: {}
      };

      mockReadFile
        .mockReturnValueOnce('') // empty file
        .mockReturnValueOnce('key: value'); // valid file

      const result = await aggregateFiles(settings as any);

      expect(mockLogWarning).toHaveBeenCalledWith('Skipping empty.yaml: File is empty');
      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe('valid.yaml');
    });

    it('should skip YAML files with only whitespace and log warning', async () => {
      const settings = {
        files: {
          resolvedPaths: {
            yaml: ['/full/path/whitespace.yml', '/full/path/valid.yml']
          },
          placeholderPaths: {}
        },
        options: {}
      };

      mockReadFile
        .mockReturnValueOnce('   \n\t  ') // whitespace only
        .mockReturnValueOnce('key: value'); // valid file

      const result = await aggregateFiles(settings as any);

      expect(mockLogWarning).toHaveBeenCalledWith('Skipping whitespace.yml: File is empty');
      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe('valid.yml');
    });
  });

  describe('Other file types (MDX, MD, TS, etc.)', () => {

    it('should skip empty MDX files and log warning', async () => {
      const settings = {
        files: {
          resolvedPaths: {
            mdx: ['/full/path/empty.mdx', '/full/path/valid.mdx']
          },
          placeholderPaths: {}
        },
        options: {}
      };

      mockReadFile
        .mockReturnValueOnce('') // empty file
        .mockReturnValueOnce('# Valid MDX'); // valid file

      const result = await aggregateFiles(settings as any);

      expect(mockLogWarning).toHaveBeenCalledWith('Skipping empty.mdx: File is empty');
      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe('valid.mdx');
    });

    it('should skip files that are empty after sanitization and log warning', async () => {
      const settings = {
        files: {
          resolvedPaths: {
            md: ['/full/path/sanitized-empty.md', '/full/path/valid.md']
          },
          placeholderPaths: {}
        },
        options: {}
      };

      mockReadFile
        .mockReturnValueOnce('<!-- only comments -->') // content that becomes empty after sanitization
        .mockReturnValueOnce('# Valid content'); // valid file

      mockSanitizeFileContent
        .mockReturnValueOnce('') // empty after sanitization
        .mockReturnValueOnce('# Valid content'); // valid after sanitization

      const result = await aggregateFiles(settings as any);

      expect(mockLogWarning).toHaveBeenCalledWith('Skipping sanitized-empty.md: File is empty after sanitization');
      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe('valid.md');
    });

    it('should skip files that have only whitespace after sanitization and log warning', async () => {
      const settings = {
        files: {
          resolvedPaths: {
            ts: ['/full/path/whitespace-after-sanitization.ts', '/full/path/valid.ts']
          },
          placeholderPaths: {}
        },
        options: {}
      };

      mockReadFile
        .mockReturnValueOnce('some content') // file content before sanitization
        .mockReturnValueOnce('export const Component = () => "Hello"'); // valid file

      mockSanitizeFileContent
        .mockReturnValueOnce('   \n\t  ') // whitespace only after sanitization
        .mockReturnValueOnce('export const Component = () => "Hello"'); // valid after sanitization

      const result = await aggregateFiles(settings as any);

      expect(mockLogWarning).toHaveBeenCalledWith('Skipping whitespace-after-sanitization.ts: File is empty after sanitization');
      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe('valid.ts');
    });
  });

  describe('Mixed file types with empty files', () => {
    it('should skip empty files across all file types and process valid ones', async () => {
      const settings = {
        files: {
          resolvedPaths: {
            json: ['/full/path/empty.json', '/full/path/valid.json'],
            yaml: ['/full/path/empty.yaml'],
            md: ['/full/path/valid.md']
          },
          placeholderPaths: {}
        },
        options: {},
        defaultLocale: 'en'
      };

      mockReadFile
        .mockReturnValueOnce('') // empty JSON
        .mockReturnValueOnce('{"key": "value"}') // valid JSON
        .mockReturnValueOnce('') // empty YAML
        .mockReturnValueOnce('# Valid markdown'); // valid MD

      const result = await aggregateFiles(settings as any);

      // Check that warnings were logged for empty files
      expect(mockLogWarning).toHaveBeenCalledWith('Skipping empty.json: File is empty');
      expect(mockLogWarning).toHaveBeenCalledWith('Skipping empty.yaml: File is empty');
      
      // Should have 2 valid files
      expect(result).toHaveLength(2);
      
      // Check the file names are correct (JSON processed first, then MD after YAML)
      const fileNames = result.map(f => f.fileName);
      expect(fileNames).toContain('valid.json');
      expect(fileNames).toContain('valid.md');
    });
  });

  describe('Filter behavior', () => {
    it('should filter out files that return null from map function', async () => {
      const settings = {
        files: {
          resolvedPaths: {
            json: ['/full/path/empty1.json', '/full/path/empty2.json', '/full/path/valid.json']
          },
          placeholderPaths: {}
        },
        options: {},
        defaultLocale: 'en'
      };

      // Both empty files should be skipped, only valid file should remain
      mockReadFile
        .mockReturnValueOnce('') // empty file 1 - will return null from map
        .mockReturnValueOnce('') // empty file 2 - will return null from map  
        .mockReturnValueOnce('{"key": "value"}'); // valid file

      const result = await aggregateFiles(settings as any);

      expect(mockLogWarning).toHaveBeenCalledWith('Skipping empty1.json: File is empty');
      expect(mockLogWarning).toHaveBeenCalledWith('Skipping empty2.json: File is empty');
      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe('valid.json');
    });

    it('should filter out files where parsed content is empty', async () => {
      const settings = {
        files: {
          resolvedPaths: {
            json: ['/full/path/valid-input-empty-output.json', '/full/path/valid.json']
          },
          placeholderPaths: {}
        },
        options: {},
        defaultLocale: 'en'
      };

      mockReadFile
        .mockReturnValueOnce('{"some": "input"}') // valid input
        .mockReturnValueOnce('{"key": "value"}'); // valid file

      mockParseJson
        .mockReturnValueOnce('') // empty after parsing - gets filtered out
        .mockReturnValueOnce('parsed content'); // valid after parsing

      const result = await aggregateFiles(settings as any);

      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe('valid.json');
      expect(result[0].content).toBe('parsed content');
    });
  });
});