// With saveLocalEdits, a run first sends each locale's current text as the
// translation of the version GT holds, so edits made in Payload are kept and
// used as context when their source changes. Without it, nothing is sent.
import type { Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { saveTranslations, translateDocument } from '../translation';
import { createTestPayload } from './support/createTestPayload';
import { FakeGt, readKeyedHtml } from './support/fakeGt';
import { createPage } from './support/fixtures';
import { BOLD, link, paragraph, richText, text } from './support/lexical';

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

const editSpanish = (id: number | string, data: Record<string, unknown>) =>
  payload.update({ collection: 'pages', id, locale: 'es', draft: true, data });

describe('translateDocument: edits made in Payload', () => {
  it('sends no edits without saveLocalEdits', async () => {
    const page = await createPage(payload);
    const gt = new FakeGt();
    const target = { collection: 'pages', id: page.id };
    await translateDocument({ payload, gt, target, locales: ['es'] });
    await editSpanish(page.id, { title: 'Página principal' });
    await translateDocument({ payload, gt, target, locales: ['es'] });

    expect(gt.calls.uploadTranslations).toBe(0);
  });

  it('keeps an edit when its source did not change, with saveLocalEdits', async () => {
    const page = await createPage(payload);
    const gt = new FakeGt();
    const target = { collection: 'pages', id: page.id };
    await translateDocument({ payload, gt, target, locales: ['es'] });
    await editSpanish(page.id, { title: 'Página principal' });
    await translateDocument({
      payload,
      gt,
      target,
      locales: ['es'],
      saveLocalEdits: true,
    });

    expect((await read(page.id, 'es')).title).toBe('Página principal');
  });

  it('sends the edit to GT against the version it was made on, before the new source', async () => {
    const page = await createPage(payload);
    const gt = new FakeGt();
    const target = { collection: 'pages', id: page.id };
    await translateDocument({ payload, gt, target, locales: ['es'] });
    const translatedVersion = gt.uploadedSources.length;
    await editSpanish(page.id, { title: 'Página principal' });
    await payload.update({
      collection: 'pages',
      id: page.id,
      locale: 'en',
      draft: true,
      data: {
        meta: { title: 'Home | Example Inc', description: 'An example site.' },
      },
    });
    await translateDocument({
      payload,
      gt,
      target,
      locales: ['es'],
      saveLocalEdits: true,
    });

    expect(gt.uploadedTranslations).toHaveLength(1);
    const [upload] = gt.uploadedTranslations;
    expect(upload.locale).toBe('es');
    expect(upload.versionId).toBe(`${gt.fileIds()[0]}@${translatedVersion}`);
    // Payload's current Spanish goes back as one whole file.
    const values = [...readKeyedHtml(upload.content).values()];
    expect(values).toContain('Página principal');
    expect(values).toContain('AN EXAMPLE SITE.');
  });

  it('gives GT the edit as context when its source changes', async () => {
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
    await translateDocument({
      payload,
      gt,
      target,
      locales: ['es'],
      saveLocalEdits: true,
    });

    expect([...gt.contextUsed.values()]).toContain('Página principal');
  });

  it('sends a rich text edit with its links and formats', async () => {
    const page = await createPage(payload);
    const gt = new FakeGt();
    const target = { collection: 'pages', id: page.id };
    await translateDocument({ payload, gt, target, locales: ['es'] });
    const es = await read(page.id, 'es');
    await editSpanish(page.id, {
      hero: {
        ...es.hero,
        richText: richText(
          (es.hero?.richText?.root.children[0] ?? paragraph()) as Record<
            string,
            unknown
          >,
          paragraph(
            text('Lee la '),
            link('/docs', text('documentación', BOLD)),
            text(' o visita '),
            link('https://example.com', text('nuestro sitio')),
            text('.')
          )
        ),
      },
    });
    await translateDocument({
      payload,
      gt,
      target,
      locales: ['es'],
      saveLocalEdits: true,
    });

    const values = [
      ...readKeyedHtml(gt.uploadedTranslations[0].content).values(),
    ];
    expect(values).toContain(
      'Lee la <a data-gt-link-0=""><strong>documentación</strong></a> o visita <a data-gt-link-1="">nuestro sitio</a>.'
    );
  });

  it('keeps each link with its own source link when a saved translation reordered them', async () => {
    const page = await createPage(payload);
    const gt = new FakeGt();
    gt.swapLinksWhen = (source) => source.includes('docs');
    const target = { collection: 'pages', id: page.id };
    await translateDocument({ payload, gt, target, locales: ['es'] });
    await saveTranslations({ payload, gt, target, locales: ['es'] });

    const saved = [
      ...readKeyedHtml(gt.uploadedTranslations.at(-1)!.content).values(),
    ].find((value) => value.includes('OUR SITE'));
    expect(saved).toContain('<a data-gt-link-1="">OUR SITE</a>');
    expect(saved).toContain('<a data-gt-link-0=""><strong>DOCS</strong></a>');
  });

  it('saves an edited paragraph whose text styling no longer matches the source', async () => {
    const page = await createPage(payload);
    const gt = new FakeGt();
    const target = { collection: 'pages', id: page.id };
    await translateDocument({ payload, gt, target, locales: ['es'] });
    const es = await read(page.id, 'es');
    await editSpanish(page.id, {
      hero: {
        ...es.hero,
        richText: richText(
          (es.hero?.richText?.root.children[0] ?? paragraph()) as Record<
            string,
            unknown
          >,
          paragraph({
            ...text('Lee nuestra documentación'),
            style: 'color: red',
          })
        ),
      },
    });
    await saveTranslations({ payload, gt, target, locales: ['es'] });

    const values = [
      ...readKeyedHtml(gt.uploadedTranslations.at(-1)!.content).values(),
    ];
    expect(
      values.some((value) => value.includes('Lee nuestra documentación'))
    ).toBe(true);
  });
});
