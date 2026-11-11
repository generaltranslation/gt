// The whole site at once. Translating and saving it: every document with
// localized fields, each as its own file, in one batch. And its coverage:
// which languages hold text for each document, read from Payload alone.
import type { Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { siteCoverage } from '../coverage';
import {
  saveSiteTranslations,
  translateDocument,
  translateSite,
} from '../translation';
import type { TranslateTarget } from '../types';
import { createTestPayload } from './support/createTestPayload';
import { FakeGt } from './support/fakeGt';
import { createPage, navRows, setFooter, setHeader } from './support/fixtures';
import { link, paragraph, richText, text } from './support/lexical';

let payload: Payload;
let pageIds: (string | number)[];
let mediaId: string | number;

beforeAll(async () => {
  payload = await createTestPayload();
  pageIds = [
    (await createPage(payload)).id,
    (await createPage(payload)).id,
    (await createPage(payload)).id,
  ];
  mediaId = (
    await payload.create({
      collection: 'media',
      locale: 'en',
      data: { alt: 'A team meeting' },
    })
  ).id;
  await setHeader(payload);
  await setFooter(payload);
});

afterAll(async () => {
  await payload.destroy();
});

const readPage = (id: string | number, locale: string) =>
  payload.findByID({
    collection: 'pages',
    id,
    locale: locale as 'en',
    draft: true,
    fallbackLocale: false,
    depth: 0,
  });

const editSpanish = (id: string | number, data: Record<string, unknown>) =>
  payload.update({ collection: 'pages', id, locale: 'es', draft: true, data });

describe('translateSite', () => {
  it('sends every document as its own file and writes every translation', async () => {
    const gt = new FakeGt();
    const result = await translateSite({ payload, gt, locales: ['es'] });

    // The documents this file set up. Other tests add their own to the same
    // Payload instance, so the site as a whole has no fixed size.
    const applied = result.documents
      .filter((d) => d.result.locales.es?.status === 'applied')
      .map((d) => d.target);
    expect(applied).toEqual(
      expect.arrayContaining([
        ...pageIds.map((id) => ({ collection: 'pages', id })),
        { collection: 'media', id: mediaId },
        { global: 'header' },
        { global: 'footer' },
      ])
    );
    expect(new Set(gt.fileIds()).size).toBe(result.documents.length);
    for (const id of pageIds)
      expect((await readPage(id, 'es')).title).toBe('HOME');
    const media = await payload.findByID({
      collection: 'media',
      id: mediaId,
      locale: 'es',
      fallbackLocale: false,
      depth: 0,
    });
    expect(media.alt).toBe('A TEAM MEETING');
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
  });

  it('sends the whole site in one round of GT calls, not one per document', async () => {
    const gt = new FakeGt();
    await translateSite({ payload, gt, locales: ['es', 'fr'] });

    expect(gt.calls.uploadSourceFiles).toBe(1);
    expect(gt.calls.enqueueFiles).toBe(1);
    expect(gt.calls.awaitJobs).toBe(1);
  });

  it('keeps going when one document fails', async () => {
    const extra = await createPage(payload);
    const gt = new FakeGt();
    gt.duringTranslation = async () => {
      await payload.delete({ collection: 'pages', id: extra.id });
    };
    const result = await translateSite({ payload, gt, locales: ['es'] });

    const deleted = result.documents.find(
      (d) => 'id' in d.target && d.target.id === extra.id
    );
    expect(deleted?.result.locales.es?.status).toBe('failed');
    for (const id of pageIds)
      expect((await readPage(id, 'es')).title).toBe('HOME');
  });

  it('with saveLocalEdits, sends edits for every document in one call', async () => {
    const gt = new FakeGt();
    await translateSite({ payload, gt, locales: ['es'] });
    await payload.update({
      collection: 'pages',
      id: pageIds[0],
      locale: 'es',
      draft: true,
      data: { title: 'Página principal' },
    });
    await translateSite({ payload, gt, locales: ['es'], saveLocalEdits: true });

    expect(gt.calls.uploadTranslations).toBe(1);
    expect((await readPage(pageIds[0], 'es')).title).toBe('Página principal');
  });
});

describe('translateSite: which documents take part', () => {
  it('leaves documents with nothing to translate out of a site run', async () => {
    const media = await payload.create({
      collection: 'media',
      locale: 'en',
      data: {},
    });
    const result = await translateSite({
      payload,
      gt: new FakeGt(),
      locales: ['es'],
    });

    expect(
      result.documents.some(
        (d) =>
          'id' in d.target &&
          d.target.collection === 'media' &&
          d.target.id === media.id
      )
    ).toBe(false);
  });

  it('leaves out collections editors cannot edit, like search results', async () => {
    const result = await payload.create({
      collection: 'search',
      locale: 'en',
      data: { title: 'Pricing' },
    });
    const site = await translateSite({
      payload,
      gt: new FakeGt(),
      locales: ['es'],
    });

    expect(
      site.documents.some(
        (d) =>
          'collection' in d.target &&
          d.target.collection === 'search' &&
          d.target.id === result.id
      )
    ).toBe(false);
  });

  it('includes documents whose text is only in a referenced block', async () => {
    const story = await payload.create({
      collection: 'stories',
      locale: 'en',
      data: { layout: [{ blockType: 'quote', text: 'Well said' }] },
    });
    const site = await translateSite({
      payload,
      gt: new FakeGt(),
      locales: ['es'],
    });

    expect(
      site.documents.some(
        (d) =>
          'collection' in d.target &&
          d.target.collection === 'stories' &&
          d.target.id === story.id
      )
    ).toBe(true);
  });
});

describe('saveSiteTranslations', () => {
  it('saves every document in one translation call, uploading only sources GT lacks', async () => {
    const translated = await createPage(payload);
    await setHeader(payload);
    const gt = new FakeGt();
    await translateSite({ payload, gt, locales: ['es'] });
    await editSpanish(translated.id, { title: 'Página principal' });
    // A page whose Spanish title and SEO title were written by hand before GT.
    const handMade = await createPage(payload);
    await editSpanish(handMade.id, {
      title: 'Inicio',
      meta: { title: 'Inicio | Ejemplo' },
    });
    const uploads = gt.calls.uploadSourceFiles;

    const result = await saveSiteTranslations({ payload, gt, locales: ['es'] });

    expect(gt.calls.uploadTranslations).toBe(1);
    expect(gt.calls.uploadSourceFiles).toBe(uploads + 1);
    const statusOf = (id: string | number) =>
      result.documents.find((d) => 'id' in d.target && d.target.id === id)
        ?.result.locales.es?.status;
    expect(statusOf(translated.id)).toBe('saved');
    expect(statusOf(handMade.id)).toBe('saved');
  });
});

const LOCALES = ['es', 'fr'];

async function coverageOf(target: TranslateTarget) {
  for (let page = 1; ; page += 1) {
    const result = await siteCoverage({
      payload,
      locales: LOCALES,
      page,
      limit: 100,
    });
    const found = result.documents.find(
      (d) => JSON.stringify(d.target) === JSON.stringify(target)
    );
    if (found || page >= result.totalPages) return found;
  }
}

const pageTarget = (id: string | number): TranslateTarget => ({
  collection: 'pages',
  id,
});

describe('siteCoverage', () => {
  it('reports a language with no text as empty', async () => {
    const page = await createPage(payload);

    expect((await coverageOf(pageTarget(page.id)))?.locales).toEqual({
      es: 'empty',
      fr: 'empty',
    });
  });

  it('reports a translated language as complete', async () => {
    const page = await createPage(payload);
    await translateDocument({
      payload,
      gt: new FakeGt(),
      target: pageTarget(page.id),
      locales: ['es'],
    });

    expect((await coverageOf(pageTarget(page.id)))?.locales).toEqual({
      es: 'complete',
      fr: 'empty',
    });
  });

  it('counts edited translations as text', async () => {
    const page = await createPage(payload);
    await translateDocument({
      payload,
      gt: new FakeGt(),
      target: pageTarget(page.id),
      locales: ['es'],
    });
    await payload.update({
      collection: 'pages',
      id: page.id,
      locale: 'es',
      draft: true,
      data: { title: 'Página principal' },
    });

    expect((await coverageOf(pageTarget(page.id)))?.locales.es).toBe(
      'complete'
    );
  });

  it('reports a language missing some strings as partial', async () => {
    const page = await createPage(payload);
    await translateDocument({
      payload,
      gt: new FakeGt(),
      target: pageTarget(page.id),
      locales: ['es'],
    });
    const es = await payload.findByID({
      collection: 'pages',
      id: page.id,
      locale: 'es',
      draft: true,
      fallbackLocale: false,
      depth: 0,
    });
    await payload.update({
      collection: 'pages',
      id: page.id,
      locale: 'es',
      draft: true,
      data: { meta: { ...es.meta, description: '' } },
    });

    expect((await coverageOf(pageTarget(page.id)))?.locales.es).toBe('partial');
  });

  it('gives each document its title and its collection or global label', async () => {
    const page = await createPage(payload);

    expect(await coverageOf(pageTarget(page.id))).toMatchObject({
      title: 'Home',
      label: 'Pages',
    });
    expect(await coverageOf({ global: 'header' })).toMatchObject({
      title: 'Header',
      label: 'Header',
    });
  });

  it('lists a document with nothing to translate yet without languages', async () => {
    expect((await coverageOf({ global: 'announcement' }))?.locales).toEqual({});
  });

  it('pages through the site, each document once', async () => {
    const first = await siteCoverage({
      payload,
      locales: LOCALES,
      page: 1,
      limit: 2,
    });
    const pages = [first];
    for (let page = 2; page <= first.totalPages; page += 1)
      pages.push(
        await siteCoverage({ payload, locales: LOCALES, page, limit: 2 })
      );
    const targets = pages.flatMap((p) =>
      p.documents.map((d) => JSON.stringify(d.target))
    );

    expect(pages.every((p) => p.documents.length <= 2)).toBe(true);
    expect(new Set(targets).size).toBe(targets.length);
    expect(targets).toHaveLength(first.totalDocs);
  });

  it('reads one page of documents rather than every document on the site', async () => {
    const find = vi.spyOn(payload, 'find');
    await siteCoverage({ payload, locales: LOCALES, page: 1, limit: 2 });
    // A query for the page's own documents names them; a scan does not.
    const unbounded = find.mock.calls.filter(
      ([args]) => !args.where && (args.pagination === false || args.limit === 0)
    );
    find.mockRestore();

    expect(unbounded).toEqual([]);
  });

  it('counts a translated paragraph whose links were changed as translated', async () => {
    const page = await createPage(payload);
    await translateDocument({
      payload,
      gt: new FakeGt(),
      target: pageTarget(page.id),
      locales: ['es'],
    });
    const es = await payload.findByID({
      collection: 'pages',
      id: page.id,
      locale: 'es',
      draft: true,
      fallbackLocale: false,
      depth: 0,
    });
    await payload.update({
      collection: 'pages',
      id: page.id,
      locale: 'es',
      draft: true,
      data: {
        hero: {
          ...es.hero,
          richText: richText(
            (es.hero?.richText?.root.children[0] ?? paragraph()) as Record<
              string,
              unknown
            >,
            paragraph(
              text('Lee o visita '),
              link('https://example.org', text('otro sitio'))
            )
          ),
        },
      },
    });

    expect((await coverageOf(pageTarget(page.id)))?.locales.es).toBe(
      'complete'
    );
  });

  it('counts an emptied paragraph as missing even though the source has a link there', async () => {
    const page = await createPage(payload);
    await translateDocument({
      payload,
      gt: new FakeGt(),
      target: pageTarget(page.id),
      locales: ['es'],
    });
    const es = await payload.findByID({
      collection: 'pages',
      id: page.id,
      locale: 'es',
      draft: true,
      fallbackLocale: false,
      depth: 0,
    });
    await payload.update({
      collection: 'pages',
      id: page.id,
      locale: 'es',
      draft: true,
      data: {
        hero: {
          ...es.hero,
          richText: richText(
            (es.hero?.richText?.root.children[0] ?? paragraph()) as Record<
              string,
              unknown
            >,
            paragraph(text(''))
          ),
        },
      },
    });

    expect((await coverageOf(pageTarget(page.id)))?.locales.es).toBe('partial');
  });
});
