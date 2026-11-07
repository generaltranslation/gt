import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { Settings } from '../../types/index.js';
import { writeMessageTranslations } from '../writeMessageTranslations.js';
import {
  clearMessageHashes,
  recordMessageHashes,
} from '../../state/messageHashes.js';

let dir: string;

function settings(msgOutput: string | undefined): Settings {
  return {
    locales: ['fr', 'es'],
    files: {
      placeholderPaths: { gt: path.join(dir, '[locale].json') },
      gtJson: { msgOutput, parsingFlags: {} },
    },
  } as unknown as Settings;
}

const readJson = (file: string) =>
  JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-msg-output-'));
  clearMessageHashes();
  fs.writeFileSync(
    path.join(dir, 'fr.json'),
    JSON.stringify({ a: 'Bonjour', b: 'Au revoir', c: 'Merci' })
  );
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('writeMessageTranslations', () => {
  test('keeps only message entries for each locale', async () => {
    recordMessageHashes(['a', 'c', 'missing']);
    await writeMessageTranslations(
      settings(path.join(dir, 'msg', '[locale].msg.json'))
    );
    expect(readJson('msg/fr.msg.json')).toEqual({ a: 'Bonjour', c: 'Merci' });
    // No translations file for es yet
    expect(fs.existsSync(path.join(dir, 'msg', 'es.msg.json'))).toBe(false);
  });

  test('writes an empty file when there are no message entries', async () => {
    recordMessageHashes([]);
    await writeMessageTranslations(
      settings(path.join(dir, '[locale].msg.json'))
    );
    expect(readJson('fr.msg.json')).toEqual({});
  });

  test('does nothing when nothing was extracted this run', async () => {
    fs.writeFileSync(path.join(dir, 'fr.msg.json'), '{"a":"Bonjour"}');
    await writeMessageTranslations(
      settings(path.join(dir, '[locale].msg.json'))
    );
    expect(readJson('fr.msg.json')).toEqual({ a: 'Bonjour' });
  });

  test('does nothing without files.gt.msgOutput', async () => {
    recordMessageHashes(['a']);
    await writeMessageTranslations(settings(undefined));
    expect(fs.readdirSync(dir)).toEqual(['fr.json']);
  });
});
