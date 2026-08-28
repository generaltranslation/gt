import { describe, expect, it } from 'vitest';

import { summarizeLocales } from '../outcome';

describe('summarizeLocales', () => {
  it('separates clean locales from ones with failures or partials', () => {
    const { clean, trouble } = summarizeLocales({
      es: { failed: [], partial: [], translated: ['title', 'content'] },
      fr: {
        failed: [],
        partial: [{ field: 'content', missingTextNodes: 2 }],
        translated: ['content'],
      },
      ja: {
        failed: [{ error: 'rate limited (429)', field: 'title' }],
        partial: [],
        translated: [],
      },
    });
    expect(clean).toEqual(['es']);
    expect(trouble).toEqual([
      { detail: 'content: 2 text nodes untranslated', locale: 'fr' },
      { detail: 'title: rate limited (429)', locale: 'ja' },
    ]);
  });

  it('treats a locale with nothing translated and no errors as trouble', () => {
    const { clean, trouble } = summarizeLocales({
      es: { failed: [], partial: [], translated: [] },
    });
    expect(clean).toEqual([]);
    expect(trouble).toEqual([{ detail: 'nothing translated', locale: 'es' }]);
  });
});
