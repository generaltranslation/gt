// Translating the whole site: every document with localized fields, each as
// its own file, in one batch.
import type { Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { translateSite } from '../translation';
import { createTestPayload } from './support/createTestPayload';
import { FakeGt } from './support/fakeGt';
import { createPage, navRows, setFooter, setHeader } from './support/fixtures';

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

describe('translateSite', () => {
  it('sends every document as its own file and writes every translation', async () => {
    const gt = new FakeGt();
    const result = await translateSite({ payload, gt, locales: ['es'] });

    // Three pages, one media document, the header and the footer.
    expect(gt.fileIds()).toHaveLength(6);
    expect(result.documents).toHaveLength(6);
    expect(
      result.documents.every((d) => d.result.locales.es?.status === 'applied')
    ).toBe(true);
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
    expect(gt.calls.translateFiles).toBe(1);
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

  it('fails only the document whose source GT did not save', async () => {
    const extra = await createPage(payload);
    const gt = new FakeGt();
    gt.failSourceUploads.add(`pages/${extra.id}`);
    const result = await translateSite({ payload, gt, locales: ['es'] });

    const failed = result.documents.find(
      (d) => 'id' in d.target && d.target.id === extra.id
    );
    expect(failed?.result).toEqual({
      error: 'source upload failed',
      locales: {
        es: {
          status: 'failed',
          error: 'source upload failed',
        },
      },
    });
    expect((await readPage(extra.id, 'es')).title ?? null).toBeNull();
    expect(
      result.documents.filter((d) => d.result.locales.es?.status === 'applied')
    ).toHaveLength(6);
    for (const id of pageIds)
      expect((await readPage(id, 'es')).title).toBe('HOME');
    await payload.delete({ collection: 'pages', id: extra.id });
  });

  it('fails only the document whose file ID is too long for GT', async () => {
    // snippets/ plus 56 characters: 65, one over GT's limit.
    const id = 'a'.repeat(56);
    await payload.create({
      collection: 'snippets',
      locale: 'en',
      data: { id, text: 'Hello' },
    });
    const gt = new FakeGt();
    const result = await translateSite({ payload, gt, locales: ['es'] });

    const error = 'The file ID is longer than 64 characters.';
    expect(
      result.documents.find((d) => 'id' in d.target && d.target.id === id)
        ?.result
    ).toEqual({ error, locales: { es: { status: 'failed', error } } });
    expect(
      result.documents.filter((d) => d.result.locales.es?.status === 'applied')
    ).toHaveLength(6);
    for (const pageId of pageIds)
      expect((await readPage(pageId, 'es')).title).toBe('HOME');
    await payload.delete({ collection: 'snippets', id });
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
