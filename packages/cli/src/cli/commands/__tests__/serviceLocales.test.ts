import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockSettings } from '../../../api/__mocks__/settings.js';
import { validateSettings } from '../../../config/validateSettings.js';
import { logger } from '../../../console/logger.js';
import { exitSync, logErrorAndExit } from '../../../console/logging.js';
import { collectFiles } from '../../../formats/files/collectFiles.js';
import { runDownloadWorkflow } from '../../../workflows/download.js';
import { runStageFilesWorkflow } from '../../../workflows/stage.js';
import type { Settings, TranslateFlags } from '../../../types/index.js';
import { hasValidLocales } from '../utils/validation.js';
import { handleDownload } from '../download.js';
import { handleStage } from '../stage.js';

vi.mock('../../../console/logger.js', () => ({
  logger: { error: vi.fn(), success: vi.fn() },
}));
vi.mock('../../../console/logging.js', () => ({
  exitSync: vi.fn(),
  logErrorAndExit: vi.fn(),
  logCollectedFiles: vi.fn(),
}));
vi.mock('../../../formats/files/collectFiles.js', () => ({
  collectFiles: vi.fn(),
  resolveInlineLibrary: vi.fn(),
}));
vi.mock('../../../workflows/download.js', () => ({
  runDownloadWorkflow: vi.fn(),
}));
vi.mock('../../../workflows/stage.js', () => ({
  runStageFilesWorkflow: vi.fn(),
}));
vi.mock('../../../formats/files/fileMapping.js', () => ({
  createFileMapping: vi.fn(() => ({})),
}));
vi.mock('../../../translation/reviewSetupWarning.js', () => ({
  warnManualReviewSetup: vi.fn(),
}));

function settings(overrides: Partial<Settings> = {}) {
  return createMockSettings({
    defaultLocale: 'fr',
    locales: ['en-us'],
    apiKey: 'test-key',
    projectId: 'test-project',
    ...overrides,
  });
}
const options = { dryRun: false, timeout: 1 } as TranslateFlags;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(collectFiles).mockResolvedValue({
    files: [],
    reactComponents: 0,
    publishMap: new Map(),
  });
});

describe('CLI service locale validation', () => {
  it.each([
    { locales: ['en-US'] },
    { customMapping: { 'en-us': { code: 'en-US' } } },
    {
      locales: ['brand-english'],
      customMapping: { 'brand-english': { code: 'en-US' } },
    },
    { locales: ['en-US'], customMapping: { 'en-US': 'American English' } },
  ])('accepts canonical codes and explicit aliases: %j', (overrides) => {
    expect(hasValidLocales(settings(overrides), { forApi: true })).toBe(true);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { locales: ['fr'], defaultLocale: 'en-us' },
    { customMapping: { 'en-us': 'American English' } },
    { customMapping: { 'en-us': { name: 'American English' } } },
    { customMapping: { 'en-us': { code: 'en-us' } } },
  ])('rejects noncanonical service codes: %j', (overrides) => {
    expect(hasValidLocales(settings(overrides), { forApi: true })).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('customMapping')
    );
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('en-US'));
  });

  it('keeps local configuration valid even when credentials are present', () => {
    validateSettings(settings());
    expect(logErrorAndExit).not.toHaveBeenCalled();
    expect(hasValidLocales(settings())).toBe(true);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('stops downloads before file collection or API work for unmapped lowercase codes', async () => {
    await handleDownload(options, settings(), 'gt-react');
    expect(exitSync).toHaveBeenCalledWith(1);
    expect(collectFiles).not.toHaveBeenCalled();
    expect(runDownloadWorkflow).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('en-us'));
  });

  it('allows downloads with an explicit canonical mapping', async () => {
    await handleDownload(
      options,
      settings({ customMapping: { 'en-us': { code: 'en-US' } } }),
      'gt-react'
    );
    expect(exitSync).not.toHaveBeenCalled();
    expect(runDownloadWorkflow).toHaveBeenCalledOnce();
  });

  it('allows local dry runs without a mapping', async () => {
    await handleStage(
      { ...options, dryRun: true },
      settings(),
      'gt-react',
      true
    );
    expect(exitSync).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(collectFiles).toHaveBeenCalledOnce();
    expect(runStageFilesWorkflow).not.toHaveBeenCalled();
  });
});
