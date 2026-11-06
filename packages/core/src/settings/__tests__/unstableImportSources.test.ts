import { describe, expect, it } from 'vitest';
import {
  isUnstableGTHelperName,
  isUnstableGTImportSource,
} from '../unstableImportSources';

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

describe('isUnstableGTHelperName', () => {
  it('matches only names build tools recognize', () => {
    expect(isUnstableGTHelperName('plural')).toBe(true);
    expect(isUnstableGTHelperName('tx')).toBe(false);
  });
});
