import { describe, expect, it } from 'vitest';
import {
  embedsUnstableGTHelperTemplates,
  isUnstableGTHelperName,
  isUnstableGTImportSource,
} from '../unstableImportSources';

describe('embedsUnstableGTHelperTemplates', () => {
  it.each([
    ['gt-react/unstable', true],
    ['gt-tanstack-start/unstable', true],
    // The gt-next SWC plugin embeds named variables only
    ['gt-next/unstable', false],
    ['gt-next/unstable/server', false],
    ['gt-i18n/unstable', false],
    ['gt-react', false],
  ])('%s: %s', (source, embeds) => {
    expect(embedsUnstableGTHelperTemplates(source)).toBe(embeds);
  });
});

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
    expect(isUnstableGTHelperName('time')).toBe(true);
    expect(isUnstableGTHelperName('tx')).toBe(false);
  });
});
