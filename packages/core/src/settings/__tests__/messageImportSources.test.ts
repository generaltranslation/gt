import { describe, expect, it } from 'vitest';
import {
  isGTMessageHelperName,
  isGTMessageImportSource,
} from '../messageImportSources';

describe('isGTMessageImportSource', () => {
  it('matches whole specifiers only', () => {
    expect(isGTMessageImportSource('gt-react')).toBe(true);
    expect(isGTMessageImportSource('gt-next/server')).toBe(true);
    expect(isGTMessageImportSource('gt-react/compat')).toBe(false);
    expect(isGTMessageImportSource('gt-tanstack-start/server')).toBe(false);
    expect(isGTMessageImportSource('@generaltranslation/react-core')).toBe(
      false
    );
  });
});

describe('isGTMessageHelperName', () => {
  it('matches only names build tools recognize', () => {
    expect(isGTMessageHelperName('plural')).toBe(true);
    expect(isGTMessageHelperName('time')).toBe(true);
    expect(isGTMessageHelperName('tx')).toBe(false);
  });
});
