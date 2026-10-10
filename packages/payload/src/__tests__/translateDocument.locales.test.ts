// Locale codes mapped with customMapping keep Payload's code end to end.
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

describe('translateDocument: mapped locales', () => {
  it("reports and writes a mapped locale under Payload's code", async () => {
    const page = await createPage(payload);
    const gt = new FakeGt();
    gt.customMapping = { es: { code: 'es-ES' } };
    const result = await translateDocument({
      payload,
      gt,
      target: { collection: 'pages', id: page.id },
      locales: ['es'],
    });

    expect(Object.keys(result.locales)).toEqual(['es']);
    expect(result.locales.es).toMatchObject({ status: 'applied' });
    const es = await payload.findByID({
      collection: 'pages',
      id: page.id,
      locale: 'es',
      draft: true,
      fallbackLocale: false,
      depth: 0,
    });
    expect(es.title).toBe('HOME');
  });
});
