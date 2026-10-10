// Which languages hold text for each document, read from Payload alone: every
// string, some of them, or none.
import type { Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { siteCoverage } from '../coverage';
import { translateDocument } from '../translation';
import type { TranslateTarget } from '../types';
import { createTestPayload } from './support/createTestPayload';
import { FakeGt } from './support/fakeGt';
import { createPage, setHeader } from './support/fixtures';
import { link, paragraph, richText, text } from './support/lexical';

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
    expect((await coverageOf({ global: 'footer' }))?.locales).toEqual({});
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
});
