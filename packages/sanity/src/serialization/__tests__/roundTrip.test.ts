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
              marks: {
                annotations: [
                  {
                    name: 'link',
                    type: 'object',
                    fields: [
                      { name: 'href', type: 'url' },
                      { name: 'openInNewTab', type: 'boolean' },
                    ],
                  },
                  {
                    name: 'glossaryTerm',
                    type: 'object',
                    fields: [{ name: 'termId', type: 'string' }],
                  },
                ],
              },
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
  body: [
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
      markDefs: [
        {
          _key: 'link-report',
          _type: 'link',
          href: 'https://example.test/report?q=1&r=2',
          openInNewTab: true,
        },
        { _key: 'term-latency', _type: 'glossaryTerm', termId: 'latency' },
      ],
      children: [
        span('Median '),
        span('latency', ['term-latency']),
        span(' dropped by '),
        { _key: 'inline-stat-2', _type: 'statValue', value: 18, unit: 'ms' },
        span(' after the change, per the '),
        span('quarterly report', ['link-report', 'strong']),
        span('. See the '),
        span('report', ['link-report']),
        span(' for details.'),
      ],
    },
    {
      _key: 'block-heading',
      _type: 'block',
      style: 'h2',
      markDefs: [],
      children: [span('What comes next')],
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

/**
 * Span `_key`s are regenerated by block-tools on import and are the only
 * values not preserved; block and inline object keys must be.
 */
const withoutSpanKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(withoutSpanKeys);
  if (typeof value !== 'object' || value === null) return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(record)
      .filter(([key]) => !(record._type === 'span' && key === '_key'))
      .map(([key, entry]) => [key, withoutSpanKeys(entry)])
  );
};

type Block = { children: Array<Record<string, unknown>> };
const blockText = (block: Block) =>
  block.children.map((child) => child.text ?? '').join('');
const inlineObjects = (block: Block) =>
  block.children.filter((child) => child._type !== 'span');

const sectionContents = (doc: Record<string, unknown>) =>
  (doc.sections as Array<{ content: string }>).map(
    (section) => section.content
  );

