// What a document sends to GT: only text people read, one file per document.
import type { Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { translateDocument } from '../translation';
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

async function sentStrings(gt: FakeGt): Promise<string[]> {
  const [sent] = gt.uploadedSources;
  return [...readKeyedHtml(sent.content).values()];
}

describe('translateDocument: what is sent', () => {
  it('sends text, textarea and rich text, and nothing else', async () => {
    const page = await createPage(payload);
    const gt = new FakeGt();
    await translateDocument({
      payload,
      gt,
      target: { collection: 'pages', id: page.id },
      locales: ['es'],
    });

    const sent = await sentStrings(gt);
    for (const expected of [
      'Home',
      'Welcome',
      'Contact us',
      'Email us',
      'Start now',
      'First column',
      'Second column',
      'Home | Example',
      'An example site.',
    ]) {
      expect(sent.some((s) => s.includes(expected))).toBe(true);
    }
    // A select value, a code field, an opted-out field and the slug stay in Payload.
    const everything = sent.join('\n');
    expect(everything).not.toContain('full');
    expect(everything).not.toContain('const answer');
    expect(everything).not.toContain('Reviewed by legal');
    expect(everything).not.toContain(page.slug as string);
  });

  it('sends rich text links and formats as tags, never the link targets', async () => {
    const page = await createPage(payload);
    const gt = new FakeGt();
    await translateDocument({
      payload,
      gt,
      target: { collection: 'pages', id: page.id },
      locales: ['es'],
    });

    const sent = await sentStrings(gt);
    expect(sent).toContain(
      'Read the <a data-gt-link-0=""><strong>docs</strong></a> or visit <a data-gt-link-1="">our site</a>.'
    );
    const file = gt.uploadedSources[0].content;
    expect(file).not.toContain('/docs');
    expect(file).not.toContain('https://example.com');
  });

  it('skips plain text values that are paths, URLs or emails', async () => {
    await setHeader(payload);
    const gt = new FakeGt();
    await translateDocument({
      payload,
      gt,
      target: { global: 'header' },
      locales: ['es'],
    });

    const sent = await sentStrings(gt);
    expect(sent).toEqual(expect.arrayContaining(['About us', 'Blog']));
    expect(sent.join('\n')).not.toContain('/about');
    expect(sent.join('\n')).not.toContain('blog.example.com');
  });

  it('keys strings with neutral ids, never field names', async () => {
    const page = await createPage(payload);
    const gt = new FakeGt();
    await translateDocument({
      payload,
      gt,
      target: { collection: 'pages', id: page.id },
      locales: ['es'],
    });

    // A key such as "meta.description" reads like page metadata, and models
    // leave it untranslated.
    const keys = [...readKeyedHtml(gt.uploadedSources[0].content).keys()];
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) expect(key).toMatch(/^k[0-9a-f]{12}$/);
  });

  it('uses one file per document, the same file on every run', async () => {
    const page = await createPage(payload);
    const gt = new FakeGt();
    const target = { collection: 'pages', id: page.id };
    await translateDocument({ payload, gt, target, locales: ['es'] });
    await translateDocument({ payload, gt, target, locales: ['es'] });

    expect(gt.fileIds()).toHaveLength(1);
    expect(new Set(gt.uploadedSources.map((s) => s.fileId)).size).toBe(1);
  });

  it("names each file by Payload's own identity and a readable path", async () => {
    const page = await createPage(payload);
    await setHeader(payload);
    const gt = new FakeGt();
    await translateDocument({
      payload,
      gt,
      target: { collection: 'pages', id: page.id },
      locales: ['es'],
    });
    await translateDocument({
      payload,
      gt,
      target: { global: 'header' },
      locales: ['es'],
    });

    expect(
      gt.uploadedSources.map(({ fileId, fileName }) => ({ fileId, fileName }))
    ).toEqual([
      { fileId: `pages/${page.id}`, fileName: 'pages/Home' },
      { fileId: 'header', fileName: 'header' },
    ]);
  });
});
