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
    { name: 'noteList', type: 'array', of: [{ type: 'text' }] },
    { name: 'reviewNotes', type: 'noteList' },
    {
      name: 'product',
      type: 'document',
      fields: [{ name: 'name', type: 'string' }],
    },
    {
      name: 'productReference',
      type: 'reference',
      to: [{ type: 'product' }],
    },
    {
      name: 'statValue',
      type: 'object',
      fields: [
        { name: 'value', type: 'number' },
        { name: 'unit', type: 'string' },
      ],
    },
    {
      name: 'markdownBlock',
      type: 'object',
      fields: [{ name: 'content', type: 'markdown' }],
    },
    {
      name: 'seo',
      type: 'object',
      fields: [
        { name: 'description', type: 'text' },
        { name: 'reviewNotes', type: 'reviewNotes' },
      ],
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
        { name: 'checklist', type: 'noteList' },
        { name: 'sections', type: 'array', of: [{ type: 'markdownBlock' }] },
        {
          name: 'body',
          type: 'array',
          of: [
            {
              type: 'block',
              of: [{ type: 'productReference' }, { type: 'statValue' }],
            },
          ],
        },
      ],
    },
  ],
});

let spanCount = 0;
const span = (text: string, marks: string[] = []) => ({
  _key: `span-${spanCount++}`,
  _type: 'span',
  marks,
  text,
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

type Block = { _key?: string; children: Array<Record<string, unknown>> };
const blockText = (block: Block) =>
  block.children.map((child) => child.text ?? '').join('');

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
    // named array types, directly and through an alias in a nested object
    checklist: ['One checklist item.'],
    seo: {
      ...(sourceDocument.seo as Record<string, unknown>),
      reviewNotes: ['One review note.'],
    },
  } as unknown as SanityDocument;
  const exported = new DOMParser().parseFromString(
    serializeDocument(document, schema, 'en').content,
    'text/html'
  );

  test('export text fields as <pre> even when one line', () => {
    expect(exported.querySelector('.excerpt')?.tagName).toBe('PRE');
    expect(exported.querySelector('.content')?.tagName).toBe('PRE');
    expect(exported.querySelector('.notes > *')?.tagName).toBe('PRE');
    expect(exported.querySelector('.checklist > *')?.tagName).toBe('PRE');
    expect(exported.querySelector('.reviewNotes > *')?.tagName).toBe('PRE');
    expect(exported.querySelector('.title')?.tagName).toBe('SPAN');
  });

  test('keep lines a translation adds', () => {
    const merged = roundTrip(
      (html) =>
        html
          .replace('One-line summary.', 'First line.\nSecond line.')
          .replace('One line.', '# Heading\n\nBody.')
          .replace('A one-line note.', 'Note,\ncontinued.')
          .replace('One checklist item.', 'Item,\ncontinued.')
          .replace('One review note.', 'Review,\ncontinued.'),
      document
    );
    expect(merged.excerpt).toBe('First line.\nSecond line.');
    expect(sectionContents(merged)).toEqual(['# Heading\n\nBody.']);
    expect(merged.notes).toEqual(['Note,\ncontinued.']);
    expect(merged.checklist).toEqual(['Item,\ncontinued.']);
    expect((merged.seo as { reviewNotes: string[] }).reviewNotes).toEqual([
      'Review,\ncontinued.',
    ]);
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

describe('inline objects', () => {
  const body = [
    {
      _key: 'block-paragraph',
      _type: 'block',
      style: 'normal',
      markDefs: [],
      children: [
        span('Every plan includes '),
        {
          _key: 'inline-ref',
          _type: 'productReference',
          _ref: 'product-seats',
        },
        span(' seats per team, and '),
        { _key: 'inline-stat', _type: 'statValue', value: 42, unit: '%' },
        span(' of teams add more.'),
      ],
    },
    {
      _key: 'block-list-item',
      _type: 'block',
      style: 'normal',
      listItem: 'bullet',
      level: 1,
      markDefs: [],
      children: [
        span('Median latency dropped by '),
        { _key: 'inline-stat-2', _type: 'statValue', value: 18, unit: 'ms' },
        span(' after the change.'),
      ],
    },
    {
      _key: 'block-heading',
      _type: 'block',
      style: 'h2',
      markDefs: [],
      children: [span('What comes next')],
    },
  ];
  const withBody = (blocks: unknown[]) =>
    ({ ...sourceDocument, body: blocks }) as unknown as SanityDocument;

  test('keep the text after them in the same block', () => {
    const merged = roundTrip((html) => html, withBody(body));
    const mergedBody = merged.body as Block[];
    expect(mergedBody.map((block) => block._key)).toEqual(
      body.map((block) => block._key)
    );
    mergedBody.forEach((block, index) => {
      const sourceSpans = body[index].children.filter(
        (child) => child._type === 'span'
      ) as Array<{ text: string }>;
      expect(blockText(block)).toContain(
        sourceSpans[sourceSpans.length - 1].text.trim()
      );
    });
  });

  test('keep a following link and its text in the same block', () => {
    const paragraph = {
      _key: 'block-link',
      _type: 'block',
      style: 'normal',
      markDefs: [
        { _key: 'link-1', _type: 'link', href: 'https://example.test/pricing' },
      ],
      children: [
        span('A '),
        { _key: 'inline-ref-2', _type: 'productReference', _ref: 'product-a' },
        span(' B '),
        span('pricing page', ['link-1']),
        span(' C'),
      ],
    };
    const merged = roundTrip((html) => html, withBody([paragraph]));
    const [block] = merged.body as Array<
      Block & { markDefs: Array<{ _key: string; href: string }> }
    >;
    expect(merged.body).toHaveLength(1);
    expect(blockText(block)).toMatch(/^A\s+B pricing page C$/);
    const linkSpan = block.children.find(
      (child) => child.text === 'pricing page'
    ) as { marks: string[] };
    const linkDef = block.markDefs.find(
      (markDef) => markDef._key === linkSpan.marks[0]
    );
    expect(linkDef?.href).toBe('https://example.test/pricing');
  });
});

describe('null array entries', () => {
  // saved documents can hold null entries; they are skipped, not exported
  const document = {
    ...sourceDocument,
    tags: ['warehouses', null],
    sections: [...(sourceDocument.sections as unknown[]), null],
    seo: {
      ...(sourceDocument.seo as Record<string, unknown>),
      reviewNotes: [null, 'Check the page title.'],
    },
  } as unknown as SanityDocument;

  test('do not stop the rest of the document from being translated', () => {
    const merged = roundTrip(markerTranslate, document);
    expect(merged.title).toBe(MARKER + sourceDocument.title);
    expect(merged.tags).toContain(`${MARKER}warehouses`);
    expect(
      sectionContents({
        sections: (merged.sections as unknown[]).filter(Boolean),
      })
    ).toEqual(
      sectionContents(sourceDocument as unknown as Record<string, unknown>).map(
        (content) => MARKER + content
      )
    );
    expect((merged.seo as { reviewNotes: unknown[] }).reviewNotes).toContain(
      `${MARKER}Check the page title.`
    );
  });
});
