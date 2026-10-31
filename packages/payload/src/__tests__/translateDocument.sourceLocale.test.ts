// A site whose main language is not English.
import type { Payload } from 'payload';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { translateDocument } from '../translation';
import { createTestPayload } from './support/createTestPayload';
import { FakeGt, readKeyedHtml } from './support/fakeGt';

let payload: Payload;

beforeAll(async () => {
  payload = await createTestPayload([], { defaultLocale: 'de' });
});

afterAll(async () => {
  await payload.destroy();
});

it("translates from Payload's default locale and leaves it untouched", async () => {
  const page = await payload.create({
    collection: 'pages',
    locale: 'de',
    data: { title: 'Startseite', slug: 'startseite', _status: 'published' },
  });
  const gt = new FakeGt();
  await translateDocument({
    payload,
    gt,
    target: { collection: 'pages', id: page.id },
    locales: ['en', 'es'],
  });

  expect([...readKeyedHtml(gt.uploadedSources[0].content).values()]).toContain(
    'Startseite'
  );
  const read = (locale: string) =>
    payload.findByID({
      collection: 'pages',
      id: page.id,
      locale: locale as 'de',
      draft: true,
      fallbackLocale: false,
      depth: 0,
    });
  expect((await read('de')).title).toBe('Startseite');
  expect((await read('en')).title).toBe('STARTSEITE');
  expect((await read('es')).title).toBe('STARTSEITE');
});
