import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInlineUpdates } from '../createInlineUpdates.js';
import { GT_PARSING_FLAGS_DEFAULT } from '../../../config/defaults.js';
import { Libraries } from '../../../types/libraries.js';

const parsingOptions = { conditionNames: ['import', 'default'] };

// chmod cannot take read access away on Windows or from root.
const canDenyReads = process.platform !== 'win32' && process.getuid?.() !== 0;

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
    if (fs.existsSync(path.join(tmpDir, 'pgdata'))) {
      fs.chmodSync(path.join(tmpDir, 'pgdata'), 0o755);
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
});
