import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  hasDependency,
  readDeps,
  resolveMigrationSource,
} from '../resolveSource.js';

const tmpDirs: string[] = [];

function makeApp(
  deps: Record<string, string>,
  dirs: string[] = [],
  files: Record<string, string> = {}
): string {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-ri18n-detect-'));
  tmpDirs.push(cwd);
  fs.writeFileSync(
    path.join(cwd, 'package.json'),
    JSON.stringify({ name: 'demo', dependencies: deps }, null, 2)
  );
  for (const dir of dirs)
    fs.mkdirSync(path.join(cwd, dir), { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(cwd, rel), content);
  }
  return cwd;
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0))
    fs.rmSync(dir, { recursive: true, force: true });
});

describe('resolveMigrationSource', () => {
  it('resolves react-i18next + app/ dir to the react-i18next adapter', () => {
    const cwd = makeApp({ 'react-i18next': '^14', i18next: '^23' }, ['app']);
    expect(resolveMigrationSource('i18next', cwd)).toEqual({
      kind: 'resolved',
      id: 'react-i18next',
    });
  });

  it('resolves react-i18next under src/app too', () => {
    const cwd = makeApp({ 'react-i18next': '^14' }, ['src/app']);
    expect(resolveMigrationSource('i18next', cwd)).toEqual({
      kind: 'resolved',
      id: 'react-i18next',
    });
  });

  it('routes next-i18next OUT with the Pages-Router recipe', () => {
    const cwd = makeApp(
      { 'next-i18next': '^15', 'react-i18next': '^14', i18next: '^23' },
      ['app']
    );
    const result = resolveMigrationSource('i18next', cwd);
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.message).toMatch(/next-i18next/);
      expect(result.message).toMatch(/--from react-i18next/);
    }
  });

  it('routes a next-i18next.config.js project OUT even without the dep', () => {
    const cwd = makeApp({ 'react-i18next': '^14' }, ['app'], {
      'next-i18next.config.js': 'module.exports = {};',
    });
    expect(resolveMigrationSource('i18next', cwd).kind).toBe('error');
  });

  it('routes bare i18next (no react-i18next) OUT', () => {
    const cwd = makeApp({ i18next: '^23' }, ['app']);
    const result = resolveMigrationSource('i18next', cwd);
    expect(result.kind).toBe('error');
    if (result.kind === 'error') expect(result.message).toMatch(/bare i18next/);
  });

  it('routes react-i18next without an App Router OUT', () => {
    const cwd = makeApp({ 'react-i18next': '^14' }, ['pages']);
    const result = resolveMigrationSource('i18next', cwd);
    expect(result.kind).toBe('error');
    if (result.kind === 'error') expect(result.message).toMatch(/App Router/);
  });

  it('emits the next-i18next message when --from next-i18next is explicit', () => {
    const cwd = makeApp({}, []);
    const result = resolveMigrationSource('next-i18next', cwd);
    expect(result.kind).toBe('error');
  });

  it('passes concrete sources (next-intl, react-i18next) straight through', () => {
    const cwd = makeApp({}, []);
    expect(resolveMigrationSource('next-intl', cwd)).toEqual({
      kind: 'resolved',
      id: 'next-intl',
    });
    expect(resolveMigrationSource('react-i18next', cwd)).toEqual({
      kind: 'resolved',
      id: 'react-i18next',
    });
  });
});

describe('readDeps / hasDependency (shared package.json reader)', () => {
  it('merges dependencies and devDependencies', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-ri18n-deps-'));
    tmpDirs.push(cwd);
    fs.writeFileSync(
      path.join(cwd, 'package.json'),
      JSON.stringify({
        dependencies: { 'react-i18next': '^14' },
        devDependencies: { typescript: '^5' },
      })
    );
    expect(readDeps(cwd)).toMatchObject({
      'react-i18next': '^14',
      typescript: '^5',
    });
    expect(hasDependency(cwd, 'react-i18next')).toBe(true);
    expect(hasDependency(cwd, 'typescript')).toBe(true);
    expect(hasDependency(cwd, 'vue-i18n')).toBe(false);
  });

  it('returns empty / false when package.json is missing or unreadable', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-ri18n-deps-'));
    tmpDirs.push(cwd);
    expect(readDeps(cwd)).toEqual({});
    expect(hasDependency(cwd, 'react-i18next')).toBe(false);
  });
});
