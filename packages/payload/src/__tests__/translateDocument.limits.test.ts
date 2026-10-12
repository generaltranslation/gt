// Character limits: a field's maxLength, which Payload enforces, and the SEO
// plugin's recommended lengths, which it only shows. A translation over a
// limit is translated again with the limit; only a maxLength is ever cut.
import type { Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { translateDocument } from '../translation';
import { createTestPayload } from './support/createTestPayload';
import { FakeGt } from './support/fakeGt';

let payload: Payload;

beforeAll(async () => {
  payload = await createTestPayload();
});

afterAll(async () => {
  await payload.destroy();
});

// 20 characters, under the name field's maxLength of 24.
const NAME = 'Plans for small team';
// 140 characters, under the SEO plugin's 150 for descriptions.
const DESCRIPTION =
  'Compare our plans side by side and pick the one that fits your team today, then change it whenever you need to as your team grows over time.';

const createArticle = () =>
  payload.create({
    collection: 'articles',
    locale: 'en',
    data: {
      name: NAME,
      metaTitle: 'Pricing',
      metaDescription: DESCRIPTION,
      legalNote: 'Terms apply',
    },
  });

const read = async (id: string | number) =>
  payload.findByID({
    collection: 'articles',
    id,
    locale: 'es',
    fallbackLocale: false,
    depth: 0,
  });

async function translateWith(gt: FakeGt) {
  const article = await createArticle();
  const result = await translateDocument({
    payload,
    gt,
    target: { collection: 'articles', id: article.id },
    locales: ['es'],
  });
  return { article, result, es: await read(article.id) };
}

describe('translateDocument: character limits', () => {
  it('asks again with the limit when a translation runs over maxLength', async () => {
    const gt = new FakeGt();
    gt.lengthenWhen = (source) => source === NAME;
    const { result, es } = await translateWith(gt);

    expect(result.locales.es).toMatchObject({ status: 'applied' });
    expect(gt.translateManyCalls).toContainEqual({
      source: NAME,
      maxChars: 24,
      targetLocale: 'es',
    });
    expect(es.name).toBe('PLANS FOR SMALL TEAM');
  });

  it('cuts at a word with an ellipsis when the shorter translation still runs over maxLength', async () => {
    const gt = new FakeGt();
    gt.lengthenWhen = (source) => source === NAME;
    gt.maxCharsMode = 'ignore';
    const { result, es } = await translateWith(gt);

    expect(result.locales.es).toMatchObject({ status: 'applied' });
    expect(es.name.length).toBeLessThanOrEqual(24);
    expect(es.name).toBe('PLANS FOR SMALL TEAM…');
  });

  it('cuts when asking again fails', async () => {
    const gt = new FakeGt();
    gt.lengthenWhen = (source) => source === NAME;
    gt.maxCharsMode = 'fail';
    const { result, es } = await translateWith(gt);

    expect(result.locales.es).toMatchObject({ status: 'applied' });
    expect(es.name.length).toBeLessThanOrEqual(24);
  });

  it('asks again with the SEO length when a description runs over it', async () => {
    const gt = new FakeGt();
    gt.lengthenWhen = (source) => source === DESCRIPTION;
    const { es } = await translateWith(gt);

    expect(gt.translateManyCalls).toContainEqual({
      source: DESCRIPTION,
      maxChars: 150,
      targetLocale: 'es',
    });
    expect(es.metaDescription!.length).toBeLessThanOrEqual(150);
  });

  it('keeps a longer SEO description rather than cutting it', async () => {
    const gt = new FakeGt();
    gt.lengthenWhen = (source) => source === DESCRIPTION;
    gt.maxCharsMode = 'ignore';
    const { es } = await translateWith(gt);

    expect(es.metaDescription!.length).toBeGreaterThan(150);
    expect(es.metaDescription).not.toContain('…');
  });

  it('asks nothing more when translations fit', async () => {
    const gt = new FakeGt();
    await translateWith(gt);

    expect(gt.calls.translateMany).toBe(0);
  });
});
