import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { publishNewFile } from '../publishNewFile.js';

describe('publishNewFile', () => {
  let directory: string;
  let filePath: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-publish-file-'));
    filePath = path.join(directory, 'generated.ts');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('publishes complete content without temporary residue', async () => {
    await expect(
      publishNewFile(filePath, 'complete', () => undefined)
    ).resolves.toBe(true);

    expect(fs.readFileSync(filePath, 'utf8')).toBe('complete');
    expect(fs.readdirSync(directory)).toEqual(['generated.ts']);
  });

  it('preserves and validates a destination that wins the publication race', async () => {
    const realLink = fs.promises.link.bind(fs.promises);
    const validateExisting = vi.fn(() => {
      expect(fs.readFileSync(filePath, 'utf8')).toBe('application source');
    });
    vi.spyOn(fs.promises, 'link').mockImplementationOnce(
      async (temporaryPath, destinationPath) => {
        fs.writeFileSync(destinationPath, 'application source');
        return realLink(temporaryPath, destinationPath);
      }
    );

    await expect(
      publishNewFile(filePath, 'generated source', validateExisting)
    ).resolves.toBe(false);

    expect(validateExisting).toHaveBeenCalledOnce();
    expect(fs.readFileSync(filePath, 'utf8')).toBe('application source');
    expect(fs.readdirSync(directory)).toEqual(['generated.ts']);
  });

  it('removes a partially written temporary file after a write failure', async () => {
    const realOpen = fs.promises.open.bind(fs.promises);
    vi.spyOn(fs.promises, 'open').mockImplementationOnce(
      async (...arguments_) => {
        const handle = await realOpen(...arguments_);
        const realWriteFile = handle.writeFile.bind(handle);
        vi.spyOn(handle, 'writeFile').mockImplementationOnce(async () => {
          await realWriteFile('partial', 'utf8');
          throw new Error('injected write failure');
        });
        return handle;
      }
    );

    await expect(
      publishNewFile(filePath, 'complete', () => undefined)
    ).rejects.toThrow('injected write failure');

    expect(fs.existsSync(filePath)).toBe(false);
    expect(fs.readdirSync(directory)).toEqual([]);
  });

  it('does not delete a colliding temporary file it does not own', async () => {
    const realOpen = fs.promises.open.bind(fs.promises);
    let collidingPath: fs.PathLike | undefined;
    vi.spyOn(fs.promises, 'open').mockImplementationOnce(
      async (temporaryPath, flags, mode) => {
        collidingPath = temporaryPath;
        fs.writeFileSync(temporaryPath, 'other process');
        return realOpen(temporaryPath, flags, mode);
      }
    );

    await expect(
      publishNewFile(filePath, 'generated', () => undefined)
    ).rejects.toMatchObject({ code: 'EEXIST' });

    expect(collidingPath).toBeDefined();
    expect(fs.readFileSync(collidingPath!, 'utf8')).toBe('other process');
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('allows only one concurrent publisher to create the destination', async () => {
    const validateExisting = () => {
      expect(fs.lstatSync(filePath).isFile()).toBe(true);
    };

    const results = await Promise.all([
      publishNewFile(filePath, 'same content', validateExisting),
      publishNewFile(filePath, 'same content', validateExisting),
      publishNewFile(filePath, 'same content', validateExisting),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(fs.readFileSync(filePath, 'utf8')).toBe('same content');
    expect(fs.readdirSync(directory)).toEqual(['generated.ts']);
  });
});
