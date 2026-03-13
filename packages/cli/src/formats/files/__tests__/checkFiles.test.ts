import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkFiles } from '../checkFiles.js';
import { aggregateFiles } from '../aggregateFiles.js';
import {
  clearWarnings,
  getWarnings,
} from '../../../state/translateWarnings.js';

vi.mock('../aggregateFiles.js');
vi.mock('../../../state/translateWarnings.js');

const mockAggregateFiles = vi.mocked(aggregateFiles);
const mockClearWarnings = vi.mocked(clearWarnings);
const mockGetWarnings = vi.mocked(getWarnings);

describe('checkFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return valid files with no skipped files', async () => {
    mockAggregateFiles.mockResolvedValue([
      { fileName: 'en/common.json' } as any,
      { fileName: 'en/home.json' } as any,
    ]);
    mockGetWarnings.mockReturnValue([]);

    const result = await checkFiles({} as any);

    expect(result.validFiles).toEqual(['en/common.json', 'en/home.json']);
    expect(result.skippedFiles).toEqual([]);
    expect(result.summary).toEqual({ total: 2, valid: 2, skipped: 0 });
  });

  it('should capture skipped_file warnings as skippedFiles', async () => {
    mockAggregateFiles.mockResolvedValue([
      { fileName: 'en/valid.json' } as any,
    ]);
    mockGetWarnings.mockReturnValue([
      {
        category: 'skipped_file',
        fileName: 'en/broken.json',
        reason: 'JSON file is not parsable',
      },
    ]);

    const result = await checkFiles({} as any);

    expect(result.validFiles).toEqual(['en/valid.json']);
    expect(result.skippedFiles).toEqual([
      { fileName: 'en/broken.json', reason: 'JSON file is not parsable' },
    ]);
    expect(result.summary).toEqual({ total: 2, valid: 1, skipped: 1 });
  });

  it('should handle all files being skipped', async () => {
    mockAggregateFiles.mockResolvedValue([]);
    mockGetWarnings.mockReturnValue([
      {
        category: 'skipped_file',
        fileName: 'a.json',
        reason: 'JSON file is not parsable',
      },
      {
        category: 'skipped_file',
        fileName: 'b.yaml',
        reason: 'YAML file is empty',
      },
    ]);

    const result = await checkFiles({} as any);

    expect(result.validFiles).toEqual([]);
    expect(result.skippedFiles).toHaveLength(2);
    expect(result.summary).toEqual({ total: 2, valid: 0, skipped: 2 });
  });

  it('should filter out non-skipped_file warnings', async () => {
    mockAggregateFiles.mockResolvedValue([
      { fileName: 'en/valid.json' } as any,
    ]);
    mockGetWarnings.mockReturnValue([
      {
        category: 'skipped_file',
        fileName: 'en/broken.json',
        reason: 'JSON file is not parsable',
      },
      {
        category: 'failed_translation',
        fileName: 'en/other.json',
        reason: 'Translation failed',
      },
    ]);

    const result = await checkFiles({} as any);

    expect(result.skippedFiles).toEqual([
      { fileName: 'en/broken.json', reason: 'JSON file is not parsable' },
    ]);
    expect(result.summary).toEqual({ total: 2, valid: 1, skipped: 1 });
  });

  it('should clear warnings before and after aggregation', async () => {
    mockAggregateFiles.mockResolvedValue([]);
    mockGetWarnings.mockReturnValue([]);

    await checkFiles({} as any);

    expect(mockClearWarnings).toHaveBeenCalledTimes(2);
    // First call before aggregateFiles, second after reading warnings
    expect(mockClearWarnings.mock.invocationCallOrder[0]).toBeLessThan(
      mockAggregateFiles.mock.invocationCallOrder[0]
    );
  });

  it('should handle mixed file types with various skip reasons', async () => {
    mockAggregateFiles.mockResolvedValue([
      { fileName: 'en/valid.json' } as any,
      { fileName: 'docs/page.mdx' } as any,
    ]);
    mockGetWarnings.mockReturnValue([
      {
        category: 'skipped_file',
        fileName: 'en/broken.json',
        reason: 'JSON file is not parsable',
      },
      {
        category: 'skipped_file',
        fileName: 'config.yaml',
        reason: 'YAML file is empty',
      },
      {
        category: 'skipped_file',
        fileName: 'docs/bad.mdx',
        reason: 'MDX file is not AST parsable: Unexpected token',
      },
    ]);

    const result = await checkFiles({} as any);

    expect(result.validFiles).toEqual(['en/valid.json', 'docs/page.mdx']);
    expect(result.skippedFiles).toHaveLength(3);
    expect(result.skippedFiles[0].reason).toBe('JSON file is not parsable');
    expect(result.skippedFiles[1].reason).toBe('YAML file is empty');
    expect(result.skippedFiles[2].reason).toContain(
      'MDX file is not AST parsable'
    );
    expect(result.summary).toEqual({ total: 5, valid: 2, skipped: 3 });
  });

  it('should return empty result when no files configured', async () => {
    mockAggregateFiles.mockResolvedValue([]);
    mockGetWarnings.mockReturnValue([]);

    const result = await checkFiles({} as any);

    expect(result.validFiles).toEqual([]);
    expect(result.skippedFiles).toEqual([]);
    expect(result.summary).toEqual({ total: 0, valid: 0, skipped: 0 });
  });
});
