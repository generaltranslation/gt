import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';
import { createTokenizer } from '@orama/tokenizers/mandarin';
import { createTokenizer as createJapaneseTokenizer } from '@orama/tokenizers/japanese';

export const revalidate = false;

export const { staticGET: GET } = createFromSource(source, {
  localeMap: {
    // you can customise search configs for specific locales, like:
    // [locale]: Orama options

    zh: {
      components: {
        tokenizer: createTokenizer(),
      },
      search: {
        threshold: 0,
        tolerance: 0,
      },
    },
    ja: {
      components: {
        tokenizer: createJapaneseTokenizer(),
      },
      search: {
        threshold: 0,
        tolerance: 0,
      },
    },

    // use the English tokenizer
    'custom-locale': 'english',
  },
});
