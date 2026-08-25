import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Settings } from '../../../types/index.js';
import { collectFonts } from '../collectFonts.js';

describe('collectFonts', () => {
  let projectRoot: string;
  const originalSeparator = Object.getOwnPropertyDescriptor(path, 'sep')!;

  beforeEach(() => {
    projectRoot = mkdtempSync(path.join(tmpdir(), 'gt-collect-fonts-'));
  });

  afterEach(() => {
    Object.defineProperty(path, 'sep', originalSeparator);
    rmSync(projectRoot, { recursive: true, force: true });
  });

  function makeSettings(overrides: Partial<Settings> = {}): Settings {
    return {
      // generateSettings always sets configDirectory to `<project root>/.gt`
      configDirectory: path.join(projectRoot, '.gt'),
      ...overrides,
    } as Settings;
  }

  it('resolves globs from the project root, not the .gt state directory', async () => {
    mkdirSync(path.join(projectRoot, 'public', 'fonts'), { recursive: true });
    const bytes = Buffer.from([0x00, 0x01, 0x00, 0x00, 0xff, 0xfe, 0x80]);
    writeFileSync(
      path.join(projectRoot, 'public', 'fonts', 'Inter.ttf'),
      bytes
    );

    const fonts = await collectFonts(
      makeSettings({ fonts: { include: ['public/fonts/*.ttf'] } })
    );

    expect(fonts).toHaveLength(1);
    expect(fonts[0].fileName).toBe('Inter.ttf');
    expect(fonts[0].assetType).toBe('FONT');
    // Byte round-trip: the base64 content must decode to the original bytes.
    expect(Buffer.from(fonts[0].content, 'base64').equals(bytes)).toBe(true);
  });

  it('applies exclude globs', async () => {
    mkdirSync(path.join(projectRoot, 'fonts'), { recursive: true });
    writeFileSync(
      path.join(projectRoot, 'fonts', 'Keep.ttf'),
      Buffer.from([1])
    );
    writeFileSync(
      path.join(projectRoot, 'fonts', 'Skip.ttf'),
      Buffer.from([2])
    );

    const fonts = await collectFonts(
      makeSettings({
        fonts: { include: ['fonts/*.ttf'], exclude: ['fonts/Skip.ttf'] },
      })
    );

    expect(fonts.map((f) => f.fileName)).toEqual(['Keep.ttf']);
  });

  it('normalizes Windows separators in font globs on Windows', async () => {
    Object.defineProperty(path, 'sep', {
      ...originalSeparator,
      value: path.win32.sep,
    });
    mkdirSync(path.join(projectRoot, 'public', 'fonts'), { recursive: true });
    writeFileSync(
      path.join(projectRoot, 'public', 'fonts', 'Inter.ttf'),
      Buffer.from([1])
    );

    const fonts = await collectFonts(
      makeSettings({ fonts: { include: ['public\\fonts\\*.ttf'] } })
    );

    expect(fonts.map((font) => font.fileName)).toEqual(['Inter.ttf']);
  });

  it.runIf(path.sep === path.posix.sep)(
    'preserves escaped font globs on POSIX',
    async () => {
      mkdirSync(path.join(projectRoot, 'fonts', '(brand)'), {
        recursive: true,
      });
      writeFileSync(
        path.join(projectRoot, 'fonts', '(brand)', 'Inter.ttf'),
        Buffer.from([1])
      );

      const fonts = await collectFonts(
        makeSettings({
          fonts: { include: ['fonts/\\(brand\\)/*.ttf'] },
        })
      );

      expect(fonts.map((font) => font.fileName)).toEqual(['Inter.ttf']);
    }
  );

  it('returns no fonts when the config is missing or empty', async () => {
    expect(await collectFonts(makeSettings())).toEqual([]);
    expect(
      await collectFonts(makeSettings({ fonts: { include: [] } }))
    ).toEqual([]);
  });
});
