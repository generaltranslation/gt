import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  mergeGtJson,
  mergeGtLockJson,
  runMergeDriver,
} from '../mergeDrivers.js';

const json = (value: unknown) => JSON.stringify(value, null, 2);

describe('mergeGtJson', () => {
  it('merges disjoint root keys', () => {
    const result = mergeGtJson(
      json({ hello: 'Hello' }),
      json({ hello: 'Hello', bye: 'Bye' }),
      json({ hello: 'Hello', nav: 'Nav' })
    );

    expect(result).toEqual({
      ok: true,
      content: json({ hello: 'Hello', bye: 'Bye', nav: 'Nav' }) + '\n',
    });
  });

  it('preserves ours key order and appends theirs-only keys', () => {
    const result = mergeGtJson(
      json({ zebra: 'Zebra', apple: 'Apple' }),
      json({ zebra: 'Zebra', mango: 'Mango', apple: 'Apple' }),
      json({ zebra: 'Zebra', apple: 'Apple', banana: 'Banana' })
    );

    expect(result).toEqual({
      ok: true,
      content:
        json({
          zebra: 'Zebra',
          mango: 'Mango',
          apple: 'Apple',
          banana: 'Banana',
        }) + '\n',
    });
  });

  it('keeps one-sided changes', () => {
    const result = mergeGtJson(
      json({ hello: 'Hello' }),
      json({ hello: 'Hi' }),
      json({ hello: 'Hello' })
    );

    expect(result).toEqual({
      ok: true,
      content: json({ hello: 'Hi' }) + '\n',
    });
  });

  it('deletes keys changed on one side and unchanged on the other', () => {
    const result = mergeGtJson(
      json({ hello: 'Hello' }),
      json({}),
      json({ hello: 'Hello' })
    );

    expect(result).toEqual({
      ok: true,
      content: json({}) + '\n',
    });
  });

  it('conflicts when both sides change the same key differently', () => {
    const result = mergeGtJson(
      json({ hello: 'Hello' }),
      json({ hello: 'Hi' }),
      json({ hello: 'Hola' })
    );

    expect(result).toEqual({
      ok: false,
      reason: 'Conflicting GTJSON changes for key "hello"',
    });
  });

  it('conflicts when one side deletes and the other changes a key', () => {
    const result = mergeGtJson(
      json({ hello: 'Hello' }),
      json({}),
      json({ hello: 'Hola' })
    );

    expect(result).toEqual({
      ok: false,
      reason: 'Conflicting GTJSON changes for key "hello"',
    });
  });

  it('keeps matching changes from both sides', () => {
    const result = mergeGtJson(
      json({ hello: 'Hello' }),
      json({ hello: 'Hi' }),
      json({ hello: 'Hi' })
    );

    expect(result).toEqual({
      ok: true,
      content: json({ hello: 'Hi' }) + '\n',
    });
  });

  it('fails on malformed JSON', () => {
    const result = mergeGtJson(
      json({ hello: 'Hello' }),
      '{',
      json({ hello: 'Hello' })
    );

    expect(result).toEqual({
      ok: false,
      reason: 'Could not parse ours JSON',
    });
  });

  it('fails on non-object roots', () => {
    const result = mergeGtJson(
      json({ hello: 'Hello' }),
      json(['Hello']),
      json({ hello: 'Hello' })
    );

    expect(result).toEqual({
      ok: false,
      reason: 'ours JSON must be an object',
    });
  });
});

