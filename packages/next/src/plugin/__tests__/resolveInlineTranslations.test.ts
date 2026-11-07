import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getShardKey,
  resolveInlineTranslations,
} from '../resolveInlineTranslations';

const gtFiles = {
  output: 'translations/[locale].json',
  inlineTranslations: { locales: ['fr', 'es', 'de'] },
};

let cwd: string;

function writeLocale(locale: string, translations: Record<string, unknown>) {
  fs.mkdirSync(path.join(cwd, 'translations'), { recursive: true });
  fs.writeFileSync(
    path.join(cwd, 'translations', `${locale}.json`),
    JSON.stringify(translations)
  );
}

function readShard(dir: string, locale: string, key: string) {
  return JSON.parse(
    fs.readFileSync(path.join(cwd, dir, locale, `${key}.json`), 'utf8')
  );
}

beforeEach(() => {
  cwd = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'gt-inline-shards-'))
  );
  vi.spyOn(process, 'cwd').mockReturnValue(cwd);
  vi.stubEnv('NODE_ENV', 'production');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  fs.rmSync(cwd, { recursive: true, force: true });
});

describe('getShardKey', () => {
  it('uses the first two lowercase hex characters', () => {
    expect(getShardKey('05a87bce151d258b')).toBe('05');
  });

  it('falls back for other hashes', () => {
    for (const hash of ['', 'a', 'AB12', 'my-hash', '../x', 'éa']) {
      expect(getShardKey(hash)).toBe('_');
    }
  });
});

describe('resolveInlineTranslations', () => {
  it('writes shards grouped by hash prefix and returns plugin options', () => {
    writeLocale('fr', {
      '05aa': 'Bonjour',
      '05bb': 'Salut',
      ff00: 'Au revoir',
      custom: 'Perso',
    });
    writeLocale('es', { '05aa': 'Hola' });

    const result = resolveInlineTranslations(gtFiles);

    expect(result).toMatchObject({ locales: ['fr', 'es'] });
    expect(result!.dir).toBe(`.next/cache/gt/inline/${result!.contentHash}`);
    expect(readShard(result!.dir, 'fr', '05')).toEqual({
      '05aa': 'Bonjour',
      '05bb': 'Salut',
    });
    expect(readShard(result!.dir, 'fr', 'ff')).toEqual({ ff00: 'Au revoir' });
    expect(readShard(result!.dir, 'fr', '_')).toEqual({ custom: 'Perso' });
    expect(readShard(result!.dir, 'es', '05')).toEqual({ '05aa': 'Hola' });
    expect(readShard(result!.dir, 'es', 'ff')).toEqual({});
  });

  it('writes every shard key for every locale', () => {
    writeLocale('fr', { '05aa': 'Bonjour' });
    const result = resolveInlineTranslations(gtFiles)!;
    const keys = fs.readdirSync(path.join(cwd, result.dir, 'fr'));
    expect(keys).toHaveLength(257);
    expect(keys).toContain('00.json');
    expect(keys).toContain('ff.json');
    expect(keys).toContain('_.json');
  });

  it('rejects a distDir outside the working directory', () => {
    writeLocale('fr', { '05aa': 'Bonjour' });
    expect(() =>
      resolveInlineTranslations(gtFiles, { distDir: '../elsewhere' })
    ).toThrow('outside the working directory');
  });

  it('reuses complete shards for unchanged translations', () => {
    writeLocale('fr', { '05aa': 'Bonjour' });
    const first = resolveInlineTranslations(gtFiles)!;
    const marker = path.join(cwd, first.dir, 'fr', 'marker');
    fs.writeFileSync(marker, '');

    const second = resolveInlineTranslations(gtFiles)!;

    expect(second).toEqual(first);
    expect(fs.existsSync(marker)).toBe(true);
  });

  it('writes new shards and removes stale ones when translations change', () => {
    writeLocale('fr', { '05aa': 'Bonjour' });
    const first = resolveInlineTranslations(gtFiles)!;
    writeLocale('fr', { '05aa': 'Bonjour !' });

    const second = resolveInlineTranslations(gtFiles)!;

    expect(second.contentHash).not.toBe(first.contentHash);
    expect(readShard(second.dir, 'fr', '05')).toEqual({ '05aa': 'Bonjour !' });
    expect(fs.existsSync(path.join(cwd, first.dir))).toBe(false);
  });

  it('keeps temp directories another writer may still be filling', () => {
    writeLocale('fr', { '05aa': 'Bonjour' });
    const shardsRoot = path.join(cwd, '.next/cache/gt/inline');
    fs.mkdirSync(path.join(shardsRoot, '.tmp-inflight'), { recursive: true });

    const result = resolveInlineTranslations(gtFiles)!;

    expect(fs.readdirSync(shardsRoot).sort()).toEqual(
      ['.tmp-inflight', result.contentHash].sort()
    );
  });

  it('uses the configured distDir', () => {
    writeLocale('fr', { '05aa': 'Bonjour' });
    const result = resolveInlineTranslations(gtFiles, { distDir: 'build' })!;
    expect(result.dir).toBe(`build/cache/gt/inline/${result.contentHash}`);
  });

  it('returns undefined outside production builds', () => {
    vi.stubEnv('NODE_ENV', 'development');
    writeLocale('fr', { '05aa': 'Bonjour' });
    expect(resolveInlineTranslations(gtFiles)).toBeUndefined();
    expect(fs.existsSync(path.join(cwd, '.next'))).toBe(false);
  });

  it('returns undefined when no embedded locale has a translations file', () => {
    expect(resolveInlineTranslations(gtFiles)).toBeUndefined();
  });
});
