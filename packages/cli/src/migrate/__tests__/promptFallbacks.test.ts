import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveCatalogsInteractively } from '../promptFallbacks.js';
import type { RoutingInfo } from '../types.js';

vi.mock('../../console/logging.js', () => ({
  promptText: vi.fn(),
  promptLocale: vi.fn(),
  promptLocaleList: vi.fn(),
}));

vi.mock('../../console/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import {
  promptLocale,
  promptLocaleList,
  promptText,
} from '../../console/logging.js';
import { logger } from '../../console/logger.js';

const emptyRouting: RoutingInfo = {
  locales: null,
  defaultLocale: null,
  localePrefix: null,
  pathnames: null,
  routingFile: null,
  requestFile: null,
};

const tmpDirs: string[] = [];

function makeProject(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-migrate-fallback-'));
  tmpDirs.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return dir;
}

const originalIsTTY = process.stdin.isTTY;

beforeEach(() => {
  vi.clearAllMocks();
  // Default to an interactive session; the non-TTY case overrides this.
  process.stdin.isTTY = true;
});

afterEach(() => {
  process.stdin.isTTY = originalIsTTY;
  while (tmpDirs.length) {
    fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
  }
});

describe('resolveCatalogsInteractively', () => {
  it('returns null without prompting when the session is non-interactive', async () => {
    process.stdin.isTTY = false;
    const cwd = makeProject({
      'messages/en.json': JSON.stringify({ a: 'A' }),
    });
    const result = await resolveCatalogsInteractively(cwd, emptyRouting);
    expect(result).toBeNull();
    expect(promptText).not.toHaveBeenCalled();
    expect(promptLocaleList).not.toHaveBeenCalled();
    expect(promptLocale).not.toHaveBeenCalled();
  });

  it('builds MessageCatalogs from the answered directory, locales, and default', async () => {
    const cwd = makeProject({
      'messages/en.json': JSON.stringify({ Home: { title: 'Hello' } }),
      'messages/es.json': JSON.stringify({ Home: { title: 'Hola' } }),
    });
    vi.mocked(promptText).mockResolvedValue('messages');
    vi.mocked(promptLocaleList).mockResolvedValue(['en', 'es']);
    vi.mocked(promptLocale).mockResolvedValue('en');

    const result = await resolveCatalogsInteractively(cwd, emptyRouting);
    expect(result).not.toBeNull();
    expect(result!.dir).toBe(path.join(cwd, 'messages'));
    expect(result!.defaultLocale).toBe('en');
    expect(result!.locales.sort()).toEqual(['en', 'es']);
    expect(result!.byLocale.en).toEqual({ Home: { title: 'Hello' } });
    expect(result!.byLocale.es).toEqual({ Home: { title: 'Hola' } });
    // The lead-in goes through the standard diagnostic messaging system.
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Could not automatically locate your next-intl message catalogs'
      )
    );
  });

  it('returns null when the chosen default locale is not in the locales list', async () => {
    const cwd = makeProject({
      'messages/en.json': JSON.stringify({ a: 'A' }),
      'messages/es.json': JSON.stringify({ a: 'B' }),
    });
    vi.mocked(promptText).mockResolvedValue('messages');
    vi.mocked(promptLocaleList).mockResolvedValue(['en', 'es']);
    vi.mocked(promptLocale).mockResolvedValue('de');

    const result = await resolveCatalogsInteractively(cwd, emptyRouting);
    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "Default locale 'de' is not one of the selected locales [en, es]"
      )
    );
  });

  it('returns null when a chosen locale has no catalog file', async () => {
    const cwd = makeProject({
      'messages/en.json': JSON.stringify({ a: 'A' }),
    });
    vi.mocked(promptText).mockResolvedValue('messages');
    vi.mocked(promptLocaleList).mockResolvedValue(['en', 'fr']);
    vi.mocked(promptLocale).mockResolvedValue('en');

    const result = await resolveCatalogsInteractively(cwd, emptyRouting);
    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("No catalog file found for 'fr'")
    );
  });
});
