import { source } from '@/lib/source';
import { createSearchAPI } from 'fumadocs-core/search/server';
import type { AdvancedIndex } from 'fumadocs-core/search/server';
import type { StructuredData } from 'fumadocs-core/mdx-plugins';
import { basename } from 'path';
import { createTokenizer as createMandarinTokenizer } from '@orama/tokenizers/mandarin';
import { createTokenizer as createJapaneseTokenizer } from '@orama/tokenizers/japanese';

export const revalidate = false;

// data.title/description: what to show in results (if available)
// data.structuredData or data.load(): where we get headings + text from
// path/url: the page link we put into the results
type PageLike = {
  data: {
    title?: string;
    description?: string;
    structuredData?: StructuredData;
    load?: () => Promise<{ structuredData: StructuredData }>;
  };
  path?: string;
  url?: string;
};

// Turn one page into one search entry
async function buildIndex(page: PageLike): Promise<AdvancedIndex | null> {
  // This will hold the content we search through (headings + short text).
  let structuredData: StructuredData | undefined;

  // First choice: if the page already includes the content, use it.
  if ('structuredData' in page.data) {
    structuredData = page.data.structuredData as StructuredData;
  }
  // Otherwise: if the page can load the content on demand, ask it to do so.
  else if ('load' in page.data && typeof page.data.load === 'function') {
    structuredData = (await page.data.load()).structuredData as StructuredData;
  }

  if (!structuredData) return null;

  const data = shrinkStructuredData(structuredData);

  const url = page.url ?? page.path ?? '/';

  // title: use the page’s title, else make one from the path
  // id/url: the link to the page
  return {
    title: page.data.title ?? basename(page.path ?? page.url ?? ''),
    description: page.data.description,
    url,
    id: url,
    structuredData: data,
  };
}

function shrinkStructuredData(data: StructuredData): StructuredData {
  const MAX_CONTENTS_PER_PAGE = 24; // keep at most 24 text bits per page
  const MAX_CHARS = 240; // each heading or text bit is at most 240 chars

  // Always keep headings (they’re important), but trim very long ones.
  const headings = data.headings.map((h) => ({
    id: h.id,
    content:
      h.content.length > MAX_CHARS ? h.content.slice(0, MAX_CHARS) : h.content,
  }));

  // For body text: grab the first paragraph after each heading
  // If we still have room, we add intro paragraphs that aren’t under a heading
  const byHeading = new Map<string | undefined, string[]>();
  for (const c of data.contents) {
    const key = c.heading as string | undefined;
    const arr = byHeading.get(key) ?? [];
    // Only keep the first paragraph per heading to avoid repeats
    if (arr.length < 1) arr.push(c.content);
    byHeading.set(key, arr);
  }

  const contents: StructuredData['contents'] = [];
  // Add the first paragraph for each heading, in order
  for (const h of headings) {
    const arr = byHeading.get(h.id);
    if (arr && arr[0]) {
      const text =
        arr[0].length > MAX_CHARS ? arr[0].slice(0, MAX_CHARS) : arr[0];
      contents.push({ heading: h.id, content: text });
    }
    if (contents.length >= MAX_CONTENTS_PER_PAGE) break;
  }

  // If we still have space, add intro text that doesn’t belong to a heading
  if (contents.length < MAX_CONTENTS_PER_PAGE) {
    const root = byHeading.get(undefined) ?? [];
    for (const text of root) {
      contents.push({
        heading: undefined,
        content: text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text,
      });
      if (contents.length >= MAX_CONTENTS_PER_PAGE) break;
    }
  }

  return { headings, contents };
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ locale: string }> }
) {
  // Read the language code
  const { locale } = await ctx.params;

  // Find all docs pages for this language.
  const langEntry = source.getLanguages().find((l) => l.language === locale);
  const pages = langEntry?.pages ?? [];

  // Turn each page into a search entry
  const indexes = (await Promise.all(pages.map((p) => buildIndex(p)))).filter(
    (x): x is AdvancedIndex => x !== null
  );

  // Use tokenizer for Chinese (zh) and Japanese (ja)
  const components =
    locale === 'zh'
      ? { tokenizer: createMandarinTokenizer() }
      : locale === 'ja'
        ? { tokenizer: createJapaneseTokenizer() }
        : undefined;

  const server = createSearchAPI('advanced', {
    components,
    // Make matching stricter for zh/ja
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
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
