import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { getGitUnifiedDiff } from '../gitDiff.js';

// Runs the real `git diff --no-index`: the flags and exit-code handling are
// the whole of this module.
describe('getGitUnifiedDiff', () => {
  const testDir = mkdtempSync(join(tmpdir(), 'git-diff-test-'));
  const write = (name: string, content: string) => {
    const file = join(testDir, name);
    writeFileSync(file, content);
    return file;
  };

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('returns an empty string when the files are identical', async () => {
    const content = 'Hello World\nThis is a test file\n';

    expect(
      await getGitUnifiedDiff(write('a.txt', content), write('b.txt', content))
    ).toBe('');
  });

  it('returns a plain unified diff with three lines of context', async () => {
    const lines = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`);
    const oldFile = write('old.txt', lines.join('\n') + '\n');
    const newFile = write(
      'new.txt',
      lines.with(4, '  Line 5 modified').join('\n')
    );

    const diff = await getGitUnifiedDiff(oldFile, newFile);

    // Header prefixes and the hunk's section heading depend on git config.
    const [, , from, to, hunk, ...body] = diff.split('\n');
    expect(from).toMatch(/^--- .*old\.txt$/);
    expect(to).toMatch(/^\+\+\+ .*new\.txt$/);
    expect(hunk).toMatch(/^@@ -2,9 \+2,9 @@/);
    expect(body).toEqual([
      ' Line 2',
      ' Line 3',
      ' Line 4',
      '-Line 5',
      '+  Line 5 modified',
      ' Line 6',
      ' Line 7',
      ' Line 8',
      ' Line 9',
      '-Line 10',
      '+Line 10',
      '\\ No newline at end of file',
      '',
    ]);
  });

  it('diffs against an empty file', async () => {
    const diff = await getGitUnifiedDiff(
      write('empty.txt', ''),
      write('content.txt', 'New content\nSecond line\n')
    );

    expect(diff).toContain('@@ -0,0 +1,2 @@\n+New content\n+Second line\n');
  });

  it('returns an empty string when a file does not exist', async () => {
    // git reports the missing path on stderr and exits with 1, like a diff.
    expect(
      await getGitUnifiedDiff(
        join(testDir, 'does-not-exist-1.txt'),
        join(testDir, 'does-not-exist-2.txt')
      )
    ).toBe('');
  });
});