describe('mergeGtLockJson', () => {
  it('merges disjoint generated entries and preserves ours branchId', () => {
    const result = mergeGtLockJson(
      lock({ branchId: 'branch-main', entries: [] }),
      lock({
        branchId: 'branch-ours',
        entries: [entry('file-a', 'version-a', 'es')],
      }),
      lock({
        branchId: 'branch-theirs',
        entries: [entry('file-b', 'version-b', 'fr')],
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.parse(result.content)).toEqual({
      version: 2,
      branchId: 'branch-ours',
      entries: [
        entry('file-a', 'version-a', 'es'),
        entry('file-b', 'version-b', 'fr'),
      ],
    });
  });

  it('unions locale translations for the same file version', () => {
    const result = mergeGtLockJson(
      lock({
        entries: [entry('file-a', 'version-a', 'es')],
      }),
      lock({
        entries: [
          {
            ...entry('file-a', 'version-a', 'es'),
            translations: {
              es: { updatedAt: '2026-01-01T00:00:00.000Z' },
            },
          },
        ],
      }),
      lock({
        entries: [
          {
            ...entry('file-a', 'version-a', 'fr'),
            translations: {
              fr: { updatedAt: '2026-01-02T00:00:00.000Z' },
            },
          },
        ],
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.parse(result.content).entries[0].translations).toEqual({
      es: { updatedAt: '2026-01-01T00:00:00.000Z' },
      fr: { updatedAt: '2026-01-02T00:00:00.000Z' },
    });
  });

  it('chooses the newer generated entry when both sides changed versions', () => {
    const result = mergeGtLockJson(
      lock({
        entries: [entry('file-a', 'version-old', 'es')],
      }),
      lock({
        entries: [
          {
            ...entry('file-a', 'version-ours', 'es'),
            translations: {
              es: { updatedAt: '2026-01-01T00:00:00.000Z' },
            },
          },
        ],
      }),
      lock({
        entries: [
          {
            ...entry('file-a', 'version-theirs', 'es'),
            translations: {
              es: { updatedAt: '2026-01-02T00:00:00.000Z' },
            },
          },
        ],
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.parse(result.content).entries[0].versionId).toBe(
      'version-theirs'
    );
  });

  it('takes a one-sided version update', () => {
    const baseEntry = entry('file-a', 'version-old', 'es');
    const result = mergeGtLockJson(
      lock({
        entries: [baseEntry],
      }),
      lock({
        entries: [entry('file-a', 'version-new', 'es')],
      }),
      lock({
        entries: [baseEntry],
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.parse(result.content).entries[0].versionId).toBe('version-new');
  });

  it('fails on malformed JSON', () => {
    const result = mergeGtLockJson(lock(), '{', lock());

    expect(result).toEqual({
      ok: false,
      reason: 'Could not parse ours JSON',
    });
  });

  it('fails on unsupported lockfile versions', () => {
    const result = mergeGtLockJson(
      lock(),
      json({ version: 1, entries: {} }),
      lock()
    );

    expect(result).toEqual({
      ok: false,
      reason: 'ours gt-lock.json must use version 2',
    });
  });

  it('fails on unknown manual-looking fields', () => {
    const result = mergeGtLockJson(
      lock(),
      json({
        version: 2,
        branchId: 'branch-ours',
        entries: [
          {
            ...entry('file-a', 'version-a', 'es'),
            manualNote: 'keep this',
          },
        ],
      }),
      lock()
    );

    expect(result).toEqual({
      ok: false,
      reason: 'ours gt-lock.json entry contains unsupported fields',
    });
  });
});

describe('runMergeDriver', () => {
  let tempDir: string | null = null;

  afterEach(() => {
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  function writeMergeFiles(base: unknown, ours: unknown, theirs: unknown) {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-merge-'));
    const basePath = path.join(tempDir, 'base.json');
    const oursPath = path.join(tempDir, 'ours.json');
    const theirsPath = path.join(tempDir, 'theirs.json');
    fs.writeFileSync(basePath, json(base));
    fs.writeFileSync(oursPath, json(ours));
    fs.writeFileSync(theirsPath, json(theirs));
    return { basePath, oursPath, theirsPath };
  }

  it('writes the merged result to the ours path on success', () => {
    const { basePath, oursPath, theirsPath } = writeMergeFiles(
      { hello: 'Hello' },
      { hello: 'Hello', bye: 'Bye' },
      { hello: 'Hello', nav: 'Nav' }
    );

    const result = runMergeDriver('gtjson', basePath, oursPath, theirsPath);

    expect(result.ok).toBe(true);
    expect(fs.readFileSync(oursPath, 'utf8')).toBe(
      json({ hello: 'Hello', bye: 'Bye', nav: 'Nav' }) + '\n'
    );
  });

  it('leaves the ours file untouched on conflict', () => {
    const { basePath, oursPath, theirsPath } = writeMergeFiles(
      { hello: 'Hello' },
      { hello: 'Hi' },
      { hello: 'Hola' }
    );

    const result = runMergeDriver('gtjson', basePath, oursPath, theirsPath);

    expect(result).toEqual({
      ok: false,
      reason: 'Conflicting GTJSON changes for key "hello"',
    });
    expect(fs.readFileSync(oursPath, 'utf8')).toBe(json({ hello: 'Hi' }));
  });

  it('treats a missing base file as empty', () => {
    const { basePath, oursPath, theirsPath } = writeMergeFiles(
      {},
      { hello: 'Hello' },
      { nav: 'Nav' }
    );
    fs.rmSync(basePath);

    const result = runMergeDriver('gtjson', basePath, oursPath, theirsPath);

    expect(result.ok).toBe(true);
    expect(fs.readFileSync(oursPath, 'utf8')).toBe(
      json({ hello: 'Hello', nav: 'Nav' }) + '\n'
    );
  });
});

function lock({
  branchId = 'branch-main',
  entries = [],
}: {
  branchId?: string;
  entries?: unknown[];
} = {}) {
  return json({ version: 2, branchId, entries });
}

function entry(fileId: string, versionId: string, locale: string) {
  return {
    fileId,
    versionId,
    translations: {
      [locale]: {
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    },
  };
}
