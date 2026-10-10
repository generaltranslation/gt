// What a run leaves in Payload.
import type { Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { translateDocument } from '../translation';
import { createTestPayload } from './support/createTestPayload';
import { FakeGt } from './support/fakeGt';
import { createPage, navRows, setFooter, setHeader } from './support/fixtures';
import { paragraph, plainText, richText, shape, text } from './support/lexical';

let payload: Payload;

beforeAll(async () => {
  payload = await createTestPayload();
});

afterAll(async () => {
  await payload.destroy();
});

const read = (id: number | string, locale: string, draft = true) =>
  payload.findByID({
    collection: 'pages',
    id,
    locale: locale as 'en',
    draft,
    fallbackLocale: false,
    depth: 0,
  });

// The document's content, without what any save changes: timestamps, and the
// status, which reads `draft` once a draft version exists.
const withoutTimestamps = (doc: Record<string, unknown>) => {
  const { updatedAt: _u, publishedAt: _p, _status: _s, ...rest } = doc;
  return rest;
};

describe('translateDocument: writing translations', () => {
  it('writes the target locale and leaves the source untouched', async () => {
    const page = await createPage(payload);
    const before = await read(page.id, 'en');
    const result = await translateDocument({
      payload,
      gt: new FakeGt(),
      target: { collection: 'pages', id: page.id },
      locales: ['es'],
    });

    expect(result.locales.es).toMatchObject({ status: 'applied' });
    expect((await read(page.id, 'es')).title).toBe('HOME');
    expect(withoutTimestamps(await read(page.id, 'en'))).toEqual(
      withoutTimestamps(before)
    );
  });

  it('saves a draft where drafts are on, and publishes nothing', async () => {
    const page = await createPage(payload);
    await translateDocument({
      payload,
      gt: new FakeGt(),
      target: { collection: 'pages', id: page.id },
      locales: ['es'],
    });

    expect((await read(page.id, 'es', true)).title).toBe('HOME');
    const published = await read(page.id, 'es', false);
    expect(published.title ?? null).toBeNull();
    expect(published._status).toBe('published');
  });

  it('writes directly where drafts are off', async () => {
    await setFooter(payload);
    await translateDocument({
      payload,
      gt: new FakeGt(),
      target: { global: 'footer' },
      locales: ['es'],
    });

    const footer = await payload.findGlobal({
      slug: 'footer',
      locale: 'es',
      fallbackLocale: false,
      depth: 0,
    });
    expect(navRows(footer).map((row) => row.link?.label)).toEqual([
      'ADMIN',
      'PRIVACY',
    ]);
    expect(navRows(footer).map((row) => row.link?.url)).toEqual([
      '/admin',
      '/privacy',
    ]);
  });

  it('keeps rich text structure, formats and link targets', async () => {
    const page = await createPage(payload);
    await translateDocument({
      payload,
      gt: new FakeGt(),
      target: { collection: 'pages', id: page.id },
      locales: ['es'],
    });

    const en = await read(page.id, 'en');
    const es = await read(page.id, 'es');
    expect(shape(es.hero?.richText)).toEqual(shape(en.hero?.richText));
    expect(plainText(es.hero?.richText)).toEqual([
      'WELCOME',
      'READ THE ',
      'DOCS',
      ' OR VISIT ',
      'OUR SITE',
      '.',
    ]);
  });

  it('puts each link back with its own target when the translation reorders them', async () => {
    const page = await createPage(payload);
    const gt = new FakeGt();
    gt.swapLinksWhen = (source) => source.includes('docs');
    await translateDocument({
      payload,
      gt,
      target: { collection: 'pages', id: page.id },
      locales: ['es'],
    });

    const es = await read(page.id, 'es');
    type Inline = {
      type: string;
      fields?: { url: string };
      children?: { text: string }[];
    };
    const sentence = es.hero?.richText?.root.children[1] as
      | { children: Inline[] }
      | undefined;
    const links = (sentence?.children ?? [])
      .filter((node) => node.type === 'link')
      .map((node) => [
        node.fields?.url,
        node.children?.map((c) => c.text).join(''),
      ]);
    expect(links).toEqual([
      ['https://example.com', 'OUR SITE'],
      ['/docs', 'DOCS'],
    ]);
  });

  it('leaves the slug to Payload and the editor', async () => {
    const page = await createPage(payload);
    await payload.update({
      collection: 'pages',
      id: page.id,
      locale: 'es',
      draft: true,
      data: { slug: 'inicio', generateSlug: false },
    });
    await translateDocument({
      payload,
      gt: new FakeGt(),
      target: { collection: 'pages', id: page.id },
      locales: ['es'],
    });

    expect((await read(page.id, 'es')).slug).toBe('inicio');
  });

  it('mirrors locale-copied lists, keeping their links', async () => {
    await setHeader(payload);
    await translateDocument({
      payload,
      gt: new FakeGt(),
      target: { global: 'header' },
      locales: ['es'],
    });

    const header = await payload.findGlobal({
      slug: 'header',
      locale: 'es',
      draft: true,
      fallbackLocale: false,
      depth: 0,
    });
    expect(
      navRows(header).map((row) => [row.link?.url, row.link?.label])
    ).toEqual([
      ['/about', 'ABOUT US'],
      ['https://blog.example.com', 'BLOG'],
    ]);
  });
});

describe('translateDocument: running again', () => {
  it('saves the existing translation when GT has nothing new to translate', async () => {
    const page = await createPage(payload);
    const gt = new FakeGt();
    const target = { collection: 'pages', id: page.id };
    await translateDocument({ payload, gt, target, locales: ['es'] });
    // Someone clears the Spanish title in Payload; the English is unchanged.
    await payload.update({
      collection: 'pages',
      id: page.id,
      locale: 'es',
      draft: true,
      data: { title: '' },
    });
    const result = await translateDocument({
      payload,
      gt,
      target,
      locales: ['es'],
    });

    expect(result.locales.es).toMatchObject({ status: 'applied' });
    expect((await read(page.id, 'es')).title).toBe('HOME');
  });
});

describe('translateDocument: content that changed during translation', () => {
  it('keeps a block an editor added while GT was translating', async () => {
    const page = await createPage(payload);
    const gt = new FakeGt();
    gt.duringTranslation = async () => {
      const current = await read(page.id, 'en');
      await payload.update({
        collection: 'pages',
        id: page.id,
        locale: 'en',
        draft: true,
        data: {
          layout: [
            ...(current.layout ?? []),
            {
              blockType: 'cta',
              richText: richText(paragraph(text('Added by an editor'))),
            },
          ],
        },
      });
    };
    await translateDocument({
      payload,
      gt,
      target: { collection: 'pages', id: page.id },
      locales: ['es'],
    });

    const en = await read(page.id, 'en');
    const es = await read(page.id, 'es');
    expect(en.layout).toHaveLength(3);
    expect(es.layout).toHaveLength(3);
    const firstBlock = es.layout?.[0] as
      | { richText?: ReturnType<typeof richText> }
      | undefined;
    expect(plainText(firstBlock?.richText)).toEqual(['START NOW']);
  });

  it('does not bring back a block an editor deleted while GT was translating', async () => {
    const page = await createPage(payload);
    const gt = new FakeGt();
    gt.duringTranslation = async () => {
      const current = await read(page.id, 'en');
      await payload.update({
        collection: 'pages',
        id: page.id,
        locale: 'en',
        draft: true,
        data: { layout: current.layout?.slice(1) },
      });
    };
    const result = await translateDocument({
      payload,
      gt,
      target: { collection: 'pages', id: page.id },
      locales: ['es'],
    });

    expect((await read(page.id, 'en')).layout).toHaveLength(1);
    expect((await read(page.id, 'es')).layout).toHaveLength(1);
    expect(result.locales.es).toMatchObject({
      status: 'applied',
      skipped: expect.arrayContaining([
        expect.objectContaining({ reason: 'removed' }),
      ]),
    });
  });

  it('writes the translation of what was sent when the source changed meanwhile', async () => {
    const page = await createPage(payload);
    const gt = new FakeGt();
    gt.duringTranslation = async () => {
      await payload.update({
        collection: 'pages',
        id: page.id,
        locale: 'en',
        draft: true,
        data: { title: 'Home sweet home' },
      });
    };
    const result = await translateDocument({
      payload,
      gt,
      target: { collection: 'pages', id: page.id },
      locales: ['es'],
    });

    expect((await read(page.id, 'es')).title).toBe('HOME');
    expect((await read(page.id, 'en')).title).toBe('Home sweet home');
    expect(result.locales.es).toMatchObject({ status: 'applied', skipped: [] });
  });
});

describe('translateDocument: translations that cannot be written', () => {
  it('skips a string whose markup came back broken, and writes the rest', async () => {
    const page = await createPage(payload);
    const gt = new FakeGt();
    gt.breakMarkupWhen = (source) => source.includes('docs');
    const result = await translateDocument({
      payload,
      gt,
      target: { collection: 'pages', id: page.id },
      locales: ['es'],
    });

    // The paragraph keeps its source text, with its links, and is reported.
    const es = await read(page.id, 'es');
    expect(plainText(es.hero?.richText)).toEqual([
      'WELCOME',
      'Read the ',
      'docs',
      ' or visit ',
      'our site',
      '.',
    ]);
    expect(es.title).toBe('HOME');
    expect(result.locales.es).toMatchObject({
      status: 'applied',
      skipped: [expect.objectContaining({ reason: 'broken_markup' })],
    });
  });

  it('keeps earlier translations when a later run changes only some strings', async () => {
    const page = await createPage(payload);
    const gt = new FakeGt();
    const target = { collection: 'pages', id: page.id };
    await translateDocument({ payload, gt, target, locales: ['es'] });
    await payload.update({
      collection: 'pages',
      id: page.id,
      locale: 'en',
      draft: true,
      data: { title: 'Welcome home' },
    });
    await translateDocument({ payload, gt, target, locales: ['es'] });

    const es = await read(page.id, 'es');
    expect(es.title).toBe('WELCOME HOME');
    expect(es.meta?.description).toBe('AN EXAMPLE SITE.');
    expect(plainText(es.hero?.richText)[0]).toBe('WELCOME');
  });
});
