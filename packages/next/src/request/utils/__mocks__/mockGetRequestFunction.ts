import { vi } from 'vitest';

/**
 * Comprehensive mocking utility for getRequestFunction and its dependencies
 *
 * This utility handles the complex mocking where getRequestFunction uses require()
 * statements that bypass Vitest's ES module mocking system. We need Module._load
 * patching to intercept the specific gt-next/internal/* require paths.
 */

/**
 * Sets up Module._load patching to intercept require() calls made by getRequestFunction
 */
export function setupModuleLoadPatching() {
  return vi.hoisted(() => {
    const Module = require('module');

    // Save original _load if not already saved
    if (!Module._load_original) {
      Module._load_original = Module._load;
    }

    // Create mocks for all the require() calls in getRequestFunction
    const mocks: Record<string, any> = {
      'gt-next/internal/_getLocale': {
        default: () => Promise.resolve('en'),
      },
      'gt-next/internal/_getRegion': {
        default: () => Promise.resolve('us'),
      },
      'gt-next/internal/_getDomain': {
        default: () => Promise.resolve('example.com'),
      },
      'gt-next/internal/static/_getLocale': {
        default: () => Promise.resolve('en'),
      },
      'gt-next/internal/static/_getRegion': {
        default: () => Promise.resolve('us'),
      },
      'gt-next/internal/static/_getDomain': {
        default: () => Promise.resolve('example.com'),
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
 * Sets up standard Vitest mocks for Next.js APIs
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
 * Call this function at the top of your test file to enable proper mocking
 */
export function setupGetRequestFunctionMocks() {
  setupModuleLoadPatching();
  setupNextJSMocks();
}
