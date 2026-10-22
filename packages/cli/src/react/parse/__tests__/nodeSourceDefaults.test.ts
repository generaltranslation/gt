import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInlineUpdates } from '../createInlineUpdates.js';
import { GT_PARSING_FLAGS_DEFAULT } from '../../../config/defaults.js';
import { generateSettings } from '../../../config/generateSettings.js';
import { InlineCLI } from '../../../cli/inline.js';
import { Libraries } from '../../../types/libraries.js';
import type { Settings, TranslateFlags } from '../../../types/index.js';

vi.mock('../../../config/generateSettings.js', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../../config/generateSettings.js')
  >()),
  generateSettings: vi.fn(),
}));

const parsingOptions = { conditionNames: ['import', 'default'] };

/** Runs `gt generate` with saved translations in _gt/[locale].json. */
class GenerateCLI extends InlineCLI {
  generate() {
    vi.mocked(generateSettings).mockResolvedValue({
      defaultLocale: 'en',
      locales: ['fr'],
      files: {
        placeholderPaths: { gt: path.join(process.cwd(), '_gt/[locale].json') },
        gtJson: { parsingFlags: GT_PARSING_FLAGS_DEFAULT },
      },
      parsingOptions,
    } as unknown as Settings);
    return this.handleGenerateSourceCommand({} as TranslateFlags);
  }
}

function readJSON(file: string) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// chmod cannot take read access away on Windows or from root.
const canDenyReads = process.platform !== 'win32' && process.getuid?.() !== 0;

// Valid TypeScript, because TypeScript removes an import that names only a
// type, but Babel's scope tracker throws on the two bindings of Foo.
const importedTypeAndValue =
  "import { Foo } from './types';\nlet Foo: Foo | undefined;\n";

function writeHandler(file: string, text: string, library = 'gt-node') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    `import { getGT } from '${library}';

export async function handler() {
  const gt = await getGT();
  return gt('${text}');
}
`
  );
}

