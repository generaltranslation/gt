// Rich text node types beyond paragraphs and headings: their text is
// translated and everything else about them is kept.
import type { Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { translateDocument } from '../translation';
import { createTestPayload } from './support/createTestPayload';
import { FakeGt } from './support/fakeGt';
import {
  lineBreak,
  paragraph,
  plainText,
  richText,
  shape,
  text,
} from './support/lexical';

type Node = Record<string, unknown>;

let payload: Payload;
let mediaId: string | number;

beforeAll(async () => {
  payload = await createTestPayload();
  mediaId = (
    await payload.create({
      collection: 'media',
      locale: 'en',
      data: { alt: 'Photo' },
    })
  ).id;
});

afterAll(async () => {
  await payload.destroy();
});

const element = (type: string, extra: Node, ...children: Node[]): Node => ({
  type,
  version: 1,
  direction: 'ltr',
  format: '',
  indent: 0,
  ...extra,
  children,
});

const cell = (value: string, headerState = 0) =>
  element(
    'tablecell',
    { headerState, colSpan: 1, rowSpan: 1, backgroundColor: null },
    paragraph(text(value))
  );

async function translateBody(...children: Node[]) {
  const article = await payload.create({
    collection: 'articles',
    locale: 'en',
    data: {
      name: 'Guide',
      legalNote: 'Terms apply',
      body: richText(...children),
    },
  });
  const result = await translateDocument({
    payload,
    gt: new FakeGt(),
    target: { collection: 'articles', id: article.id },
    locales: ['es'],
  });
  const es = await payload.findByID({
    collection: 'articles',
    id: article.id,
    locale: 'es',
    fallbackLocale: false,
    depth: 0,
  });
  return { result, body: es.body as ReturnType<typeof richText> };
}

describe('rich text node types', () => {
  it('translates table cells and keeps the table', async () => {
    const table = element(
      'table',
      { colWidths: [120, 120] },
      element('tablerow', {}, cell('Plan', 1), cell('Price', 1)),
      element('tablerow', {}, cell('Team'), cell('Ten dollars'))
    );
    const { body } = await translateBody(table);

    expect(plainText(body)).toEqual(['PLAN', 'PRICE', 'TEAM', 'TEN DOLLARS']);
    expect(shape(body)).toEqual(shape(richText(table)));
  });

  it('translates quotes and nested and checked lists and keeps them', async () => {
    const nested = element(
      'list',
      { listType: 'bullet', tag: 'ul', start: 1 },
      element('listitem', { value: 1 }, text('Inner'))
    );
    const tree = [
      element('quote', {}, text('Said well')),
      element(
        'list',
        { listType: 'bullet', tag: 'ul', start: 1 },
        element('listitem', { value: 1 }, text('Outer')),
        element('listitem', { value: 2 }, nested)
      ),
      element(
        'list',
        { listType: 'check', tag: 'ul', start: 1 },
        element('listitem', { value: 1, checked: true }, text('Done'))
      ),
    ];
    const { body } = await translateBody(...tree);

    expect(plainText(body)).toEqual(['SAID WELL', 'OUTER', 'INNER', 'DONE']);
    expect(shape(body)).toEqual(shape(richText(...tree)));
  });

  it('keeps relationships and dividers as they are', async () => {
    const relationship = {
      type: 'relationship',
      version: 2,
      format: '',
      relationTo: 'media',
      value: mediaId,
    };
    const divider = { type: 'horizontalrule', version: 1 };
    const { body } = await translateBody(
      paragraph(text('Before')),
      relationship,
      divider,
      paragraph(text('After'))
    );

    expect(body.root.children[1]).toMatchObject({
      type: 'relationship',
      relationTo: 'media',
    });
    expect(body.root.children[2]).toEqual(divider);
    expect(plainText(body)).toEqual(['BEFORE', 'AFTER']);
  });

  it('keeps autolinks, line breaks and tabs', async () => {
    const autolink = element(
      'autolink',
      { fields: { linkType: 'custom', url: 'https://example.com' } },
      text('example.com')
    );
    const tree = paragraph(
      text('Visit '),
      autolink,
      lineBreak(),
      text('Then'),
      {
        type: 'tab',
        version: 1,
        text: '\t',
        format: 0,
        detail: 2,
        mode: 'normal',
        style: '',
      },
      text('rest')
    );
    const { body } = await translateBody(tree);

    const children = (body.root.children[0] as { children: Node[] }).children;
    expect(children.map((c) => c.type)).toEqual([
      'text',
      'autolink',
      'linebreak',
      'text',
      'tab',
      'text',
    ]);
    expect(children[1]).toMatchObject({
      fields: { url: 'https://example.com' },
    });
  });

  it('gives a language a body that holds only a relationship', async () => {
    const relationship = {
      type: 'relationship',
      version: 2,
      format: '',
      relationTo: 'media',
      value: mediaId,
    };
    const { result, body } = await translateBody(relationship);

    expect(result.locales.es).toMatchObject({ status: 'applied' });
    expect(body.root.children[0]).toMatchObject({ type: 'relationship' });
  });

  it('keeps each text run its own style', async () => {
    const { body } = await translateBody(
      paragraph({ ...text('Red'), style: 'color: red' }, text(' and plain'))
    );

    const children = (body.root.children[0] as { children: Node[] }).children;
    expect(children.map((c) => [c.text, c.style])).toEqual([
      ['RED', 'color: red'],
      [' AND PLAIN', ''],
    ]);
  });
});
