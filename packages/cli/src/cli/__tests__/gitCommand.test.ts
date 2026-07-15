import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseCLI } from '../base.js';
import { logger } from '../../console/logger.js';

vi.mock('../../console/logging.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../console/logging.js')>();
  return {
    ...actual,
    exitSync: vi.fn((code: number): never => {
      throw new Error(`exit ${code}`);
    }),
  };
});

const json = (value: unknown) => JSON.stringify(value, null, 2);

describe('gt git merge-driver command', () => {
  let tempDir: string | null = null;

  beforeEach(() => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  function createProgram(): Command {
    const program = new Command();
    new BaseCLI(program, 'gt-react');
    return program;
  }

  function writeMergeFiles(base: unknown, ours: unknown, theirs: unknown) {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-merge-cli-'));
    const basePath = path.join(tempDir, 'base.json');
    const oursPath = path.join(tempDir, 'ours.json');
    const theirsPath = path.join(tempDir, 'theirs.json');
    fs.writeFileSync(basePath, json(base));
    fs.writeFileSync(oursPath, json(ours));
    fs.writeFileSync(theirsPath, json(theirs));
    return { basePath, oursPath, theirsPath };
  }

  it('exits with code 1 for unknown driver names', async () => {
    const program = createProgram();

    await expect(
      program.parseAsync(['git', 'merge-driver', 'bogus', 'a', 'b', 'c'], {
        from: 'user',
      })
    ).rejects.toThrow('exit 1');
    expect(logger.error).toHaveBeenCalledWith('Unknown GT merge driver: bogus');
  });

  it('merges and writes the ours file for a clean gtjson merge', async () => {
    const { basePath, oursPath, theirsPath } = writeMergeFiles(
      { hello: 'Hello' },
      { hello: 'Hello', bye: 'Bye' },
      { hello: 'Hello', nav: 'Nav' }
    );
    const program = createProgram();

    await program.parseAsync(
      ['git', 'merge-driver', 'gtjson', basePath, oursPath, theirsPath],
      { from: 'user' }
    );

    expect(fs.readFileSync(oursPath, 'utf8')).toBe(
      json({ hello: 'Hello', bye: 'Bye', nav: 'Nav' }) + '\n'
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('exits with code 1 and reports the reason on conflict', async () => {
    const { basePath, oursPath, theirsPath } = writeMergeFiles(
      { hello: 'Hello' },
      { hello: 'Hi' },
      { hello: 'Hola' }
    );
    const program = createProgram();

    await expect(
      program.parseAsync(
        ['git', 'merge-driver', 'gt-lock', basePath, oursPath, theirsPath],
        { from: 'user' }
      )
    ).rejects.toThrow('exit 1');
    expect(logger.error).toHaveBeenCalledWith(
      'base gt-lock.json contains unsupported top-level fields'
    );
    expect(fs.readFileSync(oursPath, 'utf8')).toBe(json({ hello: 'Hi' }));
  });
});
