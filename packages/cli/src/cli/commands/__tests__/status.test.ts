import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateStatus, handleStatus, type StatusFlags } from '../status.js';
import type { Settings } from '../../../types/index.js';
import type { LocaleStatus } from '../../../translation/status/computeStatus.js';

vi.mock('../../../console/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    message: vi.fn(),
  },
}));
vi.mock('../../../console/logging.js', () => ({
  exitSync: vi.fn((code: number) => {
    throw new Error(`exit:${code}`);
  }),
  logErrorAndExit: vi.fn((message: string) => {
    throw new Error(`fatal:${message}`);
  }),
}));
const mockCollectFiles = vi.hoisted(() =>
  vi.fn(async () => ({
    files: [],
    reactComponents: 0,
    publishMap: new Map(),
  }))
);
vi.mock('../../../formats/files/collectFiles.js', () => ({
  collectFiles: mockCollectFiles,
}));
const mockAggregateFiles = vi.hoisted(() =>
  vi.fn(async () => ({ files: [], publishMap: new Map() }))
);
vi.mock('../../../formats/files/aggregateFiles.js', () => ({
  aggregateFiles: mockAggregateFiles,
}));
vi.mock('../../../formats/files/fileMapping.js', () => ({
  createFileMapping: vi.fn(() => ({})),
}));
vi.mock('../../../fs/config/downloadedVersions.js', () => ({
  readLockfile: vi.fn(() => ({
    data: { version: 2, branchId: '', entries: [] },
    entryMap: new Map(),
    originalV1: null,
  })),
}));

const mockComputeStatus = vi.hoisted(() => vi.fn());
vi.mock('../../../translation/status/computeStatus.js', () => ({
  computeStatus: mockComputeStatus,
}));

const mockDisplayStatus = vi.hoisted(() => vi.fn());
vi.mock('../../../console/displayStatus.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  displayStatus: mockDisplayStatus,
}));

function row(overrides: Partial<LocaleStatus>): LocaleStatus {
  return {
    locale: 'es',
    total: 10,
    translated: 10,
    missing: [],
    stale: [],
    unmeasured: [],
    errors: [],
    ...overrides,
  };
}

function settings(): Settings {
  return {
    defaultLocale: 'en',
    locales: ['en', 'es', 'fr'],
    options: {},
    files: {
      resolvedPaths: {},
      placeholderPaths: {},
      transformPaths: {},
      transformFormats: {},
    },
  } as unknown as Settings;
}

async function run(flags: Partial<StatusFlags>, rows: LocaleStatus[]) {
  mockComputeStatus.mockReturnValue(rows);
  return handleStatus(flags as StatusFlags, settings(), 'base');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('evaluateStatus', () => {
  it('passes when every locale meets the threshold with no errors', () => {
    const result = evaluateStatus([row({})], 100);
    expect(result.failingLocales).toEqual([]);
    expect(result.errorCount).toBe(0);
    expect(result.ok).toBe(true);
  });

  it('fails locales below the minimum coverage', () => {
    const result = evaluateStatus(
      [row({ locale: 'es', translated: 9 }), row({ locale: 'fr' })],
      95
    );
    expect(result.failingLocales).toEqual(['es']);
    expect(result.ok).toBe(false);
  });

  it('accepts partial coverage above the threshold', () => {
    const result = evaluateStatus([row({ translated: 8 })], 80);
    expect(result.ok).toBe(true);
  });

  it('fails on any validation error even at full coverage', () => {
    const result = evaluateStatus(
      [row({ errors: [{ fileName: 'f', message: 'bad' }] })],
      100
    );
    expect(result.errorCount).toBe(1);
    expect(result.ok).toBe(false);
  });

  it('treats a zero-total locale as unmeasurable, not as covered', () => {
    // total 0 maps to 100% coverage, so without a dedicated bucket a
    // misconfigured locale would silently pass the gate
    const result = evaluateStatus(
      [row({ locale: 'es' }), row({ locale: 'fr', total: 0, translated: 0 })],
      100
    );
    expect(result.failingLocales).toEqual([]);
    expect(result.unmeasurableLocales).toEqual(['fr']);
    expect(result.ok).toBe(false);
  });
});

describe('handleStatus', () => {
  it('displays status and resolves when healthy', async () => {
    await run({}, [row({})]);
    expect(mockDisplayStatus).toHaveBeenCalledOnce();
  });

  it('does not exit on problems without --ci', async () => {
    await expect(run({}, [row({ translated: 1 })])).resolves.toBeUndefined();
  });

  it('exits non-zero in --ci mode when coverage is below the minimum', async () => {
    await expect(run({ ci: true }, [row({ translated: 9 })])).rejects.toThrow(
      'exit:1'
    );
  });

  it('exits non-zero in --ci mode on validation errors', async () => {
    await expect(
      run({ ci: true }, [row({ errors: [{ fileName: 'f', message: 'bad' }] })])
    ).rejects.toThrow('exit:1');
  });

  it('respects a custom --min-coverage threshold', async () => {
    await expect(
      run({ ci: true, minCoverage: '80' }, [row({ translated: 8 })])
    ).resolves.toBeUndefined();
  });

  it('rejects a malformed --min-coverage value', async () => {
    await expect(run({ minCoverage: 'lots' }, [row({})])).rejects.toThrow(
      /min-coverage/
    );
  });

  it('rejects empty and negative --min-coverage values', async () => {
    // Number('') is 0, which would silently disable the gate
    await expect(run({ minCoverage: '' }, [row({})])).rejects.toThrow(
      /min-coverage/
    );
    await expect(run({ minCoverage: '-5' }, [row({})])).rejects.toThrow(
      /min-coverage/
    );
  });

  it('accepts the commander string default and a zero threshold', async () => {
    await expect(
      run({ minCoverage: '100' }, [row({})])
    ).resolves.toBeUndefined();
    await expect(
      run({ ci: true, minCoverage: '0' }, [row({ translated: 0 })])
    ).resolves.toBeUndefined();
  });

  it('excludes the default locale from reported locales', async () => {
    await run({}, [row({})]);
    const input = mockComputeStatus.mock.calls[0][0];
    expect(input.locales).toEqual(['es', 'fr']);
  });

  it('fails --ci instead of claiming success when nothing was measured', async () => {
    // A broken include glob or publish-only config measures zero units;
    // that must not read as a passing 100%
    await expect(
      run({ ci: true }, [row({ total: 0, translated: 0 })])
    ).rejects.toThrow('exit:1');
    await expect(
      run({}, [row({ total: 0, translated: 0 })])
    ).resolves.toBeUndefined();
  });

  it('fails --ci when one locale is unmeasurable even if others are fine', async () => {
    await expect(
      run({ ci: true }, [
        row({ locale: 'es' }),
        row({ locale: 'fr', total: 0, translated: 0 }),
      ])
    ).rejects.toThrow('exit:1');
    await expect(
      run({}, [
        row({ locale: 'es' }),
        row({ locale: 'fr', total: 0, translated: 0 }),
      ])
    ).resolves.toBeUndefined();
  });

  it('skips the inline scan when no local gt output is configured', async () => {
    mockComputeStatus.mockReturnValue([row({})]);
    await handleStatus({} as StatusFlags, settings(), 'gt-react');
    expect(mockAggregateFiles).toHaveBeenCalledOnce();
    expect(mockCollectFiles).not.toHaveBeenCalled();
  });
});
