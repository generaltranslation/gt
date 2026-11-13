import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { expect, test } from 'vitest';
import {
  SpilledBytes,
  spilledReader,
} from '../../src/compiler/utils/spill-file.js';

/** The built module, which another thread loads: CI builds it before testing. */
const BUILT = path.resolve(
  import.meta.dirname,
  '../../dist/src/compiler/utils/spill-file.js'
);

test('reads back the bytes of each key, and nothing for an unknown key', () => {
  const spilled = new SpilledBytes();
  spilled.set('a.vue', Buffer.from('first'));
  spilled.set('b.svelte', Buffer.from('second, longer'));

  try {
    expect(spilled.get('b.svelte')?.toString()).toBe('second, longer');
    expect(spilled.get('a.vue')?.toString()).toBe('first');
    expect(spilled.get('c.astro')).toBeUndefined();

    const read = spilledReader(spilled.shared());
    expect(read('a.vue')?.toString()).toBe('first');
  } finally {
    spilled.close();
  }
});

test('another thread reads them through the same descriptor', async () => {
  const spilled = new SpilledBytes();
  spilled.set('a.vue', Buffer.from('generated'));
  const { fd, places } = spilled.shared();
  const [, [position, length]] = places[0]!;

  try {
    const read = new Worker(
      `const fs = require('node:fs');
       const { workerData: { fd, position, length } } = require('node:worker_threads');
       const bytes = Buffer.alloc(length);
       fs.readSync(fd, bytes, 0, length, position);
       require('node:worker_threads').parentPort.postMessage(bytes.toString());`,
      { eval: true, workerData: { fd, position, length } }
    );
    const text = await new Promise((resolve, reject) => {
      read.once('message', resolve);
      read.once('error', reject);
    });

    expect(text).toBe('generated');
  } finally {
    spilled.close();
  }
});

test.skipIf(!existsSync(BUILT))(
  'a read that fails in another thread throws, rather than wait',
  async () => {
    const spilled = new SpilledBytes();
    spilled.set('a.vue', Buffer.from('generated'));
    const { fd, places } = spilled.shared();
    const [, [position, length]] = places[0]!;
    // One byte more than the file has.
    const shared = { fd, places: [['a.vue', [position, length + 1]]] };

    try {
      const read = new Worker(
        `const { parentPort, workerData: { module, shared } } = require('node:worker_threads');
         import(module)
           .then(({ spilledReader }) => spilledReader(shared)('a.vue').toString())
           .catch((error) => error.message)
           .then((answer) => parentPort.postMessage(answer));`,
        {
          eval: true,
          workerData: { module: pathToFileURL(BUILT).href, shared },
        }
      );
      const answer = await new Promise((resolve, reject) => {
        read.once('message', resolve);
        read.once('error', reject);
      });

      expect(answer).toBe('a spilled file ended early');
    } finally {
      spilled.close();
    }
  }
);

test('makes no file until bytes are added', () => {
  const spilled = new SpilledBytes();

  expect(spilled.shared()).toEqual({ fd: -1, places: [] });
  spilled.close();
});
