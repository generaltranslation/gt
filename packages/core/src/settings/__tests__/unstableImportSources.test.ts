import { describe, expect, it } from 'vitest';
import { isUnstableGTImportSource } from '../unstableImportSources';

describe('isUnstableGTImportSource', () => {
  it('matches whole specifiers only', () => {
    expect(isUnstableGTImportSource('gt-react/unstable')).toBe(true);
    expect(isUnstableGTImportSource('gt-react')).toBe(false);
    expect(isUnstableGTImportSource('gt-react/unstable/extra')).toBe(false);
    expect(isUnstableGTImportSource('gt-tanstack-start/unstable/server')).toBe(
      false
    );
  });
});
