// Saving what Payload holds to GT: each locale's current text becomes GT's
// translation, of the version GT has, or of the current source when GT has
// never seen the document. Nothing is translated or written to Payload.
import type { Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  saveSiteTranslations,
  saveTranslations,
  translateDocument,
  translateSite,
} from '../translation';
import { createTestPayload } from './support/createTestPayload';
import { FakeGt, readKeyedHtml } from './support/fakeGt';
import { createPage, setHeader } from './support/fixtures';

let payload: Payload;

beforeAll(async () => {
  payload = await createTestPayload();
});

afterAll(async () => {
  await payload.destroy();
});

const read = (id: string | number, locale: string) =>
  payload.findByID({
    collection: 'pages',
    id,
    locale: locale as 'en',
    draft: true,
    fallbackLocale: false,
    depth: 0,
  });

const versionCount = async (id: string | number) =>
  (
    await payload.findVersions({
      collection: 'pages',
      where: { parent: { equals: id } },
      limit: 0,
    })
  ).totalDocs;

const editSpanish = (id: string | number, data: Record<string, unknown>) =>
  payload.update({ collection: 'pages', id, locale: 'es', draft: true, data });

// A page whose Spanish title and SEO title were written by hand before GT.
async function pageWithHandMadeSpanish() {
  const page = await createPage(payload);
  await editSpanish(page.id, {
    title: 'Inicio',
    meta: { title: 'Inicio | Ejemplo' },
  });
  return page;
}

describe('saveTranslations: a document GT has translated', () => {
  it('saves the text against the version GT holds, and nothing else', async () => {
    const page = await createPage(payload);
    const gt = new FakeGt();
    const target = { collection: 'pages', id: page.id };
    await translateDocument({ payload, gt, target, locales: ['es'] });
    await editSpanish(page.id, { title: 'Página principal' });
    await payload.update({
      collection: 'pages',
      id: page.id,
      locale: 'en',
      draft: true,
      data: { title: 'Home page' },
    });
    const uploads = gt.calls.uploadSourceFiles;
    const versions = await versionCount(page.id);

    const result = await saveTranslations({
      payload,
      gt,
      target,
      locales: ['es'],
    });

    expect(result.locales.es).toEqual({ status: 'saved' });
    expect(gt.uploadedTranslations).toHaveLength(1);
    expect(gt.uploadedTranslations[0].versionId).toBe(`${gt.fileIds()[0]}@1`);
    expect([
      ...readKeyedHtml(gt.uploadedTranslations[0].content).values(),
    ]).toContain('Página principal');
    expect(gt.calls.uploadSourceFiles).toBe(uploads);
    expect(gt.calls.enqueueFiles).toBe(1);
    expect(await versionCount(page.id)).toBe(versions);
  });

  it('keeps the saved edit on the next translation', async () => {
    const page = await createPage(payload);
    const gt = new FakeGt();
    const target = { collection: 'pages', id: page.id };
    await translateDocument({ payload, gt, target, locales: ['es'] });
    await editSpanish(page.id, { title: 'Página principal' });
    await saveTranslations({ payload, gt, target, locales: ['es'] });
    await translateDocument({ payload, gt, target, locales: ['es'] });

    expect((await read(page.id, 'es')).title).toBe('Página principal');
  });
});

describe('saveTranslations: a document GT has never seen', () => {
  it('uploads the source, then the existing text as its translation', async () => {
    const page = await pageWithHandMadeSpanish();
    const gt = new FakeGt();
    const result = await saveTranslations({
      payload,
      gt,
      target: { collection: 'pages', id: page.id },
      locales: ['es'],
    });

    expect(result.locales.es).toEqual({ status: 'saved' });
    expect(gt.calls.uploadSourceFiles).toBe(1);
    expect(gt.calls.enqueueFiles).toBe(0);
    expect(gt.uploadedTranslations[0].versionId).toBe(`${gt.fileIds()[0]}@1`);
    expect([
      ...readKeyedHtml(gt.uploadedTranslations[0].content).values(),
    ]).toEqual(expect.arrayContaining(['Inicio', 'Inicio | Ejemplo']));
  });

  it('keeps the saved text on the next translation, and fills gaps once the source changes', async () => {
    const page = await pageWithHandMadeSpanish();
    const gt = new FakeGt();
    const target = { collection: 'pages', id: page.id };
    await saveTranslations({ payload, gt, target, locales: ['es'] });
    await translateDocument({ payload, gt, target, locales: ['es'] });

    // GT treats the saved text as the version's complete translation.
    let es = await read(page.id, 'es');
    expect(es.title).toBe('Inicio');
    expect(es.meta?.description ?? null).toBeNull();

    await payload.update({
      collection: 'pages',
      id: page.id,
      locale: 'en',
      draft: true,
      data: { meta: { description: 'A new description.' } },
    });
    await translateDocument({ payload, gt, target, locales: ['es'] });
    es = await read(page.id, 'es');
    expect(es.title).toBe('Inicio');
    expect(es.meta?.description).toBe('A NEW DESCRIPTION.');
  });

  it('translates it in full when translating with saveLocalEdits', async () => {
    const page = await pageWithHandMadeSpanish();
    const gt = new FakeGt();
    await translateDocument({
      payload,
      gt,
      target: { collection: 'pages', id: page.id },
      locales: ['es'],
      saveLocalEdits: true,
    });

    expect(gt.calls.uploadTranslations).toBe(0);
    const es = await read(page.id, 'es');
    expect(es.title).toBe('HOME');
    expect(es.meta?.description).toBe('AN EXAMPLE SITE.');
  });
});

describe('saveTranslations: nothing to save, and failures', () => {
  it('reports a locale with no text in Payload, and sends no translation', async () => {
    const page = await createPage(payload);
    const gt = new FakeGt();
    const result = await saveTranslations({
      payload,
      gt,
      target: { collection: 'pages', id: page.id },
      locales: ['fr'],
    });

    expect(result.locales.fr).toEqual({ status: 'no_translations' });
    expect(gt.calls.uploadTranslations).toBe(0);
  });

  it('reports GT being unreachable', async () => {
    const page = await createPage(payload);
    const gt = new FakeGt();
    gt.unreachable = true;
    const result = await saveTranslations({
      payload,
      gt,
      target: { collection: 'pages', id: page.id },
      locales: ['es'],
    });

    expect(result.error).toBeTruthy();
  });
});

describe('saveSiteTranslations', () => {
  it('saves every document in one translation call, uploading only sources GT lacks', async () => {
    const translated = await createPage(payload);
    await setHeader(payload);
    const gt = new FakeGt();
    await translateSite({ payload, gt, locales: ['es'] });
    await editSpanish(translated.id, { title: 'Página principal' });
    const handMade = await pageWithHandMadeSpanish();
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
