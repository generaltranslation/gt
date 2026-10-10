// Which languages hold text for each document, read from Payload alone: every
// string, some of them, or none.
import type { Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { siteCoverage } from '../coverage';
import { translateDocument } from '../translation';
import type { TranslateTarget } from '../types';
import { createTestPayload } from './support/createTestPayload';
import { FakeGt } from './support/fakeGt';
import { createPage, setHeader } from './support/fixtures';

let payload: Payload;

beforeAll(async () => {
  payload = await createTestPayload();
  await setHeader(payload);
});

afterAll(async () => {
  await payload.destroy();
});

const LOCALES = ['es', 'fr'];

async function coverageOf(target: TranslateTarget) {
  const { documents } = await siteCoverage({
    payload,
    locales: LOCALES,
    limit: 100,
  });
  return documents.find(
    (d) => JSON.stringify(d.target) === JSON.stringify(target)
  );
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
    expect((await coverageOf({ global: 'footer' }))?.locales).toEqual({});
  });

  it('pages through the site', async () => {
    const first = await siteCoverage({
      payload,
      locales: LOCALES,
      page: 1,
      limit: 2,
    });
    const second = await siteCoverage({
      payload,
      locales: LOCALES,
      page: 2,
      limit: 2,
    });

    expect(first.documents).toHaveLength(2);
    expect(second.documents).toHaveLength(2);
    expect(first.totalPages).toBe(Math.ceil(first.totalDocs / 2));
    expect(second.documents[0].target).not.toEqual(first.documents[0].target);
  });
});
