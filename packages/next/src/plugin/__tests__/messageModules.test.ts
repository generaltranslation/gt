import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  collectMessageTranslations,
  isMessageModuleHash,
  renderMessageModule,
  writeMessageModules,
} from '../messageModules';

let dir: string;

beforeEach(() => {
  dir = path.join(
    fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gt-modules-'))),
    'messages'
  );
});

afterEach(() => {
  fs.rmSync(path.dirname(dir), { recursive: true, force: true });
});

function readModule(hash: string) {
  return fs.readFileSync(path.join(dir, `${hash}.js`), 'utf8');
}

async function importModule(hash: string) {
  const source = readModule(hash);
  const url = `data:text/javascript,${encodeURIComponent(source)}`;
  return ((await import(url)) as { default: (locale: string) => unknown })
    .default;
}

describe('renderMessageModule', () => {
  it('renders the inline translations callback as the default export', () => {
    expect(
      renderMessageModule([
        ['fr', 'Bonjour'],
        ['de', 'Hallo'],
      ])
    ).toBe(
      'export default (locale) => locale === "fr" ? "Bonjour" : locale === "de" ? "Hallo" : undefined;\n'
    );
  });

  it('renders JSX children data and escapes strings', async () => {
    const children = [{ t: 'b', c: 'Gras' }, ' "et" </script> '];
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'jsx.js'),
      renderMessageModule([['fr', children]])
    );
    const callback = await importModule('jsx');
    expect(callback('fr')).toEqual(children);
    expect(callback('de')).toBeUndefined();
  });
});

describe('isMessageModuleHash', () => {
  it('accepts hashes that are safe as file names', () => {
    expect(isMessageModuleHash('05a87bce151d258b')).toBe(true);
    expect(isMessageModuleHash('my-hash_2')).toBe(true);
  });

  it('rejects other hashes', () => {
    for (const hash of ['', '../x', 'a.b', 'a/b', 'é', '__proto__ ']) {
      expect(isMessageModuleHash(hash)).toBe(false);
    }
  });
});

describe('collectMessageTranslations', () => {
  it('groups translations by hash in locale order', () => {
    const messages = collectMessageTranslations([
      { locale: 'fr', translations: { a1: 'Bonjour', b2: 'Salut' } },
      { locale: 'de', translations: { a1: 'Hallo', c3: null } },
    ]);
    expect(Object.fromEntries(messages)).toEqual({
      a1: [
        ['fr', 'Bonjour'],
        ['de', 'Hallo'],
      ],
      b2: [['fr', 'Salut']],
    });
  });

  it('skips hashes that cannot be file names', () => {
    const messages = collectMessageTranslations([
      { locale: 'fr', translations: { '../x': 'Bonjour', ok: 'Salut' } },
    ]);
    expect(Array.from(messages.keys())).toEqual(['ok']);
  });
});

describe('writeMessageModules', () => {
  const messages = new Map([
    ['a1', [['fr', 'Bonjour']] as const],
    ['b2', [['fr', 'Salut']] as const],
  ]);

  it('writes one module per message', async () => {
    expect(writeMessageModules(dir, messages)).toEqual({
      written: 2,
      removed: 0,
    });
    expect(fs.readdirSync(dir).sort()).toEqual(['a1.js', 'b2.js']);
    expect((await importModule('a1'))('fr')).toBe('Bonjour');
  });

  it('only rewrites modules whose content changed', () => {
    writeMessageModules(dir, messages);
    const unchanged = path.join(dir, 'a1.js');
    const past = new Date(Date.now() - 60_000);
    fs.utimesSync(unchanged, past, past);

    const result = writeMessageModules(
      dir,
      new Map([
        ['a1', [['fr', 'Bonjour']] as const],
        ['b2', [['fr', 'Salut !']] as const],
      ])
    );

    expect(result).toEqual({ written: 1, removed: 0 });
    expect(Math.round(fs.statSync(unchanged).mtimeMs)).toBe(past.getTime());
    expect(readModule('b2')).toContain('"Salut !"');
  });

  it('removes stale modules and leaves other files alone', () => {
    writeMessageModules(dir, messages);
    fs.writeFileSync(path.join(dir, 'README.md'), '');
    fs.writeFileSync(path.join(dir, 'not.a.module.js'), '');

    const result = writeMessageModules(
      dir,
      new Map([['a1', [['fr', 'Bonjour']] as const]])
    );

    expect(result).toEqual({ written: 0, removed: 1 });
    expect(fs.readdirSync(dir).sort()).toEqual([
      'README.md',
      'a1.js',
      'not.a.module.js',
    ]);
  });

  it('removes temp files a dead writer left behind', () => {
    fs.mkdirSync(dir, { recursive: true });
    const fresh = path.join(dir, 'a1.js.123.tmp');
    const stale = path.join(dir, 'b2.js.456.tmp');
    fs.writeFileSync(fresh, '');
    fs.writeFileSync(stale, '');
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    fs.utimesSync(stale, old, old);

    writeMessageModules(dir, messages);

    expect(fs.existsSync(fresh)).toBe(true);
    expect(fs.existsSync(stale)).toBe(false);
  });
});
