import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, onTestFinished } from 'vitest';
import { defaultInlineTranslationsModulesDir } from 'generaltranslation/internal';
import {
  INLINE_TRANSLATIONS_MODULE_HEADER,
  isInlineTranslationsModuleHash,
  renderInlineTranslationsModule,
  renderInlineTranslationsModules,
  resolveInlineTranslationsModulesDir,
  writeInlineTranslationsModules,
} from '../transform/injection/inline-translations/inlineTranslationsModules';

function createDir(): string {
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'gt-modules-'))
  );
  onTestFinished(() => fs.rmSync(root, { recursive: true, force: true }));
  return path.join(root, 'messages');
}

async function importModule(source: string) {
  const url = `data:text/javascript,${encodeURIComponent(source)}`;
  return ((await import(url)) as { default: (locale: string) => unknown })
    .default;
}

describe('isInlineTranslationsModuleHash', () => {
  it('accepts computed hashes', () => {
    expect(isInlineTranslationsModuleHash('05a87bce151d258b')).toBe(true);
    expect(isInlineTranslationsModuleHash('my_hash_2')).toBe(true);
  });

  it('rejects hashes that are unsafe as file names or identifiers', () => {
    for (const hash of ['', '../x', 'a.b', 'a/b', 'é', 'my-hash', 'AB12']) {
      expect(isInlineTranslationsModuleHash(hash)).toBe(false);
    }
  });
});

describe('renderInlineTranslationsModule', () => {
  it('renders the inline callback as the default export', () => {
    expect(
      renderInlineTranslationsModule(
        { fr: { abc: 'Bonjour' }, es: { abc: 'Hola' } },
        'abc'
      )
    ).toBe(
      `${INLINE_TRANSLATIONS_MODULE_HEADER}\n` +
        'export default (locale) => locale === "fr" ? "Bonjour" : locale === "es" ? "Hola" : undefined;\n'
    );
  });

  it('round-trips JSX children data and escapes strings', async () => {
    const children = [{ t: 'b', c: 'Gras' }, ' "et" </script> Chaîne '];
    const callback = await importModule(
      renderInlineTranslationsModule({ fr: { abc: children } }, 'abc')!
    );
    expect(callback('fr')).toEqual(children);
    expect(callback('de')).toBeUndefined();
  });

  it('keeps __proto__ keys as own properties', async () => {
    const tree = JSON.parse(
      '{"b":{"__proto__":"proto","other":"autre"},"t":"x \\",\\"__proto__\\":"}'
    );
    const callback = await importModule(
      renderInlineTranslationsModule({ fr: { abc: tree } }, 'abc')!
    );
    expect(callback('fr')).toEqual(tree);
    expect(Object.hasOwn(callback('fr').b, '__proto__')).toBe(true);
  });

  it('returns undefined when no locale translates the hash', () => {
    expect(
      renderInlineTranslationsModule({ fr: { other: 'x', abc: null } }, 'abc')
    ).toBeUndefined();
  });
});

describe('renderInlineTranslationsModules', () => {
  it('renders one module per module hash across locales', () => {
    const modules = renderInlineTranslationsModules({
      fr: { aaa: 'A', 'my-hash': 'X' },
      es: { aaa: 'A2', bbb: 'B' },
    });
    expect(Array.from(modules.keys())).toEqual(['aaa', 'bbb']);
    expect(modules.get('aaa')).toContain(
      'locale === "fr" ? "A" : locale === "es" ? "A2"'
    );
  });

  it('renders nothing without a table', () => {
    expect(renderInlineTranslationsModules(undefined).size).toBe(0);
  });
});

describe('resolveInlineTranslationsModulesDir', () => {
  it('defaults to the canonical directory under the root', () => {
    expect(resolveInlineTranslationsModulesDir(undefined, '/app')).toBe(
      path.resolve('/app', defaultInlineTranslationsModulesDir)
    );
  });

  it('resolves a configured directory from the root', () => {
    expect(
      resolveInlineTranslationsModulesDir(
        { inlineTranslations: { locales: [], modulesDir: 'src/messages' } },
        '/app'
      )
    ).toBe(path.resolve('/app', 'src/messages'));
  });
});

