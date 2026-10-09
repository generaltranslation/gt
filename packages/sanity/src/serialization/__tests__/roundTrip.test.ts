import { Schema } from '@sanity/schema';
import { SanityDocument } from 'sanity';
import { describe, expect, test } from 'vitest';
import { deserializeDocument, serializeDocument } from '../../utils/serialize';
import { BaseDocumentMerger } from '../BaseDocumentMerger';

/*
 * Serialize → translate → deserialize → merge, as an import does it. With an
 * identity translator the merged document must equal the source: any
 * difference is content gt-sanity lost on its own.
 */

const schema = Schema.compile({
  name: 'roundTrip',
  types: [
    { name: 'markdown', type: 'text' },
    {
      name: 'markdownBlock',
      type: 'object',
      fields: [{ name: 'content', type: 'markdown' }],
    },
    {
      name: 'seo',
      type: 'object',
      fields: [{ name: 'description', type: 'text' }],
    },
    {
      name: 'roundTripPost',
      type: 'document',
      fields: [
        { name: 'title', type: 'string' },
        { name: 'excerpt', type: 'text' },
        { name: 'seo', type: 'seo' },
        { name: 'tags', type: 'array', of: [{ type: 'string' }] },
        { name: 'sections', type: 'array', of: [{ type: 'markdownBlock' }] },
      ],
    },
  ],
});

const sourceDocument = {
  _id: 'post-round-trip',
  _rev: 'rev-1',
  _type: 'roundTripPost',
  title: 'Shipping <i>& receiving</i> checklist',
  excerpt:
    '  Starts with spaces.\nSecond line\n\n\tTabbed line after a blank line\nEnds with spaces.  ',
  seo: {
    _type: 'seo',
    description:
      'First sentence of the summary.\nSecond sentence on its own line.',
  },
  tags: ['warehouses', 'cold storage\nand freezers', 'dry <b>goods</b>'],
  sections: [
    {
      _key: 'section-table',
      _type: 'markdownBlock',
      content:
        '| Supplier | Ships to |\n| --- | --- |\n| Northwind | Oslo, Lyon<sup>†</sup> |\n| Contoso | Porto & Turin |',
    },
    {
      _key: 'section-list',
      _type: 'markdownBlock',
      content: '- one\n- two\n- three\n\n1. first\n2. second',
    },
    {
      _key: 'section-indented',
      _type: 'markdownBlock',
      content: 'Paragraph one.\n\n    indented code\n\nTrailing newline\n',
    },
    {
      _key: 'section-inline-html',
      _type: 'markdownBlock',
      content:
        'Line one<br>Line two\n\nSee <a href="https://example.test/docs?a=1&b=2">the docs</a>.',
    },
  ],
} as unknown as SanityDocument;

const MARKER = '«fr»';

/** Prefix every non-blank text node in the body, leaving markup alone. */
const markerTranslate = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const walker = doc.createTreeWalker(
    doc.body,
    globalThis.NodeFilter.SHOW_TEXT
  );
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeValue?.trim()) {
      node.nodeValue = MARKER + node.nodeValue;
    }
  }
  return doc.documentElement.outerHTML;
};

const roundTrip = (translate: (html: string) => string) => {
  const { content } = serializeDocument(sourceDocument, schema, 'en');
  const deserialized = deserializeDocument(translate(content));
  return BaseDocumentMerger.documentLevelMerge(
    deserialized,
    sourceDocument
  ) as unknown as Record<string, unknown>;
};

const sectionContents = (doc: Record<string, unknown>) =>
  (doc.sections as Array<{ content: string }>).map(
    (section) => section.content
  );

describe('identity round trip', () => {
  const merged = roundTrip((html) => html);

  test('returns the source document', () => {
    expect(merged).toEqual(sourceDocument);
  });

  test('keeps multi-line text and markdown byte-identical', () => {
    expect(merged.excerpt).toBe(sourceDocument.excerpt);
    expect((merged.seo as { description: string }).description).toBe(
      (sourceDocument.seo as { description: string }).description
    );
    expect(sectionContents(merged)).toEqual(
      sectionContents(sourceDocument as unknown as Record<string, unknown>)
    );
  });
});

describe('marker round trip', () => {
  const merged = roundTrip(markerTranslate);

  test('translates every text value and keeps its line structure', () => {
    expect(merged.title).toBe(MARKER + sourceDocument.title);
    expect(merged.excerpt).toBe(MARKER + sourceDocument.excerpt);
    expect(merged.tags).toEqual(
      (sourceDocument.tags as string[]).map((tag) => MARKER + tag)
    );
    expect(sectionContents(merged)).toEqual(
      sectionContents(sourceDocument as unknown as Record<string, unknown>).map(
        (content) => MARKER + content
      )
    );
  });
});

describe('string elements', () => {
  const exported = new DOMParser().parseFromString(
    serializeDocument(sourceDocument, schema, 'en').content,
    'text/html'
  );

  test('use <pre> only where whitespace matters', () => {
    expect(exported.querySelector('.title')?.tagName).toBe('SPAN');
    expect(exported.querySelector('.excerpt')?.tagName).toBe('PRE');
    expect(exported.querySelector('.description')?.tagName).toBe('PRE');
    expect(
      Array.from(exported.querySelectorAll('.tags > *')).map(
        (element) => element.tagName
      )
    ).toEqual(['SPAN', 'PRE', 'SPAN']);
  });

  test('carry tag-like values as literal text inside the field element', () => {
    const title = exported.querySelector('span.title');
    expect(title?.children.length).toBe(0);
    expect(title?.textContent).toBe(sourceDocument.title);
    const sections = exported.querySelectorAll('pre.content');
    expect(sections.length).toBe((sourceDocument.sections as unknown[]).length);
    sections.forEach((section) => expect(section.children.length).toBe(0));
  });

  test('read <pre> text the same with or without the leading newline', () => {
    // GT re-serializes the HTML and drops the newline the export adds after
    // <pre>; the parser drops it on our side when it is still there
    const merged = roundTrip((html) => html.replace(/(<pre[^>]*>)\n/g, '$1'));
    expect(merged).toEqual(sourceDocument);
  });

  test('legacy <span> fields still import', () => {
    const merged = roundTrip((html) =>
      html.replace(
        /<pre class="excerpt">\n([\s\S]*?)<\/pre>/,
        '<span class="excerpt">$1</span>'
      )
    );
    expect(merged.title).toBe(sourceDocument.title);
    expect(typeof merged.excerpt).toBe('string');
  });
});
