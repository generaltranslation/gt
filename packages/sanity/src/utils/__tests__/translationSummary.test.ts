import { describe, expect, it } from 'vitest';
import { summarizeTranslations } from '../translationSummary';

describe('summarizeTranslations', () => {
  it('reports translations that exist only as drafts', () => {
    // The case a support request looks like: every translation was imported,
    // none was published, so anything reading the published perspective shows
    // an empty list.
    expect(
      summarizeTranslations({
        documentCount: 2,
        targetLocaleCount: 3,
        translatedIds: ['a-es', 'a-fr', 'a-ja', 'b-es', 'b-fr', 'b-ja'],
        publishedIds: [],
        draftIds: [
          'drafts.a-es',
          'drafts.a-fr',
          'drafts.a-ja',
          'drafts.b-es',
          'drafts.b-fr',
          'drafts.b-ja',
        ],
      })
    ).toEqual({
      documentsChecked: 2,
      expected: 6,
      found: 6,
      draftOnly: 6,
      published: 0,
      missing: 0,
    });
  });

  it('counts a translation with a published version as published', () => {
    const summary = summarizeTranslations({
      documentCount: 1,
      targetLocaleCount: 2,
      translatedIds: ['a-es', 'a-fr'],
      publishedIds: ['a-es'],
      // A published document usually also has a draft; it is not draft-only.
      draftIds: ['drafts.a-es', 'drafts.a-fr'],
    });

    expect(summary.published).toBe(1);
    expect(summary.draftOnly).toBe(1);
  });

  it('reports translations that were never created', () => {
    const summary = summarizeTranslations({
      documentCount: 2,
      targetLocaleCount: 3,
      translatedIds: ['a-es'],
      publishedIds: [],
      draftIds: ['drafts.a-es'],
    });

    expect(summary.found).toBe(1);
    expect(summary.missing).toBe(5);
  });

  it('does not count a translation twice when metadata repeats a locale', () => {
    // Older versions could write duplicate locale entries when bulk imports
    // raced, which would otherwise inflate the counts.
    const summary = summarizeTranslations({
      documentCount: 1,
      targetLocaleCount: 1,
      translatedIds: ['a-es', 'a-es'],
      publishedIds: [],
      draftIds: ['drafts.a-es'],
    });

    expect(summary.found).toBe(1);
    expect(summary.draftOnly).toBe(1);
    expect(summary.missing).toBe(0);
  });

  it('never reports negative missing translations', () => {
    const summary = summarizeTranslations({
      documentCount: 1,
      targetLocaleCount: 1,
      translatedIds: ['a-es', 'a-fr'],
      publishedIds: [],
      draftIds: ['drafts.a-es', 'drafts.a-fr'],
    });

    expect(summary.missing).toBe(0);
  });
});
