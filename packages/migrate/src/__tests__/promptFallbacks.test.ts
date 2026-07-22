import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveCatalogsInteractively } from '../catalogs/promptFallbacks.js';
import type { MigrateIO } from '../pipeline/io.js';
import type { RoutingInfo } from '../pipeline/types.js';

// The interactive fallback runs entirely through the injected io (the CLI wires
// io.prompt* to its @clack/prompts helpers and io.warn/error to its logger); a
// fake scripts the answers and records the diagnostics.
function makeIO() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    guardGit: vi.fn(),
    promptConfirm: vi.fn(),
    promptText: vi.fn(),
    promptLocale: vi.fn(),
    promptLocaleList: vi.fn(),
  } satisfies MigrateIO;
}
let io: ReturnType<typeof makeIO>;

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
  io = makeIO();
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
    const result = await resolveCatalogsInteractively(cwd, emptyRouting, io);
    expect(result).toBeNull();
    expect(io.promptText).not.toHaveBeenCalled();
    expect(io.promptLocaleList).not.toHaveBeenCalled();
    expect(io.promptLocale).not.toHaveBeenCalled();
  });

  it('builds MessageCatalogs from the answered directory, locales, and default', async () => {
    const cwd = makeProject({
      'messages/en.json': JSON.stringify({ Home: { title: 'Hello' } }),
      'messages/es.json': JSON.stringify({ Home: { title: 'Hola' } }),
    });
    io.promptText.mockResolvedValue('messages');
    io.promptLocaleList.mockResolvedValue(['en', 'es']);
    io.promptLocale.mockResolvedValue('en');

    const result = await resolveCatalogsInteractively(cwd, emptyRouting, io);
    expect(result).not.toBeNull();
    expect(result!.dir).toBe(path.join(cwd, 'messages'));
    expect(result!.defaultLocale).toBe('en');
    expect(result!.locales.sort()).toEqual(['en', 'es']);
    expect(result!.byLocale.en).toEqual({ Home: { title: 'Hello' } });
    expect(result!.byLocale.es).toEqual({ Home: { title: 'Hola' } });
    // The lead-in goes through the standard diagnostic messaging system.
    expect(io.warn).toHaveBeenCalledWith(
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
    io.promptText.mockResolvedValue('messages');
    io.promptLocaleList.mockResolvedValue(['en', 'es']);
    io.promptLocale.mockResolvedValue('de');

    const result = await resolveCatalogsInteractively(cwd, emptyRouting, io);
    expect(result).toBeNull();
    expect(io.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "Default locale 'de' is not one of the selected locales [en, es]"
      )
    );
  });

  it('returns null when a chosen locale has no catalog file', async () => {
    const cwd = makeProject({
      'messages/en.json': JSON.stringify({ a: 'A' }),
    });
    io.promptText.mockResolvedValue('messages');
    io.promptLocaleList.mockResolvedValue(['en', 'fr']);
    io.promptLocale.mockResolvedValue('en');

    const result = await resolveCatalogsInteractively(cwd, emptyRouting, io);
    expect(result).toBeNull();
    expect(io.error).toHaveBeenCalledWith(
      expect.stringContaining("No catalog file found for 'fr'")
    );
  });
});
