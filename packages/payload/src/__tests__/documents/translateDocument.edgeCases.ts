// Things users easily do that the main suites don't cover.
import type { Payload } from 'payload';
import { beforeAll, describe, expect, it } from 'vitest';
import { translateDocument } from '../../translation';
import { sharedTestPayload } from '../support/createTestPayload';
import { FakeGt } from '../support/fakeGt';
import { createPage } from '../support/fixtures';
import {
  block,
  bulletList,
  paragraph,
  plainText,
  richText,
  shape,
  text,
} from '../support/lexical';

let payload: Payload;

beforeAll(async () => {
  payload = await sharedTestPayload();
});

const read = (id: string | number, locale: string) =>
  payload.findByID({
    overrideAccess: true,
    collection: 'pages',
    id,
    locale: locale as 'en',
    draft: true,
    fallbackLocale: false,
    depth: 0,
  });

const updateEnglish = (id: string | number, data: Record<string, unknown>) =>
  payload.update({
    overrideAccess: true,
    collection: 'pages',
    id,
    locale: 'en',
    draft: true,
    data,
  });

describe('translateDocument: edge cases', () => {
  it('reports a locale the GT project does not have, and writes nothing', async () => {
    const page = await createPage(payload);
    const gt = new FakeGt();
    gt.unsupportedLocales.add('fr');
    const result = await translateDocument({
      payload,
      gt,
      target: { collection: 'pages', id: page.id },
      locales: ['es', 'fr'],
    });

    expect(result.error).toContain('fr');
    expect((await read(page.id, 'es')).title ?? null).toBeNull();
  });

  it('never translates into the source locale when it is in the list', async () => {
    const page = await createPage(payload);
    const result = await translateDocument({
      payload,
      gt: new FakeGt(),
      target: { collection: 'pages', id: page.id },
      locales: ['en', 'es'],
    });

    expect(Object.keys(result.locales)).toEqual(['es']);
    expect((await read(page.id, 'en')).title).toBe('Home');
    expect((await read(page.id, 'es')).title).toBe('HOME');
  });

  it('translates the latest draft, not only what is published', async () => {
    const page = await createPage(payload);
    await updateEnglish(page.id, { title: 'Home draft' });
    await translateDocument({
      payload,
      gt: new FakeGt(),
      target: { collection: 'pages', id: page.id },
      locales: ['es'],
    });

    expect((await read(page.id, 'es')).title).toBe('HOME DRAFT');
  });

  it('keeps &, < and > exactly as written', async () => {
    const page = await createPage(payload);
    await updateEnglish(page.id, {
      title: 'Terms & Conditions',
      meta: { title: 'Q&A', description: 'a < b & c > d' },
    });
    await translateDocument({
      payload,
      gt: new FakeGt(),
      target: { collection: 'pages', id: page.id },
      locales: ['es'],
    });

    const es = await read(page.id, 'es');
    expect(es.title).toBe('TERMS & CONDITIONS');
    expect(es.meta?.title).toBe('Q&A');
    expect(es.meta?.description).toBe('A < B & C > D');
  });

  it('translates lists and blocks inside rich text, keeping their structure', async () => {
    const page = await createPage(payload);
    await updateEnglish(page.id, {
      body: richText(
        paragraph(text('Why teams switch:')),
        bulletList([text('Faster publishing')], [text('Fewer mistakes')]),
        block('banner', { content: richText(paragraph(text('Limited offer'))) })
      ),
    });
    await translateDocument({
      payload,
      gt: new FakeGt(),
      target: { collection: 'pages', id: page.id },
      locales: ['es'],
    });

    const en = await read(page.id, 'en');
    const es = await read(page.id, 'es');
    expect(shape(es.body)).toEqual(shape(en.body));
    expect(plainText(es.body)).toEqual([
      'WHY TEAMS SWITCH:',
      'FASTER PUBLISHING',
      'FEWER MISTAKES',
    ]);
    const banner = (
      es.body?.root.children[2] as
        | { fields?: { content?: ReturnType<typeof richText> } }
        | undefined
    )?.fields?.content;
    expect(plainText(banner)).toEqual(['LIMITED OFFER']);
  });

  it('translates every value of a multi-value text field', async () => {
    const page = await createPage(payload);
    await updateEnglish(page.id, { keywords: ['fast', 'simple'] });
    await translateDocument({
      payload,
      gt: new FakeGt(),
      target: { collection: 'pages', id: page.id },
      locales: ['es'],
    });

    expect((await read(page.id, 'es')).keywords).toEqual(['FAST', 'SIMPLE']);
  });

  it('translates a multi-value text field again when one of its values changes', async () => {
    const page = await createPage(payload);
    await updateEnglish(page.id, { keywords: ['fast', 'simple'] });
    const gt = new FakeGt();
    const target = { collection: 'pages', id: page.id };
    await translateDocument({ payload, gt, target, locales: ['es'] });
    await updateEnglish(page.id, { keywords: ['fast', 'reliable'] });
    await translateDocument({ payload, gt, target, locales: ['es'] });

    expect((await read(page.id, 'es')).keywords).toEqual(['FAST', 'RELIABLE']);
  });

  it('sends nothing for a document with nothing to translate', async () => {
    const media = await payload.create({
      overrideAccess: true,
      collection: 'media',
      locale: 'en',
      data: {},
    });
    const gt = new FakeGt();
    const result = await translateDocument({
      payload,
      gt,
      target: { collection: 'media', id: media.id },
      locales: ['es'],
    });

    expect(result.error).toBeUndefined();
    expect(result.locales).toEqual({});
    expect(gt.uploadedSources).toHaveLength(0);
  });
});