describe('createInlineUpdates default source scope for gt-node', () => {
  let originalCwd: string;
  let tmpDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-node-src-'));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    for (const folder of ['pgdata', 'scripts']) {
      if (fs.existsSync(path.join(tmpDir, folder))) {
        fs.chmodSync(path.join(tmpDir, folder), 0o755);
      }
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('scans root and nested files, but not dependencies', async () => {
    writeHandler('server.js', 'From the root');
    writeHandler('routes/users.mjs', 'From a route');
    writeHandler('src/app.ts', 'From src');
    writeHandler('node_modules/dep/index.js', 'From a dependency');
    writeHandler(
      'services/api/node_modules/dep/index.js',
      'From a nested dependency'
    );

    const { updates } = await createInlineUpdates(
      Libraries.GT_NODE,
      false,
      undefined,
      GT_PARSING_FLAGS_DEFAULT,
      parsingOptions
    );

    expect(updates.map((update) => update.source).sort()).toEqual([
      'From a route',
      'From src',
      'From the root',
    ]);
  });

  it('skips folders it cannot read and parses CommonJS scripts', async () => {
    writeHandler('server.js', 'From the root');
    fs.writeFileSync(
      'migrate.cjs',
      `const { getGT } = require('gt-node');
if (!process.env.DATABASE_URL) return;
async function main() {
  const gt = await getGT();
  return gt('From a CommonJS script');
}
main();
`
    );
    // A database volume owned by another user, as Docker leaves it.
    fs.mkdirSync('pgdata/base', { recursive: true });
    fs.chmodSync('pgdata', 0o000);

    const { updates, errors } = await createInlineUpdates(
      Libraries.GT_NODE,
      false,
      undefined,
      GT_PARSING_FLAGS_DEFAULT,
      parsingOptions
    );

    expect(errors).toEqual([]);
    expect(updates.map((update) => update.source).sort()).toEqual([
      'From a CommonJS script',
      'From the root',
    ]);
  });

  it.skipIf(!canDenyReads)('skips files it cannot read', async () => {
    writeHandler('server.js', 'From the root');
    // A script owned by another user, as a container can leave it.
    writeHandler('scripts/migrate.cjs', 'From an unreadable script');
    fs.chmodSync('scripts/migrate.cjs', 0o000);

    const { updates, errors } = await createInlineUpdates(
      Libraries.GT_NODE,
      false,
      undefined,
      GT_PARSING_FLAGS_DEFAULT,
      parsingOptions
    );

    expect(errors).toEqual([]);
    expect(updates.map((update) => update.source)).toEqual(['From the root']);
  });

  it.skipIf(!canDenyReads)(
    'still fails on an unreadable file that src matches',
    async () => {
      writeHandler('server.js', 'From the root');
      fs.chmodSync('server.js', 0o000);

      await expect(
        createInlineUpdates(
          Libraries.GT_NODE,
          false,
          ['**/*.js'],
          GT_PARSING_FLAGS_DEFAULT,
          parsingOptions
        )
      ).rejects.toThrow(/EACCES|EPERM/);
    }
  );

  it.skipIf(!canDenyReads).each(['scripts/migrate.cjs', 'scripts'])(
    'generate keeps saved translations when it cannot read %s',
    async (unreadable) => {
      writeHandler('server.js', 'From the root');
      writeHandler('scripts/migrate.cjs', 'From a script');
      const cli = new GenerateCLI(new Command(), Libraries.GT_NODE);
      await cli.generate();
      const source: Record<string, string> = readJSON('_gt/en.json');
      expect(Object.values(source).sort()).toEqual([
        'From a script',
        'From the root',
      ]);
      const saved = Object.fromEntries(
        Object.entries(source).map(([hash, text]) => [hash, `fr: ${text}`])
      );
      fs.writeFileSync('_gt/fr.json', JSON.stringify(saved));

      fs.chmodSync(unreadable, 0o000);
      await cli.generate();

      expect(readJSON('_gt/fr.json')).toEqual(saved);
    }
  );

  it('scans TypeScript that gives a type and a value the same name', async () => {
    fs.writeFileSync('types.ts', 'export interface Foo { id: string }\n');
    fs.writeFileSync(
      'root.d.ts',
      "import type { Foo } from './types';\nexport declare let Foo: Foo;\n"
    );
    fs.writeFileSync(
      'server.ts',
      `import { type Foo } from './types';
import { getGT } from 'gt-node';

let Foo: Foo | undefined;

export async function handler() {
  const gt = await getGT();
  return gt('From a typed file');
}
`
    );
    writeHandler('src/app.ts', 'From src');

    const { updates } = await createInlineUpdates(
      Libraries.GT_NODE,
      false,
      undefined,
      GT_PARSING_FLAGS_DEFAULT,
      parsingOptions
    );

    expect(updates.map((update) => update.source).sort()).toEqual([
      'From a typed file',
      'From src',
    ]);
  });

  it('skips files that fail to parse, and scans the rest', async () => {
    fs.writeFileSync('types.ts', 'export interface Foo { id: string }\n');
    fs.writeFileSync('models.ts', importedTypeAndValue);
    fs.writeFileSync('broken.js', 'const = ;\n');
    writeHandler('src/app.ts', 'From src');
    const skippedPaths: string[] = [];

    const { updates, errors, warnings } = await createInlineUpdates(
      Libraries.GT_NODE,
      false,
      undefined,
      GT_PARSING_FLAGS_DEFAULT,
      parsingOptions,
      skippedPaths
    );

    expect(errors).toEqual([]);
    expect(updates.map((update) => update.source)).toEqual(['From src']);
    expect(skippedPaths.map((file) => path.basename(file)).sort()).toEqual([
      'broken.js',
      'models.ts',
    ]);
    expect(warnings.sort()).toEqual([
      expect.stringMatching(/broken\.js.*Unexpected token/),
      expect.stringMatching(/models\.ts.*buildError/),
    ]);
  });

  it('still fails on a file that src matches and Babel cannot traverse', async () => {
    fs.writeFileSync('types.ts', 'export interface Foo { id: string }\n');
    fs.writeFileSync('models.ts', importedTypeAndValue);

    await expect(
      createInlineUpdates(
        Libraries.GT_NODE,
        false,
        ['**/*.ts'],
        GT_PARSING_FLAGS_DEFAULT,
        parsingOptions
      )
    ).rejects.toThrow(/buildError/);
  });

  it('keeps the React default scope for other libraries', async () => {
    writeHandler('server.js', 'From the root', 'gt-react');
    writeHandler('src/app.js', 'From src', 'gt-react');

    const { updates } = await createInlineUpdates(
      Libraries.GT_REACT,
      false,
      undefined,
      GT_PARSING_FLAGS_DEFAULT,
      parsingOptions
    );

    expect(updates.map((update) => update.source)).toEqual(['From src']);
  });

  // Each entry of the default deny list: paths it skips, and a path with a
  // similar name that the scan still reads.
  it.each([
    {
      entry: 'dist',
      denied: ['dist/server.js', 'services/api/dist/server.js'],
      similar: 'distance.js',
    },
    {
      entry: 'build',
      denied: ['build/server.js', 'packages/web/build/app.js'],
      similar: 'buildings/index.js',
    },
    {
      entry: 'coverage',
      denied: [
        'coverage/lcov-report/prettify.js',
        'packages/api/coverage/lcov-report/sorter.js',
      ],
      similar: 'routes/coverage.js',
    },
    {
      entry: 'public',
      denied: ['public/app.js', 'packages/web/public/sw.js'],
      similar: 'publications/index.js',
    },
    {
      entry: 'test',
      denied: ['test/server.js', 'packages/api/test/users.js'],
      similar: 'testimonials/index.js',
    },
    {
      entry: 'tests',
      denied: ['tests/server.js', 'packages/api/tests/users.js'],
      similar: 'contests/index.js',
    },
    {
      entry: '__tests__',
      denied: ['__tests__/server.js', 'src/routes/__tests__/users.js'],
      similar: 'src/__shared__/strings.js',
    },
    {
      entry: '*.test.*',
      denied: ['server.test.js', 'src/routes/users.test.ts'],
      similar: 'routes/latest.js',
    },
    {
      entry: '*.spec.*',
      denied: ['server.spec.ts', 'src/routes/users.spec.mjs'],
      similar: 'routes/specials.js',
    },
  ])('skips $entry, but still scans $similar', async ({ denied, similar }) => {
    for (const file of [...denied, similar]) {
      writeHandler(file, `From ${file}`);
    }

    const { updates } = await createInlineUpdates(
      Libraries.GT_NODE,
      false,
      undefined,
      GT_PARSING_FLAGS_DEFAULT,
      parsingOptions
    );

    expect(updates.map((update) => update.source)).toEqual([`From ${similar}`]);
  });
});
