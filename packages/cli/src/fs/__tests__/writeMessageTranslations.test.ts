import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Settings } from '../../types/index.js';
import { writeMessageTranslations } from '../writeMessageTranslations.js';
import { logger } from '../../console/logger.js';
import {
  clearMessageHashes,
  recordMessageHashes,
} from '../../state/messageHashes.js';

let dir: string;

function settings(
  msgOutput: string | undefined,
  locales = ['fr', 'es']
): Settings {
  return {
    locales: ['fr', 'es', 'de'],
    files: {
      placeholderPaths: { gt: path.join(dir, '[locale].json') },
      gtJson: { inlineTranslations: { locales, msgOutput }, parsingFlags: {} },
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
  vi.restoreAllMocks();
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

  test('skips locales that are not embedded', async () => {
    fs.writeFileSync(path.join(dir, 'de.json'), '{"a":"Hallo"}');
    recordMessageHashes(['a']);
    await writeMessageTranslations(
      settings(path.join(dir, '[locale].msg.json'), ['fr'])
    );
    expect(readJson('fr.msg.json')).toEqual({ a: 'Bonjour' });
    expect(fs.existsSync(path.join(dir, 'de.msg.json'))).toBe(false);
  });

  test('keeps the previous file and continues when a translations file is invalid', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    fs.writeFileSync(path.join(dir, 'fr.json'), '{ not json');
    fs.writeFileSync(path.join(dir, 'fr.msg.json'), '{"a":"Ancien"}');
    fs.writeFileSync(path.join(dir, 'es.json'), '{"a":"Hola"}');
    recordMessageHashes(['a']);
    const msgOutput = path.join(dir, '[locale].msg.json');

    await writeMessageTranslations(settings(msgOutput));
    expect(warn).toHaveBeenCalledOnce();
    expect(readJson('fr.msg.json')).toEqual({ a: 'Ancien' });
    expect(readJson('es.msg.json')).toEqual({ a: 'Hola' });

    fs.writeFileSync(path.join(dir, 'fr.json'), '{"a":"Bonjour"}');
    await writeMessageTranslations(settings(msgOutput));
    expect(readJson('fr.msg.json')).toEqual({ a: 'Bonjour' });
  });

  test.each([
    ['without [locale]', 'messages.json'],
    ['equal to files.gt.output', '[locale].json'],
  ])('does not write a msgOutput %s', async (_, fileName) => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    recordMessageHashes(['a']);
    await writeMessageTranslations(settings(path.join(dir, fileName)));
    expect(warn).toHaveBeenCalledOnce();
    expect(readJson('fr.json')).toEqual({
      a: 'Bonjour',
      b: 'Au revoir',
      c: 'Merci',
    });
    expect(fs.readdirSync(dir)).toEqual(['fr.json']);
  });

  test('does nothing without files.gt.inlineTranslations.msgOutput', async () => {
    recordMessageHashes(['a']);
    await writeMessageTranslations(settings(undefined));
    expect(fs.readdirSync(dir)).toEqual(['fr.json']);
  });
});
