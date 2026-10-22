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
    vi.spyOn(api, 'upsertAssets').mockRejectedValue(new ApiError(message, 403));
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    await syncFonts({} as Settings);

    const printed = String(warn.mock.calls[0][0]);
    expect(printed).toContain(message);
    expect(printed).toContain('org:assets:write');
    expect(printed).toContain('fallback fonts');
    expect(getWarnings()).toEqual([
      { category: 'failed_upload', fileName: 'Fonts', reason: message },
    ]);
  });
});
