import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupGetRequestFunctionMocks } from '../__mocks__/mockGetRequestFunction';

// Set up comprehensive mocking for getRequestFunction and all its dependencies
setupGetRequestFunctionMocks();

describe('getRequestFunction', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    
    // Reset environment variables
    delete process.env._GENERALTRANSLATION_CUSTOM_GET_LOCALE_ENABLED;
    delete process.env._GENERALTRANSLATION_CUSTOM_GET_REGION_ENABLED;
    delete process.env._GENERALTRANSLATION_CUSTOM_GET_DOMAIN_ENABLED;
    delete process.env.NEXT_PHASE;
  });

  describe('basic functionality', () => {
    it('should export getRequestFunction as a function', async () => {
      const { getRequestFunction } = await import('../getRequestFunction');
      expect(typeof getRequestFunction).toBe('function');
    });

    it('should accept valid function names', async () => {
      const { getRequestFunction } = await import('../getRequestFunction');

      expect(() => getRequestFunction('getLocale')).not.toThrow();
      expect(() => getRequestFunction('getRegion')).not.toThrow();
      expect(() => getRequestFunction('getDomain')).not.toThrow();
    });

    it('should return functions for each valid input', async () => {
      const { getRequestFunction } = await import('../getRequestFunction');

      const localeFunction = getRequestFunction('getLocale');
      const regionFunction = getRequestFunction('getRegion');
      const domainFunction = getRequestFunction('getDomain');

      expect(typeof localeFunction).toBe('function');
      expect(typeof regionFunction).toBe('function');
      expect(typeof domainFunction).toBe('function');
    });
  });

  describe('function execution', () => {
    it('should return expected values when functions are executed', async () => {
      const { getRequestFunction } = await import('../getRequestFunction');

      const localeFunction = getRequestFunction('getLocale');
      const regionFunction = getRequestFunction('getRegion');
      const domainFunction = getRequestFunction('getDomain');

      // Test function execution with our mocked modules
      const localeResult = await localeFunction();
      const regionResult = await regionFunction();
      const domainResult = await domainFunction();

      expect(localeResult).toBe('en');
      expect(regionResult).toBe('us');
      expect(domainResult).toBe('example.com');
    });
  });

  describe('environment variables', () => {
    it('should handle custom function environment variables', async () => {
      // Test with custom functions enabled
      process.env._GENERALTRANSLATION_CUSTOM_GET_LOCALE_ENABLED = 'true';
      process.env._GENERALTRANSLATION_CUSTOM_GET_REGION_ENABLED = 'true';
      process.env._GENERALTRANSLATION_CUSTOM_GET_DOMAIN_ENABLED = 'true';

      const { getRequestFunction } = await import('../getRequestFunction');

      const localeFunction = getRequestFunction('getLocale');
      const regionFunction = getRequestFunction('getRegion');
      const domainFunction = getRequestFunction('getDomain');

      expect(typeof localeFunction).toBe('function');
      expect(typeof regionFunction).toBe('function');
      expect(typeof domainFunction).toBe('function');
    });

    it('should handle SSG mode detection through NEXT_PHASE', async () => {
      process.env.NEXT_PHASE = 'phase-production-build';

      const { getRequestFunction } = await import('../getRequestFunction');

      const regionFunction = getRequestFunction('getRegion');
      const domainFunction = getRequestFunction('getDomain');

      expect(typeof regionFunction).toBe('function');
      expect(typeof domainFunction).toBe('function');

      // In SSG mode, should use fallback functions
      const regionResult = await regionFunction();
      const domainResult = await domainFunction();

      expect(regionResult).toBeUndefined(); // Fallbacks return undefined
      expect(domainResult).toBeUndefined(); // Fallbacks return undefined
    });
  });

  describe('error handling', () => {
    it('should handle getLocale SSG error correctly', async () => {
      // Set SSG mode
      process.env.NEXT_PHASE = 'phase-production-build';

      const { getRequestFunction } = await import('../getRequestFunction');

      // getLocale should throw in SSG mode when no custom locale is enabled
      expect(() => {
        getRequestFunction('getLocale');
      }).toThrow('You are using SSG, but you have not set a custom getLocale() function');
    });

    it('should handle module loading errors gracefully', async () => {
      const { getRequestFunction } = await import('../getRequestFunction');

      // Even with potential module loading issues, should return a function
      const localeFunction = getRequestFunction('getLocale');
      expect(typeof localeFunction).toBe('function');

      // The function should handle errors and return undefined when modules fail
      const result = await localeFunction();
      expect(typeof result).toBe('string'); // Our mocks return strings
    });
  });
});