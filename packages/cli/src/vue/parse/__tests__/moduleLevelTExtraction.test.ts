import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hashSource } from 'generaltranslation/id';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createVueInlineUpdates } from '../createVueInlineUpdates.js';

const parsingFlags = {
  autoderive: false,
  enableAutoJsxInjection: false,
  includeSourceCodeContext: false,
  legacyGtReactImportSource: false,
};

let fixtureRoot: string;

beforeEach(() => {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-vue-cli-t-'));
  fs.mkdirSync(path.join(fixtureRoot, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(fixtureRoot, 'package.json'),
    JSON.stringify({ dependencies: { 'gt-vue': '0.0.0' } })
  );
  vi.spyOn(process, 'cwd').mockReturnValue(fixtureRoot);
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(fixtureRoot, { force: true, recursive: true });
});

describe('module-level gt-vue t() CLI extraction', () => {
  it('deduplicates registered strings and emits runtime-compatible hashes', async () => {
    fs.writeFileSync(
      path.join(fixtureRoot, 'src', 'messages.ts'),
      `import { msg, t } from 'gt-vue';
       t('Module greeting');
       t('Module greeting');
       msg('Module greeting');
       t('Module greeting', { $context: 'toolbar action' });
       t('Literal {name} — 你好\\nnext');`
    );

    const output = await createVueInlineUpdates(
      ['src/messages.ts'],
      parsingFlags
    );

    expect(output.errors).toEqual([]);
    expect(output.warnings).toEqual([]);
    expect(
      output.updates.map(({ dataFormat, metadata, source }) => ({
        context: metadata.context,
        dataFormat,
        hash: metadata.hash,
        source,
      }))
    ).toEqual([
      {
        context: undefined,
        dataFormat: 'STRING',
        hash: 'f7333e2142c92464',
        source: 'Module greeting',
      },
      {
        context: 'toolbar action',
        dataFormat: 'STRING',
        hash: 'e811c9263249a811',
        source: 'Module greeting',
      },
      {
        context: undefined,
        dataFormat: 'STRING',
        hash: '1eddffaf048e42ac',
        source: 'Literal {name} — 你好\nnext',
      },
    ]);

    // gt-vue's synchronous runtime lookup uses this same persisted STRING
    // contract. Pinning the values above catches accidental changes while
    // these assertions make the source/context inputs explicit.
    expect(
      hashSource({ dataFormat: 'STRING', source: 'Module greeting' })
    ).toBe('f7333e2142c92464');
    expect(
      hashSource({
        context: 'toolbar action',
        dataFormat: 'STRING',
        source: 'Module greeting',
      })
    ).toBe('e811c9263249a811');
    expect(
      hashSource({
        dataFormat: 'STRING',
        source: 'Literal {name} — 你好\nnext',
      })
    ).toBe('1eddffaf048e42ac');
  });

  it('preserves the catalog when a proven t() call is not static', async () => {
    fs.writeFileSync(
      path.join(fixtureRoot, 'src', 'messages.ts'),
      `import { t } from 'gt-vue';
       const context = getContext();
       t('Unsafe context', { $context: context });`
    );

    const output = await createVueInlineUpdates(
      ['src/messages.ts'],
      parsingFlags
    );

    expect(output.updates).toEqual([]);
    expect(output.errors).toEqual([
      expect.stringContaining('dynamic $context'),
    ]);
  });
});
