import { vi } from 'vitest';
import type { MigrateIO } from '../../pipeline/io.js';

/**
 * The scripted answers a fake io gives. Defaults match what most suites
 * already used; any member can still be re-scripted per test through the
 * vitest mock it is (`io.promptText.mockResolvedValue(...)`).
 */
export type MakeIOOptions = {
  /** what promptConfirm resolves to. */
  confirm?: boolean;
  /** what promptText resolves to. */
  text?: string;
  /** what promptLocale resolves to. */
  locale?: string;
  /** what promptLocaleList resolves to. */
  localeList?: string[];
};

/**
 * A fake MigrateIO for tests, plus the info/warn transcripts it recorded.
 * `fatal` throws, matching its `never` return: a fake that returns lets engine
 * code run on past a fatal and the suite pins that as correct (round-10 A10).
 */
function buildIO(options: MakeIOOptions = {}) {
  const info: string[] = [];
  const warn: string[] = [];
  const { confirm = true, text = '', locale = '', localeList = [] } = options;
  const io = {
    info: vi.fn((message: string) => void info.push(message)),
    warn: vi.fn((message: string) => void warn.push(message)),
    error: vi.fn(),
    fatal: vi.fn((message: string): never => {
      throw new Error(message);
    }),
    guardGit: vi.fn(),
    promptConfirm: vi.fn(async () => confirm),
    promptText: vi.fn(async () => text),
    promptLocale: vi.fn(async () => locale),
    promptLocaleList: vi.fn(async () => localeList),
  } satisfies MigrateIO;
  return { io, info, warn };
}

/** The fake io plus the info/warn lines it captured. */
export type CapturedIO = ReturnType<typeof buildIO>;

/** The fake io on its own, with every member still a vitest mock. */
export type MockIO = CapturedIO['io'];

/** A fake MigrateIO. Use makeCapturedIO when the test reads the transcripts. */
export function makeIO(options: MakeIOOptions = {}): MockIO {
  return buildIO(options).io;
}

/** The same fake, handed back with its info/warn transcript arrays. */
export const makeCapturedIO = buildIO;
