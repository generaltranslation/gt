// Failures at the GT and Payload boundaries are reported and write nothing.
import type { Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { translateDocument } from '../translation';
import { createTestPayload } from './support/createTestPayload';
import { FakeGt } from './support/fakeGt';
import { createPage } from './support/fixtures';

let payload: Payload;

beforeAll(async () => {
  payload = await createTestPayload();
});

afterAll(async () => {
  await payload.destroy();
});

const read = (id: number | string, locale: string) =>
  payload.findByID({
    collection: 'pages',
    id,
    locale: locale as 'en',
    draft: true,
    fallbackLocale: false,
    depth: 0,
  });

const versionCount = async (id: number | string) =>
  (
    await payload.findVersions({
      collection: 'pages',
      where: { parent: { equals: id } },
      limit: 0,
    })
  ).totalDocs;

describe('translateDocument: failures', () => {
  it('reports GT being unreachable and writes nothing', async () => {
    const page = await createPage(payload);
    const versions = await versionCount(page.id);
    const gt = new FakeGt();
    gt.unreachable = true;
    const result = await translateDocument({
      payload,
      gt,
      target: { collection: 'pages', id: page.id },
      locales: ['es'],
    });

    expect(result.error).toBeTruthy();
    expect(await versionCount(page.id)).toBe(versions);
  });

  it('reports a failed locale and still writes the others', async () => {
    const page = await createPage(payload);
    const gt = new FakeGt();
    gt.failLocales.add('fr');
    const result = await translateDocument({
      payload,
      gt,
      target: { collection: 'pages', id: page.id },
      locales: ['es', 'fr'],
    });

    expect(result.locales.es).toMatchObject({ status: 'applied' });
    expect(result.locales.fr).toMatchObject({ status: 'failed' });
    expect((await read(page.id, 'es')).title).toBe('HOME');
    expect((await read(page.id, 'fr')).title ?? null).toBeNull();
  });

  it('reports a document deleted while GT was translating', async () => {
    const page = await createPage(payload);
    const gt = new FakeGt();
    gt.duringTranslation = async () => {
      await payload.delete({ collection: 'pages', id: page.id });
    };
    const result = await translateDocument({
      payload,
      gt,
      target: { collection: 'pages', id: page.id },
      locales: ['es'],
    });

    expect(result.locales.es).toMatchObject({ status: 'failed' });
  });

  it('reports a document that does not exist', async () => {
    const result = await translateDocument({
      payload,
      gt: new FakeGt(),
      target: { collection: 'pages', id: 999999 },
      locales: ['es'],
    });

    expect(result.error).toBeTruthy();
    expect(result.locales).toEqual({});
  });

  it("reports GT refusing the work at the plan's usage limit", async () => {
    const page = await createPage(payload);
    const gt = new FakeGt();
    gt.usageLimitReached = true;
    const result = await translateDocument({
      payload,
      gt,
      target: { collection: 'pages', id: page.id },
      locales: ['es'],
    });

    expect(result.usageLimitReached).toBe(true);
    expect(result.locales.es).toMatchObject({ status: 'failed' });
  });

  it('does not report the usage limit for other failures', async () => {
    const page = await createPage(payload);
    const gt = new FakeGt();
    gt.unreachable = true;
    const result = await translateDocument({
      payload,
      gt,
      target: { collection: 'pages', id: page.id },
      locales: ['es'],
    });

    expect(result.usageLimitReached).toBeUndefined();
  });
});