describe('writeInlineTranslationsModules', () => {
  it('rewrites only changed modules and removes stale generated ones', () => {
    const dir = createDir();
    writeInlineTranslationsModules(
      dir,
      renderInlineTranslationsModules({ fr: { aaa: 'A', bbb: 'B', ccc: 'C' } })
    );
    const past = new Date(Date.now() - 60_000);
    for (const file of fs.readdirSync(dir)) {
      fs.utimesSync(path.join(dir, file), past, past);
    }
    fs.writeFileSync(path.join(dir, 'index.js'), 'export {};\n');

    expect(
      writeInlineTranslationsModules(
        dir,
        renderInlineTranslationsModules({ fr: { aaa: 'A', bbb: 'B2' } })
      )
    ).toEqual({ written: 1, removed: 1 });
    expect(fs.readdirSync(dir).sort()).toEqual([
      'aaa.js',
      'bbb.js',
      'index.js',
    ]);
    expect(
      Math.round(fs.statSync(path.join(dir, 'aaa.js')).mtimeMs / 1000)
    ).toBe(Math.round(past.getTime() / 1000));
    expect(fs.readFileSync(path.join(dir, 'bbb.js'), 'utf8')).toContain('"B2"');
  });

  it('refuses to overwrite a file it did not generate', () => {
    const dir = createDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.js'), 'export {};\n');
    expect(() =>
      writeInlineTranslationsModules(
        dir,
        renderInlineTranslationsModules({ fr: { index: 'Accueil' } })
      )
    ).toThrow('Did not overwrite');
    expect(fs.readFileSync(path.join(dir, 'index.js'), 'utf8')).toBe(
      'export {};\n'
    );
  });

  it('refuses to overwrite a file it cannot read', () => {
    const dir = createDir();
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'index.js');
    fs.writeFileSync(file, 'export {};\n');
    fs.chmodSync(file, 0o000);
    try {
      expect(() =>
        writeInlineTranslationsModules(
          dir,
          renderInlineTranslationsModules({ fr: { index: 'Accueil' } })
        )
      ).toThrow('EACCES');
    } finally {
      fs.chmodSync(file, 0o644);
    }
    expect(fs.readFileSync(file, 'utf8')).toBe('export {};\n');
  });

  it('removes every generated module once nothing is embedded', () => {
    const dir = createDir();
    writeInlineTranslationsModules(
      dir,
      renderInlineTranslationsModules({ fr: { aaa: 'A' } })
    );
    expect(writeInlineTranslationsModules(dir, new Map())).toEqual({
      written: 0,
      removed: 1,
    });
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('removes temp files a dead writer left behind', () => {
    const dir = createDir();
    fs.mkdirSync(dir, { recursive: true });
    const fresh = path.join(dir, 'aaa.js.tmp-1-x');
    const stale = path.join(dir, 'bbb.js.tmp-2-y');
    fs.writeFileSync(fresh, INLINE_TRANSLATIONS_MODULE_HEADER);
    fs.writeFileSync(stale, INLINE_TRANSLATIONS_MODULE_HEADER);
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    fs.utimesSync(stale, old, old);

    writeInlineTranslationsModules(dir, new Map());

    expect(fs.existsSync(fresh)).toBe(true);
    expect(fs.existsSync(stale)).toBe(false);
  });

  it('keeps old files that only look like its temp files', () => {
    const dir = createDir();
    fs.mkdirSync(dir, { recursive: true });
    const backup = path.join(dir, 'index.js.tmp-backup');
    const userFile = path.join(dir, 'index.js.tmp-1-x');
    fs.writeFileSync(backup, INLINE_TRANSLATIONS_MODULE_HEADER);
    fs.writeFileSync(userFile, 'export {};\n');
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    fs.utimesSync(backup, old, old);
    fs.utimesSync(userFile, old, old);

    writeInlineTranslationsModules(dir, new Map());

    expect(fs.readdirSync(dir).sort()).toEqual([
      'index.js.tmp-1-x',
      'index.js.tmp-backup',
    ]);
  });
});
