import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchTranslations } from '../fetchTranslations.js';
import { gt } from '../../utils/gt.js';
import { logError } from '../../console/logging.js';
import {
  FetchTranslationsResult,
  RetrievedTranslations,
} from 'generaltranslation/types';

// Mock dependencies
vi.mock('../../utils/gt.js', () => ({
  gt: {
    fetchTranslations: vi.fn(),
  },
}));

vi.mock('../../console/logging.js', () => ({
  logError: vi.fn(),
}));

describe('fetchTranslations', () => {
  // Common mock data factories
  const createMockTranslations = (count: number = 2): RetrievedTranslations => {
    return Array.from({ length: count }, (_, i) => ({
      locale: i === 0 ? 'es' : 'fr',
      translation: { hello: i === 0 ? 'hola' : 'bonjour' },
    }));
  };

  const createMockFetchResult = (
    overrides: Partial<FetchTranslationsResult> = {}
  ): FetchTranslationsResult => ({
    translations: createMockTranslations(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch translations successfully', async () => {
    const mockTranslations = createMockTranslations();
    const mockResult = createMockFetchResult({
      translations: mockTranslations,
    });

    vi.mocked(gt.fetchTranslations).mockResolvedValue(mockResult);

    const result = await fetchTranslations('version-123');

    expect(gt.fetchTranslations).toHaveBeenCalledWith('version-123');
    expect(result).toEqual<RetrievedTranslations>(mockTranslations);
    expect(logError).not.toHaveBeenCalled();
  });

  it('should return empty array when API call fails', async () => {
    const error = new Error('API Error');
    vi.mocked(gt.fetchTranslations).mockRejectedValue(error);

    const result = await fetchTranslations('version-123');

    expect(gt.fetchTranslations).toHaveBeenCalledWith('version-123');
    expect(result).toEqual([]);
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to fetch translations')
    );
  });

  it('should handle empty translations array', async () => {
    const mockResult = createMockFetchResult({ translations: [] });

    vi.mocked(gt.fetchTranslations).mockResolvedValue(mockResult);

    const result = await fetchTranslations('version-123');

    expect(gt.fetchTranslations).toHaveBeenCalledWith('version-123');
    expect(result).toEqual([]);
    expect(logError).not.toHaveBeenCalled();
  });

  it('should handle network errors', async () => {
    const networkError = new Error('Network timeout');
    vi.mocked(gt.fetchTranslations).mockRejectedValue(networkError);

    const result = await fetchTranslations('version-123');

    expect(result).toEqual([]);
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to fetch translations')
    );
  });

  it('should handle authentication errors', async () => {
    const authError = new Error('Unauthorized');
    vi.mocked(gt.fetchTranslations).mockRejectedValue(authError);

    const result = await fetchTranslations('version-123');

    expect(result).toEqual([]);
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to fetch translations')
    );
  });

  it('should handle different version ID formats', async () => {
    const mockResult = createMockFetchResult({
      translations: createMockTranslations(1),
    });

    vi.mocked(gt.fetchTranslations).mockResolvedValue(mockResult);

    // Test with UUID format
    await fetchTranslations('550e8400-e29b-41d4-a716-446655440000');
    expect(gt.fetchTranslations).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000'
    );

    // Test with numeric format
    await fetchTranslations('12345');
    expect(gt.fetchTranslations).toHaveBeenCalledWith('12345');

    // Test with alphanumeric format
    await fetchTranslations('version-abc123');
    expect(gt.fetchTranslations).toHaveBeenCalledWith('version-abc123');
  });

  it('should handle translations with partial data', async () => {
    const mockTranslations = createMockTranslations();
    const mockResult = createMockFetchResult({
      translations: mockTranslations,
    });

    vi.mocked(gt.fetchTranslations).mockResolvedValue(mockResult);

    const result = await fetchTranslations('version-123');

    expect(result).toEqual(mockTranslations);
  });

  it('should handle very large translations array', async () => {
    const mockTranslations = createMockTranslations(1000);
    const mockResult = createMockFetchResult({
      translations: mockTranslations,
    });

    vi.mocked(gt.fetchTranslations).mockResolvedValue(mockResult);

    const result = await fetchTranslations('version-123');

    expect(result).toHaveLength(1000);
    expect(result[0].locale).toBe('es');
    expect(result[999].locale).toBe('fr');
  });

  it('should handle empty string version ID', async () => {
    const mockResult = createMockFetchResult({ translations: [] });

    vi.mocked(gt.fetchTranslations).mockResolvedValue(mockResult);

    const result = await fetchTranslations('');

    expect(gt.fetchTranslations).toHaveBeenCalledWith('');
    expect(result).toEqual([]);
  });
});
