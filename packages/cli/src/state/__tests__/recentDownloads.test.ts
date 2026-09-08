import { afterEach, describe, expect, it } from 'vitest';
import {
  clearDownloaded,
  getDownloadedMeta,
  getNeedsPostprocessing,
  recordDownloaded,
  type DownloadMeta,
} from '../recentDownloads.js';

const IN_PLACE_FILE = 'docs.json';

const meta = (locale: string): DownloadMeta => ({
  branchId: 'branch-1',
  fileId: 'file-1',
  versionId: 'version-1',
  locale,
  fileFormat: 'JSON',
});

describe('recordDownloaded', () => {
  afterEach(() => {
    clearDownloaded();
  });

  it('keeps one entry per path and locale, so an in-place file keeps every locale written into it', () => {
    recordDownloaded(IN_PLACE_FILE, meta('de'));
    recordDownloaded(IN_PLACE_FILE, meta('fr'));
    // A locale downloaded twice in one run is still one entry
    recordDownloaded(IN_PLACE_FILE, meta('de'));

    expect(getNeedsPostprocessing()).toEqual(new Set([IN_PLACE_FILE]));
    const locales = getDownloadedMeta()
      .get(IN_PLACE_FILE)
      ?.map((entry) => entry.locale)
      .sort();
    expect(locales).toEqual(['de', 'fr']);
  });

  it('records a path without metadata as needing postprocessing only', () => {
    recordDownloaded('docs/fr/guide.md');

    expect(getNeedsPostprocessing()).toEqual(new Set(['docs/fr/guide.md']));
    expect(getDownloadedMeta().has('docs/fr/guide.md')).toBe(false);
  });
});
