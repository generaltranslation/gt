import { Worker } from 'node:worker_threads';
import { expect, test } from 'vitest';
import {
  SpilledBytes,
  spilledReader,
} from '../../src/compiler/utils/spill-file.js';

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

test('makes no file until bytes are added', () => {
  const spilled = new SpilledBytes();

  expect(spilled.shared()).toEqual({ fd: -1, places: [] });
  spilled.close();
});
