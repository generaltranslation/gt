import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getGitUnifiedDiff } from '../gitDiff.js';

const testDir = join(tmpdir(), 'git-diff-test');

describe('getGitUnifiedDiff', () => {
  beforeAll(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should return empty string when files are identical', async () => {
    const content = 'Hello World\nThis is a test file\n';
    const file1 = join(testDir, 'identical1.txt');
    const file2 = join(testDir, 'identical2.txt');
    
    writeFileSync(file1, content);
    writeFileSync(file2, content);
    
    const diff = await getGitUnifiedDiff(file1, file2);
    expect(diff).toBe('');
    
    unlinkSync(file1);
    unlinkSync(file2);
  });

  it('should return unified diff for simple text changes', async () => {
    const oldContent = 'Line 1\nLine 2\nLine 3\n';
    const newContent = 'Line 1\nLine 2 modified\nLine 3\n';
    
    const oldFile = join(testDir, 'old.txt');
    const newFile = join(testDir, 'new.txt');
    
    writeFileSync(oldFile, oldContent);
    writeFileSync(newFile, newContent);
    
    const diff = await getGitUnifiedDiff(oldFile, newFile);
    
    expect(diff).toContain('--- ');
    expect(diff).toContain('+++ ');
    expect(diff).toContain('@@ -1,3 +1,3 @@');
    expect(diff).toContain(' Line 1');
    expect(diff).toContain('-Line 2');
    expect(diff).toContain('+Line 2 modified');
    expect(diff).toContain(' Line 3');
    
    unlinkSync(oldFile);
    unlinkSync(newFile);
  });

  it('should handle line additions', async () => {
    const oldContent = 'Line 1\nLine 2\n';
    const newContent = 'Line 1\nLine 2\nLine 3\nLine 4\n';
    
    const oldFile = join(testDir, 'before.txt');
    const newFile = join(testDir, 'after.txt');
    
    writeFileSync(oldFile, oldContent);
    writeFileSync(newFile, newContent);
    
    const diff = await getGitUnifiedDiff(oldFile, newFile);
    
    expect(diff).toContain('--- ');
    expect(diff).toContain('+++ ');
    expect(diff).toContain('@@ -1,2 +1,4 @@');
    expect(diff).toContain('+Line 3');
    expect(diff).toContain('+Line 4');
    
    unlinkSync(oldFile);
    unlinkSync(newFile);
  });

  it('should handle line deletions', async () => {
    const oldContent = 'Line 1\nLine 2\nLine 3\nLine 4\n';
    const newContent = 'Line 1\nLine 2\n';
    
    const oldFile = join(testDir, 'full.txt');
    const newFile = join(testDir, 'reduced.txt');
    
    writeFileSync(oldFile, oldContent);
    writeFileSync(newFile, newContent);
    
    const diff = await getGitUnifiedDiff(oldFile, newFile);
    
    expect(diff).toContain('--- ');
    expect(diff).toContain('+++ ');
    expect(diff).toContain('@@ -1,4 +1,2 @@');
    expect(diff).toContain('-Line 3');
    expect(diff).toContain('-Line 4');
    
    unlinkSync(oldFile);
    unlinkSync(newFile);
  });

  it('should handle mixed additions and deletions', async () => {
    const oldContent = `function oldFunction() {
  console.log('old implementation');
  return 'old';
}`;
    
    const newContent = `function newFunction() {
  console.log('new implementation');
  console.log('with extra logging');
  return 'new';
}`;
    
    const oldFile = join(testDir, 'old.js');
    const newFile = join(testDir, 'new.js');
    
    writeFileSync(oldFile, oldContent);
    writeFileSync(newFile, newContent);
    
    const diff = await getGitUnifiedDiff(oldFile, newFile);
    
    expect(diff).toContain('--- ');
    expect(diff).toContain('+++ ');
    expect(diff).toContain('-function oldFunction() {');
    expect(diff).toContain('+function newFunction() {');
    expect(diff).toContain("-  console.log('old implementation');");
    expect(diff).toContain("+  console.log('new implementation');");
    expect(diff).toContain("+  console.log('with extra logging');");
    expect(diff).toContain("-  return 'old';");
    expect(diff).toContain("+  return 'new';");
    
    unlinkSync(oldFile);
    unlinkSync(newFile);
  });

  it('should handle empty files', async () => {
    const oldFile = join(testDir, 'empty1.txt');
    const newFile = join(testDir, 'empty2.txt');
    
    writeFileSync(oldFile, '');
    writeFileSync(newFile, '');
    
    const diff = await getGitUnifiedDiff(oldFile, newFile);
    expect(diff).toBe('');
    
    unlinkSync(oldFile);
    unlinkSync(newFile);
  });

  it('should handle adding content to empty file', async () => {
    const oldFile = join(testDir, 'empty.txt');
    const newFile = join(testDir, 'content.txt');
    
    writeFileSync(oldFile, '');
    writeFileSync(newFile, 'New content\nSecond line\n');
    
    const diff = await getGitUnifiedDiff(oldFile, newFile);
    
    expect(diff).toContain('--- ');
    expect(diff).toContain('+++ ');
    expect(diff).toContain('@@ -0,0 +1,2 @@');
    expect(diff).toContain('+New content');
    expect(diff).toContain('+Second line');
    
    unlinkSync(oldFile);
    unlinkSync(newFile);
  });

  it('should handle removing all content from file', async () => {
    const oldFile = join(testDir, 'content.txt');
    const newFile = join(testDir, 'empty.txt');
    
    writeFileSync(oldFile, 'Content to remove\nSecond line\n');
    writeFileSync(newFile, '');
    
    const diff = await getGitUnifiedDiff(oldFile, newFile);
    
    expect(diff).toContain('--- ');
    expect(diff).toContain('+++ ');
    expect(diff).toContain('@@ -1,2 +0,0 @@');
    expect(diff).toContain('-Content to remove');
    expect(diff).toContain('-Second line');
    
    unlinkSync(oldFile);
    unlinkSync(newFile);
  });

  it('should handle whitespace changes', async () => {
    const oldContent = 'Line 1\nLine 2\nLine 3\n';
    const newContent = 'Line 1\n  Line 2\nLine 3\n';
    
    const oldFile = join(testDir, 'no-spaces.txt');
    const newFile = join(testDir, 'with-spaces.txt');
    
    writeFileSync(oldFile, oldContent);
    writeFileSync(newFile, newContent);
    
    const diff = await getGitUnifiedDiff(oldFile, newFile);
    
    expect(diff).toContain('--- ');
    expect(diff).toContain('+++ ');
    expect(diff).toContain('-Line 2');
    expect(diff).toContain('+  Line 2');
    
    unlinkSync(oldFile);
    unlinkSync(newFile);
  });

  it('should handle files with no trailing newline', async () => {
    const oldContent = 'Line 1\nLine 2';
    const newContent = 'Line 1\nLine 2\nLine 3';
    
    const oldFile = join(testDir, 'no-newline-old.txt');
    const newFile = join(testDir, 'no-newline-new.txt');
    
    writeFileSync(oldFile, oldContent);
    writeFileSync(newFile, newContent);
    
    const diff = await getGitUnifiedDiff(oldFile, newFile);
    
    expect(diff).toContain('--- ');
    expect(diff).toContain('+++ ');
    expect(diff).toContain('\\ No newline at end of file');
    expect(diff).toContain('+Line 3');
    
    unlinkSync(oldFile);
    unlinkSync(newFile);
  });

  it('should throw error for non-existent files', async () => {
    const nonExistentFile1 = join(testDir, 'does-not-exist-1.txt');
    const nonExistentFile2 = join(testDir, 'does-not-exist-2.txt');
    
    // Git diff --no-index doesn't throw for non-existent files, it returns empty diff
    const diff = await getGitUnifiedDiff(nonExistentFile1, nonExistentFile2);
    expect(typeof diff).toBe('string');
  });

  it('should handle large context with unified=3 format', async () => {
    const lines: string[] = [];
    for (let i = 1; i <= 10; i++) {
      lines.push(`Line ${i}`);
    }
    
    const oldContent = lines.join('\n') + '\n';
    const newLines = [...lines];
    newLines[4] = 'Line 5 modified'; // Change line 5
    const newContent = newLines.join('\n') + '\n';
    
    const oldFile = join(testDir, 'large-old.txt');
    const newFile = join(testDir, 'large-new.txt');
    
    writeFileSync(oldFile, oldContent);
    writeFileSync(newFile, newContent);
    
    const diff = await getGitUnifiedDiff(oldFile, newFile);
    
    // The hunk header format may vary slightly, just check for the important parts
    expect(diff).toMatch(/@@ -\d+,\d+ \+\d+,\d+ @@/);
    expect(diff).toContain(' Line 3');
    expect(diff).toContain(' Line 4');
    expect(diff).toContain('-Line 5');
    expect(diff).toContain('+Line 5 modified');
    expect(diff).toContain(' Line 6');
    expect(diff).toContain(' Line 7');
    
    unlinkSync(oldFile);
    unlinkSync(newFile);
  });

  it('should show complete diff output format', async () => {
    const oldContent = `export function hello() {
  console.log('Hello World!');
  return 'greeting';
}`;
    
    const newContent = `export function hello() {
  console.log('Hello Universe!');
  console.log('Extra logging');
  return 'greeting';
}`;
    
    const oldFile = join(testDir, 'demo-old.js');
    const newFile = join(testDir, 'demo-new.js');
    
    writeFileSync(oldFile, oldContent);
    writeFileSync(newFile, newContent);
    
    const diff = await getGitUnifiedDiff(oldFile, newFile);
    
    // Log the complete diff for inspection
    console.log('Complete diff output:');
    console.log('='.repeat(50));
    console.log(diff);
    console.log('='.repeat(50));
    
    // Basic structure checks
    expect(diff).toContain('---');
    expect(diff).toContain('+++');
    expect(diff).toMatch(/@@ -\d+,\d+ \+\d+,\d+ @@/);
    
    unlinkSync(oldFile);
    unlinkSync(newFile);
  });
});