import { vi } from 'vitest';

/**
 * Comprehensive mocking utility for getRequestFunction and its dependencies
 *
 * This utility solves the complex mocking issue where getRequestFunction uses require()
 * statements that bypass Vitest's ES module mocking system, causing "headers was called
 * outside a request scope" errors.
 *
 * Usage:
 * ```ts
 * import { setupGetRequestFunctionMocks } from '../test-utils/mockGetRequestFunction';
 *
 * // In your test file, call this before any imports:
 * setupGetRequestFunctionMocks();
 * ```
 */

/**
 * Sets up Module._load patching to intercept require() calls made by getRequestFunction
 * This is the core solution that bypasses ES module/CommonJS mocking incompatibilities
 */
export function setupModuleLoadPatching() {
  return vi.hoisted(() => {
    // Use require() directly since we're in a hoisted context
    const Module = require('module');

    // Save original _load if not already saved
    if (!Module._load_original) {
      Module._load_original = Module._load;
    }

    // Create the mocks map for all problematic require() calls
    const mocks: Record<string, any> = {
      // gt-next internal modules that use Next.js headers/cookies
      'gt-next/internal/_getLocale': {
        default: () => Promise.resolve('en'),
      },
      'gt-next/internal/_getRegion': {
        default: () => Promise.resolve('us'),
      },
      'gt-next/internal/_getDomain': {
        default: () => Promise.resolve('example.com'),
      },
      // Internal fallback modules (return undefined as expected)
      '../../internal/fallbacks/_getRegion': {
        default: () => Promise.resolve(undefined),
      },
      '../../internal/fallbacks/_getDomain': {
        default: () => Promise.resolve(undefined),
      },
      // Next.js work async storage for SSR detection
      'next/dist/server/app-render/work-async-storage.external': {
        workAsyncStorage: {
          getStore: () => ({ isStaticGeneration: false }),
        },
      },
    };

    // Patch _load to intercept require() calls
    Module._load = (uri: string, parent: any) => {
      if (mocks[uri]) {
        return mocks[uri];
      }
      return Module._load_original(uri, parent);
    };
  });
}

/**
 * Sets up standard Vitest mocks for Next.js APIs that might be called directly
 */
export function setupNextJSMocks() {
  // Mock next/headers to prevent "outside request scope" errors
  vi.mock('next/headers', () => ({
    headers: () => ({
      get: (key: string) =>
        key === 'accept-language' ? 'en-US,en;q=0.9' : null,
    }),
    cookies: () => ({
      get: (name: string) => (name === 'gt-locale' ? { value: 'en' } : null),
    }),
  }));
}

/**
 * Sets up comprehensive mocking for getRequestFunction and all its dependencies
 * Call this function at the top of your test file to enable mocking of getLocale
 *
 * @example
 * ```ts
 * import { setupGetRequestFunctionMocks } from '../test-utils/mockGetRequestFunction';
 *
 * setupGetRequestFunctionMocks();
 *
 * describe('My Component Tests', () => {
 *   // Your tests that use getLocale will now work without Next.js errors
 * });
 * ```
 */
export function setupGetRequestFunctionMocks() {
  setupModuleLoadPatching();
  setupNextJSMocks();
}

/**
 * Helper function to create getLocale mock setup that can be copied into test files
 * Since vi.hoisted and vi.mock must be called at the top level, this returns the code
 * pattern to use rather than executing it directly
 *
 * Usage in test files:
 * ```ts
 * const { mockGetLocaleFunction } = vi.hoisted(() => {
 *   const mockGetLocaleFunction = vi.fn().mockResolvedValue('en');
 *   return { mockGetLocaleFunction };
 * });
 *
 * vi.mock('../../request/getLocale', () => ({
 *   getLocale: mockGetLocaleFunction,
 * }));
 * ```
 */
export const GET_LOCALE_MOCK_PATTERN = {
  comment: 'Copy this pattern into your test file for direct getLocale mocking',
  code: `
const { mockGetLocaleFunction } = vi.hoisted(() => {
  const mockGetLocaleFunction = vi.fn().mockResolvedValue('en');
  return { mockGetLocaleFunction };
});

vi.mock('../../request/getLocale', () => ({
  getLocale: mockGetLocaleFunction,
}));`,
};
