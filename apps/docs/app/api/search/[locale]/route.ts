import { source } from '@/lib/source';
import { createSearchAPI } from 'fumadocs-core/search/server';
import type { AdvancedIndex } from 'fumadocs-core/search/server';
import type { StructuredData } from 'fumadocs-core/mdx-plugins';
import { basename } from 'path';
import { createTokenizer as createMandarinTokenizer } from '@orama/tokenizers/mandarin';
import { createTokenizer as createJapaneseTokenizer } from '@orama/tokenizers/japanese';

export const revalidate = false;

async function buildIndex(page: any): Promise<AdvancedIndex | null> {
  let structuredData: StructuredData | undefined;

  if ('structuredData' in page.data) {
    structuredData = page.data.structuredData as StructuredData;
  } else if ('load' in page.data && typeof page.data.load === 'function') {
    structuredData = (await page.data.load()).structuredData as StructuredData;
  }

  if (!structuredData) return null;

  // Shrink structured data to keep static index small
  const data = shrinkStructuredData(structuredData);

  return {
    title: page.data.title ?? basename(page.path ?? page.url ?? ''),
    description: page.data.description,
    url: page.url,
    id: page.url,
    structuredData: data,
  };
}

function shrinkStructuredData(data: StructuredData): StructuredData {
  const MAX_CONTENTS_PER_PAGE = 24;
  const MAX_CHARS = 240;

  // Always keep headings but trim very long ones
  const headings = data.headings.map((h) => ({
    id: h.id,
    content: h.content.length > MAX_CHARS ? h.content.slice(0, MAX_CHARS) : h.content,
  }));

  // Prefer the first paragraph after each heading, then fill up to cap
  const byHeading = new Map<string | undefined, string[]>();
  for (const c of data.contents) {
    const key = c.heading as string | undefined;
    const arr = byHeading.get(key) ?? [];
    if (arr.length < 1) arr.push(c.content);
    byHeading.set(key, arr);
  }

  const contents: StructuredData['contents'] = [];
  // add first content for each heading
  for (const h of headings) {
    const arr = byHeading.get(h.id);
    if (arr && arr[0]) {
      const text = arr[0].length > MAX_CHARS ? arr[0].slice(0, MAX_CHARS) : arr[0];
      contents.push({ heading: h.id, content: text });
    }
    if (contents.length >= MAX_CONTENTS_PER_PAGE) break;
  }
  // if not enough, backfill with unheaded content (e.g., lead paragraphs)
  if (contents.length < MAX_CONTENTS_PER_PAGE) {
    const root = byHeading.get(undefined) ?? [];
    for (const text of root) {
      contents.push({ heading: undefined, content: text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text });
      if (contents.length >= MAX_CONTENTS_PER_PAGE) break;
    }
  }

  return { headings, contents };
}

export async function GET(
  _request: Request,
  ctx: { params: { locale: string } },
) {
  const locale = ctx.params.locale;

  const langEntry = source.getLanguages().find((l) => l.language === locale);
  const pages = langEntry?.pages ?? [];

  // Build per-locale indexes
  const indexes = (
    await Promise.all(pages.map((p) => buildIndex(p)))
  ).filter((x): x is AdvancedIndex => x !== null);

  // Configure tokenizers for specific locales
  const components =
    locale === 'zh'
      ? { tokenizer: createMandarinTokenizer() }
      : locale === 'ja'
        ? { tokenizer: createJapaneseTokenizer() }
        : undefined;

  const server = createSearchAPI('advanced', {
    components,
    // Tighten fuzzy search for CJK
    search:
      locale === 'zh' || locale === 'ja'
        ? { threshold: 0, tolerance: 0 }
        : undefined,
    indexes,
  });

  const res = await server.staticGET();
  const data = await res.json();
  return Response.json(data, {
    headers: {
      // Client caching
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
