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
        { name: 'notes', type: 'array', of: [{ type: 'text' }] },
        { name: 'sections', type: 'array', of: [{ type: 'markdownBlock' }] },
      ],
    },
  ],
});

const sourceDocument = {
  _id: 'post-round-trip',
  _rev: 'rev-1',
  _type: 'roundTripPost',
  title: 'Shipping and receiving checklist',
  excerpt:
    '  Starts with spaces.\nSecond line\n\n\tTabbed line after a blank line\nEnds with spaces.  ',
  seo: {
    _type: 'seo',
    description:
      'First sentence of the summary.\nSecond sentence on its own line.',
  },
  tags: ['warehouses', 'cold storage\nand freezers'],
  sections: [
    {
      _key: 'section-table',
      _type: 'markdownBlock',
      content:
        '| Supplier | Ships to |\n| --- | --- |\n| Northwind | Oslo, Lyon |\n| Contoso | Porto & Turin |',
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

const roundTrip = (
  translate: (html: string) => string,
  source: SanityDocument = sourceDocument
) => {
  const { content } = serializeDocument(source, schema, 'en');
  const deserialized = deserializeDocument(translate(content));
  return BaseDocumentMerger.documentLevelMerge(
    deserialized,
    source
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
    ).toEqual(['SPAN', 'PRE']);
  });

  test('read <pre> text the same with or without the leading newline', () => {
    // the parser drops a newline right after <pre>, so one added by a
    // re-serializer or translator never reaches the value
    const merged = roundTrip((html) => html.replace(/(<pre[^>]*>)/g, '$1\n'));
    expect(merged).toEqual(sourceDocument);
  });

  test('keep tabs between words', () => {
    // a lone tab is collapsed to a space in a <span>
    const document = {
      ...sourceDocument,
      tags: ['Name\tDescription'],
    } as unknown as SanityDocument;
    const { content } = serializeDocument(document, schema, 'en');
    expect(content).toContain('<pre data-gt-string="">Name\tDescription</pre>');
    expect(roundTrip((html) => html, document).tags).toEqual([
      'Name\tDescription',
    ]);
  });

  test('legacy <span> fields still import', () => {
    const merged = roundTrip((html) => {
      const legacy = html.replace(
        /<pre class="excerpt"[^>]*>([\s\S]*?)<\/pre>/,
        '<span class="excerpt">$1</span>'
      );
      expect(legacy).toContain('<span class="excerpt">');
      return legacy;
    });
    expect(merged.title).toBe(sourceDocument.title);
    // a <span> is read as HTML, so its whitespace collapses
    expect(merged.excerpt).toBe(
      'Starts with spaces. Second line Tabbed line after a blank line Ends with spaces.'
    );
  });
});

describe('multi-line field types', () => {
  // one-line values of `text` fields: a translation may still add lines
  const document = {
    ...sourceDocument,
    excerpt: 'One-line summary.',
    sections: [
      {
        _key: 'section-one-line',
        _type: 'markdownBlock',
        content: 'One line.',
      },
    ],
    notes: ['A one-line note.'],
  } as unknown as SanityDocument;
  const exported = new DOMParser().parseFromString(
    serializeDocument(document, schema, 'en').content,
    'text/html'
  );

  test('export text fields as <pre> even when one line', () => {
    expect(exported.querySelector('.excerpt')?.tagName).toBe('PRE');
    expect(exported.querySelector('.content')?.tagName).toBe('PRE');
    expect(exported.querySelector('.notes > *')?.tagName).toBe('PRE');
    expect(exported.querySelector('.title')?.tagName).toBe('SPAN');
  });

  test('keep lines a translation adds', () => {
    const merged = roundTrip(
      (html) =>
        html
          .replace('One-line summary.', 'First line.\nSecond line.')
          .replace('One line.', '# Heading\n\nBody.')
          .replace('A one-line note.', 'Note,\ncontinued.'),
      document
    );
    expect(merged.excerpt).toBe('First line.\nSecond line.');
    expect(sectionContents(merged)).toEqual(['# Heading\n\nBody.']);
    expect(merged.notes).toEqual(['Note,\ncontinued.']);
  });
});

describe('leading newlines', () => {
  const values = ['\n', '\nx', '\n\nx', 'x\n', '\nline one\nline two'];
  const document = {
    ...sourceDocument,
    excerpt: '\n\n  Indented after two blank lines',
    tags: values,
  } as unknown as SanityDocument;

  // Each HTML parse drops one newline right after <pre>; GT parses the file
  // again before formatting it
  const translators: Record<string, (html: string) => string> = {
    identity: (html) => html,
    're-parsed': (html) =>
      new DOMParser().parseFromString(html, 'text/html').documentElement
        .outerHTML,
    'newline added after <pre>': (html) =>
      html.replace(/(<pre[^>]*>)/g, '$1\n\n'),
  };

  test.each(Object.entries(translators))(
    'round-trip byte-identically: %s',
    (_, translate) => {
      const merged = roundTrip(translate, document);
      expect(merged.tags).toEqual(values);
      expect(merged.excerpt).toBe(document.excerpt);
    }
  );

  test('stay before the translated text', () => {
    const merged = roundTrip(markerTranslate, document);
    expect(merged.tags).toEqual(
      values.map((value) => value.replace(/^(\n*)(?=[^\n])/, `$1${MARKER}`))
    );
    expect(merged.excerpt).toBe(
      `\n\n${MARKER}  Indented after two blank lines`
    );
  });
});
