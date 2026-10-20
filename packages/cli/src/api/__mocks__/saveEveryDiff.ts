import { vi } from 'vitest';
import type { ApiClient } from '../../utils/api.js';

/** Answers like the API: one saved result per diff, in request order. */
export function saveEveryDiff(
  overwriteTranslations: ApiClient['overwriteTranslations']
) {
  vi.mocked(overwriteTranslations).mockImplementation(async (diffs) => ({
    summary: { total: diffs.length, succeeded: diffs.length, failed: 0 },
    results: diffs.map(({ branchId, fileId, versionId, locale }) => ({
      branchId: branchId ?? '',
      fileId,
      versionId,
      locale,
      status: 'succeeded' as const,
    })),
  }));
}
