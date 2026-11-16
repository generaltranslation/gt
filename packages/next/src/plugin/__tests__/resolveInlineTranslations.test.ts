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

  it('writes each repeated locale once', () => {
    writeLocale('fr', { '05aa': 'Bonjour' });
    const result = resolveInlineTranslations({
      ...gtFiles,
      inlineTranslations: { locales: ['fr', 'fr'] },
    })!;
    expect(result.locales).toEqual(['fr']);
    expect(readShard(result.dir, 'fr', '05')).toEqual({ '05aa': 'Bonjour' });
  });

  it('keeps a __proto__ hash', () => {
    writeLocale('fr', JSON.parse('{"__proto__": "Perso"}'));
    const result = resolveInlineTranslations(gtFiles)!;
    expect(
      fs.readFileSync(path.join(cwd, result.dir, 'fr', '_.json'), 'utf8')
    ).toBe('{"__proto__":"Perso"}');
  });

  it('warns and still returns the options when shards cannot be written', () => {
    writeLocale('fr', { '05aa': 'Bonjour' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fs.mkdirSync(path.join(cwd, '.next'));
    fs.chmodSync(path.join(cwd, '.next'), 0o555);
    try {
      const result = resolveInlineTranslations(gtFiles);
      expect(result?.locales).toEqual(['fr']);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('could not be written')
      );
    } finally {
      fs.chmodSync(path.join(cwd, '.next'), 0o755);
    }
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

describe('resolveInlineTranslations with message modules', () => {
  const modulesFiles = {
    ...gtFiles,
    inlineTranslations: {
      locales: ['fr', 'es'],
      modules: 'physical' as const,
    },
  };

  const readModule = (file: string) =>
    fs.readFileSync(path.join(cwd, '.gt/messages', file), 'utf8');

  it('writes a module per message and returns the modules options', () => {
    writeLocale('fr', { '05aa': 'Bonjour', ff00: 'Au revoir' });
    writeLocale('es', { '05aa': 'Hola' });

    const result = resolveInlineTranslations(modulesFiles)!;

    expect(result).toMatchObject({
      locales: ['fr', 'es'],
      modules: {
        dir: '.gt/messages',
        importDir: 'gt-next/internal/_inline-messages',
      },
    });
    expect(result.dir).toBeUndefined();
    expect(fs.readdirSync(path.join(cwd, '.gt/messages')).sort()).toEqual([
      '05aa.js',
      'ff00.js',
    ]);
    expect(readModule('05aa.js')).toBe(
      '// Generated by General Translation from embedded translations. Do not edit.\n' +
        'export default (locale) => locale === "fr" ? "Bonjour" : locale === "es" ? "Hola" : undefined;\n'
    );
    // No shards in modules mode
    expect(fs.existsSync(path.join(cwd, '.next'))).toBe(false);
  });

  it('uses the configured modulesDir', () => {
    writeLocale('fr', { '05aa': 'Bonjour' });
    const result = resolveInlineTranslations({
      ...modulesFiles,
      inlineTranslations: {
        ...modulesFiles.inlineTranslations,
        modulesDir: 'src/generated/messages',
      },
    })!;
    expect(result.modules?.dir).toBe('src/generated/messages');
    expect(
      fs.existsSync(path.join(cwd, 'src/generated/messages/05aa.js'))
    ).toBe(true);
  });

  it('falls back to physical modules for virtual with a warning', () => {
    writeLocale('fr', { '05aa': 'Bonjour' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveInlineTranslations({
      ...gtFiles,
      inlineTranslations: { locales: ['fr'], modules: 'virtual' },
    })!;
    expect(result.modules?.dir).toBe('.gt/messages');
    expect(readModule('05aa.js')).toContain('"Bonjour"');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('does not support')
    );
  });

  it('removes modules for messages that lost their translations', () => {
    writeLocale('fr', { '05aa': 'Bonjour', ff00: 'Au revoir' });
    resolveInlineTranslations(modulesFiles);
    fs.writeFileSync(path.join(cwd, '.gt/messages/abcd.js'), 'mine');
    writeLocale('fr', { '05aa': 'Bonjour' });

    resolveInlineTranslations(modulesFiles);

    expect(fs.readdirSync(path.join(cwd, '.gt/messages')).sort()).toEqual([
      '05aa.js',
      'abcd.js',
    ]);
  });

  it('passes the hashes with a module and their import alias to the plugin', () => {
    writeLocale('fr', { '05aa': 'Bonjour', Custom: 'Perso' });
    const result = resolveInlineTranslations(modulesFiles)!;
    expect(result.modules).toEqual({
      dir: '.gt/messages',
      importDir: 'gt-next/internal/_inline-messages',
    });
    expect(fs.readdirSync(path.join(cwd, '.gt/messages'))).toEqual(['05aa.js']);
  });

  it('keeps the content hash when only translation text changes', () => {
    writeLocale('fr', { '05aa': 'Bonjour' });
    const first = resolveInlineTranslations(modulesFiles)!;
    writeLocale('fr', { '05aa': 'Bonjour !' });
    const second = resolveInlineTranslations(modulesFiles)!;
    writeLocale('fr', { '05aa': 'Bonjour !', ff00: 'Au revoir' });
    const third = resolveInlineTranslations(modulesFiles)!;

    expect(second.contentHash).toBe(first.contentHash);
    expect(third.contentHash).not.toBe(first.contentHash);
    expect(readModule('05aa.js')).toContain('"Bonjour !"');
  });

  it('warns and still returns the options when modules cannot be written', () => {
    writeLocale('fr', { '05aa': 'Bonjour' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fs.mkdirSync(path.join(cwd, '.gt'));
    fs.chmodSync(path.join(cwd, '.gt'), 0o555);
    try {
      const result = resolveInlineTranslations(modulesFiles);
      expect(result?.modules?.dir).toBe('.gt/messages');
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('could not be written')
      );
    } finally {
      fs.chmodSync(path.join(cwd, '.gt'), 0o755);
    }
  });

  it('rejects a modulesDir outside the working directory', () => {
    writeLocale('fr', { '05aa': 'Bonjour' });
    expect(() =>
      resolveInlineTranslations({
        ...gtFiles,
        inlineTranslations: {
          locales: ['fr'],
          modules: 'physical',
          modulesDir: '../elsewhere',
        },
      })
    ).toThrow('only read inside the working directory');
  });
});
