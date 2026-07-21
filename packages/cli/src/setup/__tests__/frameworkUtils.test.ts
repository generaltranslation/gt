import { describe, expect, it } from 'vitest';
import { getReactFrameworkLibrary } from '../frameworkUtils.js';

describe('getReactFrameworkLibrary', () => {
  it.each(['next-app', 'next-pages'] as const)(
    'selects gt-next for %s',
    (name) => {
      expect(getReactFrameworkLibrary({ name, type: 'react' })).toBe('gt-next');
    }
  );

  it('keeps generic React frameworks on gt-react', () => {
    expect(getReactFrameworkLibrary({ name: 'vite', type: 'react' })).toBe(
      'gt-react'
    );
  });
});
