import { describe, it, expect, vi, beforeEach } from 'vitest';
import validateConfig from '../../../src/translate/utils/validateConfig';
import { TranslationRequestConfig } from '../../../src/types';

// Mock the logger
vi.mock('../../../src/logging/logger', () => ({
  translationLogger: {
    error: vi.fn(),
  },
}));

describe('validateConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass validation with valid config', () => {
    const validConfig: TranslationRequestConfig = {
      projectId: 'test-project',
      apiKey: 'test-key',
      baseUrl: 'https://api.test.com',
    };

    expect(() => validateConfig(validConfig)).not.toThrow();
  });

  it('should throw error when projectId is missing', () => {
    const invalidConfig: TranslationRequestConfig = {
      projectId: '',
      apiKey: 'test-key',
      baseUrl: 'https://api.test.com',
    };

    expect(() => validateConfig(invalidConfig)).toThrow(
      'GT error: Project ID and API key or dev API key are required. Please provide a valid project ID and API key or dev API key.'
    );
  });

  it('should throw error when apiKey is missing', () => {
    const invalidConfig: TranslationRequestConfig = {
      projectId: 'test-project',
      apiKey: '',
      baseUrl: 'https://api.test.com',
    };

    expect(() => validateConfig(invalidConfig)).toThrow(
      'GT error: Project ID and API key or dev API key are required. Please provide a valid project ID and API key or dev API key.'
    );
  });

  it('should throw error when both projectId and apiKey are missing', () => {
    const invalidConfig: TranslationRequestConfig = {
      projectId: '',
      apiKey: '',
      baseUrl: 'https://api.test.com',
    };

    expect(() => validateConfig(invalidConfig)).toThrow(
      'GT error: Project ID and API key or dev API key are required. Please provide a valid project ID and API key or dev API key.'
    );
  });

  it('should throw error when projectId is undefined', () => {
    const invalidConfig = {
      projectId: undefined,
      apiKey: 'test-key',
      baseUrl: 'https://api.test.com',
    } as TranslationRequestConfig;

    expect(() => validateConfig(invalidConfig)).toThrow(
      'GT error: Project ID and API key or dev API key are required. Please provide a valid project ID and API key or dev API key.'
    );
  });

  it('should throw error when apiKey is undefined', () => {
    const invalidConfig: TranslationRequestConfig = {
      projectId: 'test-project',
      apiKey: undefined,
      baseUrl: 'https://api.test.com',
    };

    expect(() => validateConfig(invalidConfig)).toThrow(
      'GT error: Project ID and API key or dev API key are required. Please provide a valid project ID and API key or dev API key.'
    );
  });
});
