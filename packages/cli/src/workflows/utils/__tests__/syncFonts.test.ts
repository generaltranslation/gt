import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from 'generaltranslation/errors';
import { logger } from '../../../console/logger.js';
import {
  clearWarnings,
  getWarnings,
} from '../../../state/translateWarnings.js';
import type { Settings } from '../../../types/index.js';
import { api } from '../../../utils/api.js';
import { syncFonts } from '../syncFonts.js';

vi.mock('../../../formats/files/collectFonts.js', () => ({
  collectFonts: vi.fn(async () => [{ fileName: 'Inter.ttf' }]),
}));

describe('syncFonts', () => {
  beforeEach(() => {
    clearWarnings();
    vi.restoreAllMocks();
  });

  it('explains a denied font upload and records it in the warnings summary', async () => {
    const message = 'Target not found or access denied';
    vi.spyOn(api, 'getProject').mockResolvedValue({
      orgId: 'org-id',
    } as Awaited<ReturnType<typeof api.getProject>>);
    const upsertAssets = vi
      .spyOn(api, 'upsertAssets')
      .mockRejectedValue(new ApiError(message, 403));
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    await syncFonts({} as Settings);

    expect(upsertAssets).toHaveBeenCalledWith('org-id', [
      { fileName: 'Inter.ttf' },
    ]);
    const printed = String(warn.mock.calls[0][0]);
    expect(printed).toContain(message);
    expect(printed).toContain('org:assets:write');
    expect(printed).toContain('fallback fonts');
    expect(getWarnings()).toEqual([
      { category: 'failed_upload', fileName: 'Fonts', reason: message },
    ]);
  });

  it('skips the font request for a project API key with the denied-sync warning', async () => {
    const getProject = vi.spyOn(api, 'getProject');
    const upsertAssets = vi.spyOn(api, 'upsertAssets');
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    await syncFonts({ apiKey: 'gtx-api-project-key' } as Settings);

    expect(getProject).not.toHaveBeenCalled();
    expect(upsertAssets).not.toHaveBeenCalled();
    const printed = String(warn.mock.calls[0][0]);
    expect(printed).toContain('Font sync was denied');
    expect(printed).toContain('org:assets:write');
    expect(printed).toContain('fallback fonts');
    expect(getWarnings()).toEqual([
      {
        category: 'failed_upload',
        fileName: 'Fonts',
        reason: 'A project API key cannot upload organization fonts',
      },
    ]);
  });
});
