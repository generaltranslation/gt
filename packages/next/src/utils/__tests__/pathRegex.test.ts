import { describe, expect, it } from 'vitest';
import { compilePathRegex, pathnameMatchesRegex } from '../pathRegex';

describe('pathRegex', () => {
  it('matches every pathname when no regex is configured', () => {
    expect(pathnameMatchesRegex('/uk')).toBe(true);
  });

  it('excludes pathnames outside the configured regex', () => {
    const pathRegex = compilePathRegex('^/(?!uk(?:/|$)).*');

    expect(pathnameMatchesRegex('/about', pathRegex)).toBe(true);
    expect(pathnameMatchesRegex('/uk', pathRegex)).toBe(false);
    expect(pathnameMatchesRegex('/uk/about', pathRegex)).toBe(false);
  });
});
