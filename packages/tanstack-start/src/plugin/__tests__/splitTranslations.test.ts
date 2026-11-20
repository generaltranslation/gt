import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, onTestFinished } from 'vitest';
import {
  createSplitTable,
  dropUnsplitTranslations,
  isSplitEnabled,
} from '../splitTranslations';

/** A client build's output directory that holds `files`. */
function writeBuild(files: Record<string, unknown>): string {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-split-table-'));
  onTestFinished(() => fs.rmSync(outDir, { force: true, recursive: true }));
  fs.mkdirSync(path.join(outDir, 'assets'));
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(outDir, name), JSON.stringify(content));
  }
  return outDir;
}

// What the compiler writes for a build that splits by chunk
const BY_CHUNK = {
  'assets/gt-chunk-translations.json': {
    defaultLocale: 'en',
    locales: ['fr'],
    entries: {
      'assets/index-a1.js': {
        translations: { fr: 'assets/index-a1.fr.11111111.json' },
      },
    },
    files: {
      'assets/reports-b2': { fr: 'assets/reports-b2.fr.22222222.json' },
    },
    imports: { 'assets/reports-b2.js': ['assets/reports-b2'] },
    unsplit: { fr: 'assets/gt-unsplit.fr.33333333.json' },
    current: 'assets/gt-current.json',
  },
  'assets/gt-current.json': { v: { fr: '22222222' }, c: 'abcd1234' },
  'assets/index-a1.fr.11111111.json': { t: { home: 'ACCUEIL' } },
  'assets/reports-b2.fr.22222222.json': { reports: 'RAPPORTS' },
  'assets/gt-unsplit.fr.33333333.json': { status: 'PRÊT', server: 'SERVEUR' },
};

describe('the table the server build reads', () => {
  it('holds the start state of each locale, read from the names of the files a build by chunk wrote', () => {
    const { table, contents } = createSplitTable(
      writeBuild(BY_CHUNK),
      'assets',
      '/',
      'inline'
    );
    expect(table).toEqual({
      firstVisit: 'inline',
      split: 'chunk',
      base: '/',
      states: {
        fr: {
          b: '/',
          f: 'assets/index-a1',
          h: { fr: '11111111' },
          v: { fr: '22222222' },
          n: 'assets/gt-current',
          c: 'abcd1234',
          u: 'assets/gt-unsplit',
          o: { fr: '33333333' },
        },
      },
      imports: BY_CHUNK['assets/gt-chunk-translations.json'].imports,
      files: BY_CHUNK['assets/gt-chunk-translations.json'].files,
      entry: { fr: 'assets/index-a1.fr.11111111.json' },
      entryChunk: 'assets/index-a1.js',
      entryKeys: [],
      unsplit: { fr: 'assets/gt-unsplit.fr.33333333.json' },
    });
    expect(Object.keys(contents.fr).sort()).toEqual([
      'assets/gt-unsplit.fr.33333333.json',
      'assets/index-a1.fr.11111111.json',
      'assets/reports-b2.fr.22222222.json',
    ]);
  });

  it("reads the map and the entry's files of a build by module, and no content when the page loads the files itself", () => {
    const { table, contents } = createSplitTable(
      writeBuild({
        'assets/gt-chunk-translations.json': {
          split: 'module',
          defaultLocale: 'en',
          locales: ['fr'],
          entries: { 'assets/index-a1.js': { files: ['assets/gt-0001'] } },
          files: {
            'assets/gt-0001': { fr: 'assets/gt-0001.fr.44444444.json' },
            'assets/gt-0002': { fr: 'assets/gt-0002.fr.55555555.json' },
          },
          imports: { 'assets/reports-b2.js': ['assets/gt-0002'] },
          maps: { fr: 'assets/gt-map.fr.66666666.json' },
        },
      }),
      'assets',
      '/app/',
      'files'
    );
    expect(table.split).toBe('module');
    expect(table.states.fr).toEqual({
      b: '/app/',
      f: 'assets/gt-map',
      h: { fr: '66666666' },
      v: {},
      e: { fr: { 'assets/gt-0001': '44444444' } },
    });
    expect(table.entryKeys).toEqual(['assets/gt-0001']);
    expect(contents).toEqual({});
  });
});

describe('the unsplit files of the client build', () => {
  const read = (outDir: string, name: string) =>
    JSON.parse(fs.readFileSync(path.join(outDir, name), 'utf8'));

  it('lose the translations only the server uses, and are named by what they then hold', () => {
    const outDir = writeBuild(BY_CHUNK);
    dropUnsplitTranslations(outDir, 'assets', ['server', 'unknown']);
    const { unsplit } = read(outDir, 'assets/gt-chunk-translations.json');
    expect(unsplit.fr).toMatch(/^assets\/gt-unsplit\.fr\.[0-9a-f]{8}\.json$/);
    expect(unsplit.fr).not.toBe('assets/gt-unsplit.fr.33333333.json');
    expect(read(outDir, unsplit.fr)).toEqual({ status: 'PRÊT' });
    expect(
      fs.existsSync(path.join(outDir, 'assets/gt-unsplit.fr.33333333.json'))
    ).toBe(false);
    expect(
      createSplitTable(outDir, 'assets', '/', 'inline').table.unsplit
    ).toEqual(unsplit);
  });

  it('are removed when nothing is left in them, and kept as they are when nothing is taken out', () => {
    const kept = writeBuild(BY_CHUNK);
    dropUnsplitTranslations(kept, 'assets', ['unknown']);
    expect(read(kept, 'assets/gt-chunk-translations.json').unsplit).toEqual(
      BY_CHUNK['assets/gt-chunk-translations.json'].unsplit
    );

    const emptied = writeBuild(BY_CHUNK);
    dropUnsplitTranslations(emptied, 'assets', ['server', 'status']);
    expect(
      'unsplit' in read(emptied, 'assets/gt-chunk-translations.json')
    ).toBe(false);
    expect(
      createSplitTable(emptied, 'assets', '/', 'inline').table.states.fr.u
    ).toBeUndefined();
  });
});

describe('whether the build splits translations', () => {
  it.each([
    [undefined, undefined, false],
    [{}, undefined, true],
    [{ enabled: false }, 'true', false],
    [{ by: 'module' }, 'false', false],
    [undefined, 'true', true],
    [false, undefined, false],
    [null, undefined, false],
  ] as const)(
    'option %j with GT_SPLIT_TRANSLATIONS=%s: %s',
    (option, env, expected) => {
      if (env === undefined) delete process.env.GT_SPLIT_TRANSLATIONS;
      else process.env.GT_SPLIT_TRANSLATIONS = env;
      onTestFinished(() => {
        delete process.env.GT_SPLIT_TRANSLATIONS;
      });
      expect(isSplitEnabled(option)).toBe(expected);
    }
  );
});
