import { describe, it, expect } from 'vitest';
import generateRequestHeaders from '../../../src/translate/utils/generateRequestHeaders';
import { TranslationRequestConfig } from '../../../src/types';

describe('generateRequestHeaders', () => {
  it('should return headers with Content-Type and project ID', () => {
    const config: TranslationRequestConfig = {
      baseUrl: 'https://api.test.com',
      projectId: 'test-project',
    };

    const headers = generateRequestHeaders(config);

    expect(headers).toEqual({
      'Content-Type': 'application/json',
      'x-gt-project-id': 'test-project',
    });
  });

  it('should include API key header when apiKey is provided', () => {
    const config: TranslationRequestConfig = {
      baseUrl: 'https://api.test.com',
      projectId: 'test-project',
      apiKey: 'test-api-key',
    };

    const headers = generateRequestHeaders(config);

    expect(headers).toEqual({
      'Content-Type': 'application/json',
      'x-gt-api-key': 'test-api-key',
      'x-gt-project-id': 'test-project',
    });
  });

  it('should not include API key header when apiKey is undefined', () => {
    const config: TranslationRequestConfig = {
      baseUrl: 'https://api.test.com',
      projectId: 'test-project',
    };

    const headers = generateRequestHeaders(config);

    expect(headers).toEqual({
      'Content-Type': 'application/json',
      'x-gt-project-id': 'test-project',
    });
  });

  it('should not include API key header when apiKey is empty string', () => {
    const config: TranslationRequestConfig = {
      baseUrl: 'https://api.test.com',
      projectId: 'test-project',
      apiKey: '',
    };

    const headers = generateRequestHeaders(config);

    expect(headers).toEqual({
      'Content-Type': 'application/json',
      'x-gt-project-id': 'test-project',
    });
  });
});
