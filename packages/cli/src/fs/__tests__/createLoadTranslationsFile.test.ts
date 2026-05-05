import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createLoadTranslationsFile } from '../createLoadTranslationsFile.js';
import {
  DEFAULT_TRANSLATIONS_DIR,
  DEFAULT_VITE_TRANSLATIONS_DIR,
} from '../../utils/constants.js';

describe('createLoadTranslationsFile', () => {
  const tmpDir = path.join(__dirname, '__tmp_test_create_load_translations__');
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    fs.mkdirSync(tmpDir, { recursive: true });
    // The function uses cwd-relative paths for mkdir, so we chdir
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates loadTranslations.js in src/ when src directory exists', async () => {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });

    await createLoadTranslationsFile(tmpDir, DEFAULT_TRANSLATIONS_DIR, [
      'es',
      'fr',
    ]);

    const filePath = path.join(tmpDir, 'src', 'loadTranslations.js');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('export default async function loadTranslations');
    expect(content).toContain('import(`../public/_gt/${locale}.json`)');
  });

  it('creates loadTranslations.js at root when no src directory exists', async () => {
    await createLoadTranslationsFile(tmpDir, DEFAULT_TRANSLATIONS_DIR, ['es']);

    const filePath = path.join(tmpDir, 'loadTranslations.js');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('export default async function loadTranslations');
    expect(content).toContain('import(`./public/_gt/${locale}.json`)');
  });

  it('uses correct relative path for Vite translations dir (./src/_gt)', async () => {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });

    await createLoadTranslationsFile(tmpDir, DEFAULT_VITE_TRANSLATIONS_DIR, [
      'es',
    ]);

    const filePath = path.join(tmpDir, 'src', 'loadTranslations.js');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('import(`./_gt/${locale}.json`)');
    expect(content).not.toContain('public/_gt');
  });

  it('prefixes nested Vite paths with ./ when loadTranslations.js is at the project root', async () => {
    await createLoadTranslationsFile(tmpDir, DEFAULT_VITE_TRANSLATIONS_DIR, [
      'es',
    ]);

    const filePath = path.join(tmpDir, 'loadTranslations.js');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('import(`./src/_gt/${locale}.json`)');
  });

  it('prefixes hidden relative directories with ./', async () => {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });

    await createLoadTranslationsFile(tmpDir, './src/.gt', ['es']);

    const filePath = path.join(tmpDir, 'src', 'loadTranslations.js');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('import(`./.gt/${locale}.json`)');
  });

  it('creates locale JSON files in the translations directory', async () => {
    await createLoadTranslationsFile(tmpDir, DEFAULT_TRANSLATIONS_DIR, [
      'es',
      'fr',
    ]);

    const translationsPath = path.resolve(tmpDir, DEFAULT_TRANSLATIONS_DIR);
    expect(fs.existsSync(path.join(translationsPath, 'es.json'))).toBe(true);
    expect(fs.existsSync(path.join(translationsPath, 'fr.json'))).toBe(true);

    const content = JSON.parse(
      fs.readFileSync(path.join(translationsPath, 'es.json'), 'utf-8')
    );
    expect(content).toEqual({});
  });

  it('creates locale JSON files in Vite translations directory', async () => {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });

    await createLoadTranslationsFile(tmpDir, DEFAULT_VITE_TRANSLATIONS_DIR, [
      'es',
    ]);

    const translationsPath = path.resolve(
      tmpDir,
      DEFAULT_VITE_TRANSLATIONS_DIR
    );
    expect(fs.existsSync(path.join(translationsPath, 'es.json'))).toBe(true);
  });

  it('does not overwrite existing loadTranslations.js', async () => {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    const filePath = path.join(tmpDir, 'src', 'loadTranslations.js');
    fs.writeFileSync(filePath, '// custom content');

    await createLoadTranslationsFile(tmpDir, DEFAULT_TRANSLATIONS_DIR, ['es']);

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toBe('// custom content');
  });

  it('does not overwrite existing locale JSON files', async () => {
    const translationsPath = path.resolve(tmpDir, DEFAULT_TRANSLATIONS_DIR);
    fs.mkdirSync(translationsPath, { recursive: true });
    fs.writeFileSync(
      path.join(translationsPath, 'es.json'),
      '{"hello":"hola"}'
    );

    await createLoadTranslationsFile(tmpDir, DEFAULT_TRANSLATIONS_DIR, ['es']);

    const content = JSON.parse(
      fs.readFileSync(path.join(translationsPath, 'es.json'), 'utf-8')
    );
    expect(content).toEqual({ hello: 'hola' });
  });

  it('defaults to ./public/_gt when no translationsDir is provided', async () => {
    await createLoadTranslationsFile(tmpDir, undefined as any, ['es']);

    const filePath = path.join(tmpDir, 'loadTranslations.js');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('import(`./public/_gt/${locale}.json`)');
  });
});
