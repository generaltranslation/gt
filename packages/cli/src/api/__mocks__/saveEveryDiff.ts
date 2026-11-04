import { vi } from 'vitest';
import type { ProjectHandle } from 'generaltranslation';

/** Answers like the API: one saved result per diff, in request order. */
export function saveEveryDiff(
  overwriteTranslations: ProjectHandle['overwriteTranslations']
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
