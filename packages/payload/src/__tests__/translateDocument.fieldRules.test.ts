// Field settings and editor actions that change what a translation writes:
// fields editors cannot edit, emptied source text, line breaks, required
// fields left out of translation, and plugin-made copies.
import type { Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { translateDocument, translateSite } from '../translation';
import { createTestPayload } from './support/createTestPayload';
import { FakeGt, readKeyedHtml } from './support/fakeGt';
import { navRows, setHeader } from './support/fixtures';
import { paragraph, richText, text } from './support/lexical';

let payload: Payload;

beforeAll(async () => {
  payload = await createTestPayload();
});

afterAll(async () => {
  await payload.destroy();
});

const createArticle = (data: Record<string, unknown> = {}) =>
  payload.create({
    collection: 'articles',
    locale: 'en',
    data: {
      name: 'Pricing',
      summary: 'Plans for every team.',
      generated: 'Made by a hook',
      hiddenText: 'Kept out of sight',
      legalNote: 'Terms apply',
      tags: [{ label: 'Billing' }],
      body: richText(paragraph(text('Pick a plan.'))),
      ...data,
    },
  });

const read = (id: string | number, locale: string) =>
  payload.findByID({
    collection: 'articles',
    id,
    locale: locale as 'en',
    fallbackLocale: false,
    depth: 0,
  });

const updateEnglish = (id: string | number, data: Record<string, unknown>) =>
  payload.update({ collection: 'articles', id, locale: 'en', data });

const translate = (gt: FakeGt, id: string | number) =>
  translateDocument({
    payload,
    gt,
    target: { collection: 'articles', id },
    locales: ['es'],
  });

const sentValues = (gt: FakeGt) =>
  gt.uploadedSources.flatMap((file) => [
    ...readKeyedHtml(file.content).values(),
  ]);

describe('translateDocument: field rules', () => {
  it('leaves read-only and hidden fields alone', async () => {
    const article = await createArticle();
    const gt = new FakeGt();
    await translate(gt, article.id);

    expect(sentValues(gt).join(' ')).not.toMatch(
      /Made by a hook|Kept out of sight/
    );
    const es = await read(article.id, 'es');
    expect(es.generated ?? null).toBeNull();
    expect(es.hiddenText ?? null).toBeNull();
  });

  it('fills a required field it does not translate with the source value', async () => {
    const article = await createArticle();
    const result = await translate(new FakeGt(), article.id);

    expect(result.locales.es).toMatchObject({ status: 'applied' });
    const es = await read(article.id, 'es');
    expect(es.name).toBe('PRICING');
    expect(es.legalNote).toBe('Terms apply');
  });

  it('keeps a required field the language already has', async () => {
    const article = await createArticle();
    await payload.update({
      collection: 'articles',
      id: article.id,
      locale: 'es',
      data: { name: 'Precios', legalNote: 'Aplican condiciones' },
    });
    await translate(new FakeGt(), article.id);

    expect((await read(article.id, 'es')).legalNote).toBe(
      'Aplican condiciones'
    );
  });

  it('keeps line breaks in multi-line text', async () => {
    const article = await createArticle({
      summary: 'Plans for every team.\nCancel any time.',
    });
    await translate(new FakeGt(), article.id);

    expect((await read(article.id, 'es')).summary).toBe(
      'PLANS FOR EVERY TEAM.\nCANCEL ANY TIME.'
    );
  });

  it('clears text whose source was emptied', async () => {
    const article = await createArticle();
    const gt = new FakeGt();
    await translate(gt, article.id);
    expect((await read(article.id, 'es')).summary).toBe(
      'PLANS FOR EVERY TEAM.'
    );
    await updateEnglish(article.id, { summary: '' });
    await translate(gt, article.id);

    expect((await read(article.id, 'es')).summary || null).toBeNull();
  });

  it('clears a language list whose source was emptied', async () => {
    const article = await createArticle();
    const gt = new FakeGt();
    await translate(gt, article.id);
    expect((await read(article.id, 'es')).tags).toHaveLength(1);
    await updateEnglish(article.id, { tags: [] });
    await translate(gt, article.id);

    expect((await read(article.id, 'es')).tags ?? []).toEqual([]);
  });

  it('clears rich text whose source was emptied', async () => {
    const article = await createArticle();
    const gt = new FakeGt();
    await translate(gt, article.id);
    expect(JSON.stringify((await read(article.id, 'es')).body)).toContain(
      'PICK A PLAN'
    );
    await updateEnglish(article.id, { body: richText(paragraph()) });
    await translate(gt, article.id);

    const body = (await read(article.id, 'es')).body;
    expect(JSON.stringify(body ?? null)).not.toContain('PICK A PLAN');
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

  it('publishes a translated draft whose language has its own list rows', async () => {
    await setHeader(payload);
    await translateDocument({
      payload,
      gt: new FakeGt(),
      target: { global: 'header' },
      locales: ['es', 'fr'],
    });
    await payload.updateGlobal({
      slug: 'header',
      locale: 'en',
      data: { _status: 'published' },
    });

    const es = await payload.findGlobal({
      slug: 'header',
      locale: 'es',
      fallbackLocale: false,
      depth: 0,
    });
    expect(navRows(es).map((row) => row.link?.label)).toEqual([
      'ABOUT US',
      'BLOG',
    ]);
  });

  it("keeps a language's own value for an opted-out field in a localized group", async () => {
    const article = await createArticle({
      promo: { headline: 'Save more', terms: 'Terms apply' },
    });
    await payload.update({
      collection: 'articles',
      id: article.id,
      locale: 'es',
      data: {
        name: 'Precios',
        legalNote: 'Aplican',
        promo: { headline: 'Ahorra', terms: 'Aplican condiciones' },
      },
    });
    await translate(new FakeGt(), article.id);

    expect((await read(article.id, 'es')).promo).toMatchObject({
      headline: 'SAVE MORE',
      terms: 'Aplican condiciones',
    });
  });

  it("keeps a language's own value for an opted-out field in its list rows", async () => {
    const article = await createArticle({
      tags: [{ label: 'Billing', code: 'BILL' }],
    });
    await payload.update({
      collection: 'articles',
      id: article.id,
      locale: 'es',
      data: {
        name: 'Precios',
        legalNote: 'Aplican',
        tags: [{ label: 'Facturación', code: 'FACT' }],
      },
    });
    await translate(new FakeGt(), article.id);

    expect((await read(article.id, 'es')).tags).toMatchObject([
      { label: 'BILLING', code: 'FACT' },
    ]);
  });

  it('clears a multi-value text field whose source was emptied', async () => {
    const article = await createArticle({ keywords: ['pricing', 'plans'] });
    const gt = new FakeGt();
    await translate(gt, article.id);
    expect((await read(article.id, 'es')).keywords).toEqual([
      'PRICING',
      'PLANS',
    ]);
    await updateEnglish(article.id, { keywords: [] });
    await translate(gt, article.id);

    expect((await read(article.id, 'es')).keywords ?? []).toEqual([]);
  });

  it('clears the last translatable text when the source has none left', async () => {
    const media = await payload.create({
      collection: 'media',
      locale: 'en',
      data: { alt: 'Photo' },
    });
    const gt = new FakeGt();
    const target = { collection: 'media', id: media.id };
    await translateDocument({ payload, gt, target, locales: ['es'] });
    await payload.update({
      collection: 'media',
      id: media.id,
      locale: 'en',
      data: { alt: '' },
    });
    await translateDocument({ payload, gt, target, locales: ['es'] });

    const es = await payload.findByID({
      collection: 'media',
      id: media.id,
      locale: 'es',
      fallbackLocale: false,
      depth: 0,
    });
    expect(es.alt || null).toBeNull();
  });

  it('translates text inside a named localized tab', async () => {
    const faq = await payload.create({
      collection: 'faqs',
      locale: 'en',
      data: { content: { question: 'How much?' } },
    });
    await translateDocument({
      payload,
      gt: new FakeGt(),
      target: { collection: 'faqs', id: faq.id },
      locales: ['es'],
    });

    const es = await payload.findByID({
      collection: 'faqs',
      id: faq.id,
      locale: 'es',
      fallbackLocale: false,
      depth: 0,
    });
    expect(es.content?.question).toBe('HOW MUCH?');
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
