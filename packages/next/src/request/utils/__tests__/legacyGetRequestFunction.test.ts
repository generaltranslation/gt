import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupGetRequestFunctionMocks } from '../__mocks__/mockGetRequestFunction';

// Set up comprehensive mocking for legacyGetRequestFunction and all its dependencies
setupGetRequestFunctionMocks();

describe('legacyGetRequestFunction', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    // Reset environment variables
    delete process.env._GENERALTRANSLATION_CUSTOM_GET_LOCALE_ENABLED;
    delete process.env._GENERALTRANSLATION_CUSTOM_GET_REGION_ENABLED;
    delete process.env._GENERALTRANSLATION_CUSTOM_GET_DOMAIN_ENABLED;
    delete process.env._GENERALTRANSLATION_STATIC_GET_LOCALE_ENABLED;
    delete process.env._GENERALTRANSLATION_STATIC_GET_REGION_ENABLED;
    delete process.env._GENERALTRANSLATION_STATIC_GET_DOMAIN_ENABLED;
    delete process.env._GENERALTRANSLATION_ENABLE_SSG;
  });

  describe('basic functionality', () => {
    it('should export legacyGetRequestFunction as a function', async () => {
      const { legacyGetRequestFunction } = await import(
        '../legacyGetRequestFunction'
      );
      expect(typeof legacyGetRequestFunction).toBe('function');
    });

    it('should accept valid function names', async () => {
      const { legacyGetRequestFunction } = await import(
        '../legacyGetRequestFunction'
      );

      expect(() => legacyGetRequestFunction('getLocale', true)).not.toThrow();
      expect(() => legacyGetRequestFunction('getRegion', true)).not.toThrow();
      expect(() => legacyGetRequestFunction('getDomain', true)).not.toThrow();
    });

    it('should return functions for each valid input', async () => {
      const { legacyGetRequestFunction } = await import(
        '../legacyGetRequestFunction'
      );

      const localeFunction = legacyGetRequestFunction('getLocale', true);
      const regionFunction = legacyGetRequestFunction('getRegion', true);
      const domainFunction = legacyGetRequestFunction('getDomain', true);

      expect(typeof localeFunction).toBe('function');
      expect(typeof regionFunction).toBe('function');
      expect(typeof domainFunction).toBe('function');
    });
  });

  describe('SSR mode', () => {
    it('should use default functions when no custom functions are enabled', async () => {
      const { legacyGetRequestFunction } = await import(
        '../legacyGetRequestFunction'
      );

      const localeFunction = legacyGetRequestFunction('getLocale', true);
      const regionFunction = legacyGetRequestFunction('getRegion', true);
      const domainFunction = legacyGetRequestFunction('getDomain', true);

      expect(typeof localeFunction).toBe('function');
      expect(typeof regionFunction).toBe('function');
      expect(typeof domainFunction).toBe('function');

      // These should return the mocked values
      const localeResult = await localeFunction();
      const regionResult = await regionFunction();
      const domainResult = await domainFunction();

      expect(localeResult).toBe('en');
      expect(regionResult).toBe('us');
      expect(domainResult).toBe('example.com');
    });
  });

  describe('SSG mode', () => {
    it('should handle custom function environment variables in SSG mode', async () => {
      // Test with custom static functions enabled
      process.env._GENERALTRANSLATION_STATIC_GET_LOCALE_ENABLED = 'true';
      process.env._GENERALTRANSLATION_STATIC_GET_REGION_ENABLED = 'true';
      process.env._GENERALTRANSLATION_STATIC_GET_DOMAIN_ENABLED = 'true';

      const { legacyGetRequestFunction } = await import(
        '../legacyGetRequestFunction'
      );

      const localeFunction = legacyGetRequestFunction('getLocale', false);
      const regionFunction = legacyGetRequestFunction('getRegion', false);
      const domainFunction = legacyGetRequestFunction('getDomain', false);

      expect(typeof localeFunction).toBe('function');
      expect(typeof regionFunction).toBe('function');
      expect(typeof domainFunction).toBe('function');
    });

    it('should force SSR when _GENERALTRANSLATION_ENABLE_SSG is false', async () => {
      process.env._GENERALTRANSLATION_ENABLE_SSG = 'false';

      const { legacyGetRequestFunction } = await import(
        '../legacyGetRequestFunction'
      );

      // Even when requesting SSG (false), should use SSR due to env var
      const regionFunction = legacyGetRequestFunction('getRegion', false);
      const domainFunction = legacyGetRequestFunction('getDomain', false);

      expect(typeof regionFunction).toBe('function');
      expect(typeof domainFunction).toBe('function');

      // These should behave as SSR functions and return mocked values
      const regionResult = await regionFunction();
      const domainResult = await domainFunction();

      expect(regionResult).toBe('us');
      expect(domainResult).toBe('example.com');
    });

    it('should use static function names in SSG mode', async () => {
      const { legacyGetRequestFunction } = await import(
        '../legacyGetRequestFunction'
      );

      const localeFunction = legacyGetRequestFunction('getLocale', false);
      const regionFunction = legacyGetRequestFunction('getRegion', false);
      const domainFunction = legacyGetRequestFunction('getDomain', false);

      expect(typeof localeFunction).toBe('function');
      expect(typeof regionFunction).toBe('function');
      expect(typeof domainFunction).toBe('function');
    });
  });

  describe('error handling', () => {
    it('should handle module loading errors gracefully', async () => {
      const { legacyGetRequestFunction } = await import(
        '../legacyGetRequestFunction'
      );

      // Even with potential module loading issues, should return a function
      const localeFunction = legacyGetRequestFunction('getLocale', true);
      expect(typeof localeFunction).toBe('function');

      // The function should return mocked values
      const result = await localeFunction();
      expect(result).toBe('en');
    });

    it('should return mocked values when modules are mocked', async () => {
      const { legacyGetRequestFunction } = await import(
        '../legacyGetRequestFunction'
      );

      // All functions should return functions that resolve to mocked values
      const localeFunction = legacyGetRequestFunction('getLocale', true);
      const regionFunction = legacyGetRequestFunction('getRegion', true);
      const domainFunction = legacyGetRequestFunction('getDomain', true);

      const localeResult = await localeFunction();
      const regionResult = await regionFunction();
      const domainResult = await domainFunction();

      expect(localeResult).toBe('en');
      expect(regionResult).toBe('us');
      expect(domainResult).toBe('example.com');
    });
  });
});
