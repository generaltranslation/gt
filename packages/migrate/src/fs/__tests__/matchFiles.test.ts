import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { matchFiles } from '../matchFiles.js';

vi.mock('fast-glob', () => ({
  default: {
    sync: vi.fn(() => [
      '/proj/src/components/PageLayout.tsx',
      '/proj/src/app/page.tsx',
      '/proj/src/components/Navigation.tsx',
    ]),
  },
}));

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0))
    fs.rmSync(dir, { recursive: true, force: true });
});

describe('matchFiles', () => {
  it('sorts glob results so processing and reports are deterministic', () => {
    // fast-glob returns filesystem enumeration order, which differs between
    // copies of the same tree (APFS hashes directory entries): two identical
    // projects migrated on different machines listed their converted files in
    // different orders. matchFiles owns the sort so every consumer inherits a
    // stable order.
    expect(matchFiles('/proj', ['src/**/*.tsx'])).toEqual([
      '/proj/src/app/page.tsx',
      '/proj/src/components/Navigation.tsx',
      '/proj/src/components/PageLayout.tsx',
    ]);
  });
});