describe('identity round trip', () => {
  const merged = roundTrip((html) => html);

  test('returns the source document', () => {
    expect(withoutSpanKeys(merged)).toEqual(withoutSpanKeys(sourceDocument));
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
    expect(withoutSpanKeys(merged)).toEqual(withoutSpanKeys(sourceDocument));
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
  const sourceBody = sourceDocument.body as Block[];

  test('keep the text after them in the same block', () => {
    const body = roundTrip((html) => html).body as Block[];
    expect(body).toHaveLength(sourceBody.length);
    body.forEach((block, index) => {
      expect(blockText(block)).toBe(blockText(sourceBody[index]));
    });
  });

  test('come back unchanged in place while the text is translated', () => {
    const body = roundTrip(markerTranslate).body as Block[];
    body.forEach((block, index) => {
      expect(inlineObjects(block)).toEqual(inlineObjects(sourceBody[index]));
      expect(
        block.children.map((child) => child._type),
        'child order'
      ).toEqual(sourceBody[index].children.map((child) => child._type));
    });
    expect(blockText(body[0])).toBe(
      `${MARKER}Every plan includes ${MARKER} seats per team, and ${MARKER} of teams add more.`
    );
  });

  test('keep the spaces around them when HTML whitespace is collapsed', () => {
    // HTML formatters such as GT's rehype-format treat the spaces on both
    // sides of an empty element as adjacent and keep only the first
    const collapseAroundEmptyElements = (html: string) =>
      html.replace(/(\s<span[^>]*><\/span>)\s+/g, '$1');
    const body = roundTrip(collapseAroundEmptyElements).body as Block[];
    body.forEach((block, index) => {
      expect(blockText(block)).toBe(blockText(sourceBody[index]));
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
    const merged = roundTrip((html) => html, {
      ...sourceDocument,
      body: [paragraph],
    } as unknown as SanityDocument);
    const [block] = merged.body as Array<
      Block & { markDefs: Array<{ _key: string; href: string }> }
    >;
    expect(blockText(block)).toBe('A  B pricing page C');
    expect(inlineObjects(block)).toEqual([paragraph.children[1]]);
    expect(withoutSpanKeys(block)).toEqual(withoutSpanKeys(paragraph));
  });
});

describe('annotations', () => {
  const sourceListItem = (
    sourceDocument.body as Array<Record<string, unknown>>
  )[1];

  test('keep every markDef field and key, and the marks that use them', () => {
    const listItem = (
      roundTrip((html) => html).body as Array<Record<string, unknown>>
    )[1];
    expect(listItem.markDefs).toEqual(sourceListItem.markDefs);
    expect(withoutSpanKeys(listItem.children)).toEqual(
      withoutSpanKeys(sourceListItem.children)
    );
  });

  test('stay unchanged while the annotated text is translated', () => {
    const listItem = (
      roundTrip(markerTranslate).body as Array<Record<string, unknown>>
    )[1] as Block & { markDefs: unknown };
    expect(listItem.markDefs).toEqual(sourceListItem.markDefs);
    expect(
      listItem.children.find((child) => child.text === `${MARKER}latency`)
        ?.marks
    ).toEqual(['term-latency']);
  });
});

describe('whitespace-only marks', () => {
  const paragraph = (key: string, children: unknown[]) => ({
    _key: key,
    _type: 'block',
    style: 'normal',
    markDefs: [
      { _key: 'link-space', _type: 'link', href: 'https://example.test' },
    ],
    children,
  });
  const body = [
    paragraph('block-strong-space', [
      span('Note:'),
      span(' ', ['strong']),
      span('The rest is unchanged.'),
    ]),
    paragraph('block-dash', [
      span('March '),
      span('–'),
      span(' ', ['strong']),
      span('the launch'),
    ]),
    paragraph('block-link-space', [
      span('a'),
      span(' ', ['link-space']),
      span('b'),
    ]),
    paragraph('block-nested-strong-space', [
      span('Note:', ['strong', 'em']),
      span(' ', ['strong']),
      span('The rest.', ['em']),
    ]),
    paragraph('block-nested-link-space', [
      span('into '),
      span('the city', ['link-space', 'strong']),
      span(' ', ['link-space']),
      span('and back'),
    ]),
  ];
  const document = { ...sourceDocument, body } as unknown as SanityDocument;
  const texts = (doc: Record<string, unknown>) =>
    (doc.body as Block[]).map(blockText);

  test('keep the space between the words around them', () => {
    expect(texts(roundTrip((html) => html, document))).toEqual([
      'Note: The rest is unchanged.',
      'March – the launch',
      'a b',
      'Note: The rest.',
      'into the city and back',
    ]);
  });

  test('keep the space while the words are translated', () => {
    expect(texts(roundTrip(markerTranslate, document))).toEqual([
      `${MARKER}Note: ${MARKER}The rest is unchanged.`,
      `${MARKER}March – ${MARKER}the launch`,
      `${MARKER}a ${MARKER}b`,
      `${MARKER}Note: ${MARKER}The rest.`,
      `${MARKER}into ${MARKER}the city ${MARKER}and back`,
    ]);
  });
});

describe('decorators', () => {
  const paragraph = {
    _key: 'block-decorators',
    _type: 'block',
    style: 'normal',
    markDefs: [
      { _key: 'link-terms', _type: 'link', href: 'https://example.test/terms' },
    ],
    children: [
      span('Plans start at $9'),
      span('*', ['sup']),
      span(' and cut CO'),
      span('2', ['sub']),
      span(' by '),
      span('half', ['underline']),
      span(', see the '),
      span('terms', ['link-terms', 'underline']),
      span('. '),
      span('Old price', ['strike-through']),
      span(', '),
      span('npm i', ['code']),
      span(', '),
      span('new', ['highlight']),
      span('. '),
      span('First line\nsecond line', ['em']),
      span(' and '),
      span('x\ny', ['strong', 'sup']),
    ],
  };
  const document = {
    ...sourceDocument,
    body: [paragraph],
  } as unknown as SanityDocument;

  /** Text runs with their set of marks, independent of span boundaries. */
  const markedRuns = (block: Block) =>
    block.children.reduce<Array<[string, string]>>((runs, child) => {
      const marks = [...((child.marks as string[]) ?? [])].sort().join('+');
      const last = runs[runs.length - 1];
      if (last && last[1] === marks) last[0] += child.text as string;
      else runs.push([child.text as string, marks]);
      return runs;
    }, []);

  test('keep every decorator on its text', () => {
    const [block] = roundTrip((html) => html, document).body as Block[];
    expect(markedRuns(block)).toEqual(markedRuns(paragraph as Block));
  });

  test('stay on their text while it is translated', () => {
    const [block] = roundTrip(markerTranslate, document).body as Block[];
    const runs = markedRuns(block);
    expect(runs).toContainEqual([`${MARKER}*`, 'sup']);
    expect(runs).toContainEqual([`${MARKER}2`, 'sub']);
    expect(runs).toContainEqual([`${MARKER}terms`, 'link-terms+underline']);
    expect(runs).toContainEqual([`${MARKER}new`, 'highlight']);
    expect(runs).toContainEqual([
      `${MARKER}First line\n${MARKER}second line`,
      'em',
    ]);
  });

  test('export standard decorators as their own elements', () => {
    const { content } = serializeDocument(document, schema, 'en');
    const exported = new DOMParser().parseFromString(content, 'text/html');
    expect(exported.querySelector('sup')?.textContent).toBe('*');
    expect(exported.querySelector('sub')?.textContent).toBe('2');
    expect(exported.querySelector('a > u')?.textContent).toBe('terms');
    expect(
      exported.querySelector('[data-gt-decorator="highlight"]')?.textContent
    ).toBe('new');
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
