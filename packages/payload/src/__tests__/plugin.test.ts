// The plugin's endpoints, as the admin panel calls them: start and step runs
// that translate or save local edits, and report coverage.
import type { Payload, TypedUser } from 'payload';
import { createLocalReq } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CoveragePage } from '../coverage';
import { gtPlugin } from '../plugin';
import type { RunProgress, StepResult } from '../runs';
import { createTestPayload, LOCKED_OUT } from './support/createTestPayload';
import { FakeGt } from './support/fakeGt';
import { createPage } from './support/fixtures';

let payload: Payload;
let user: TypedUser;
const gt = new FakeGt();

beforeAll(async () => {
  payload = await createTestPayload([gtPlugin({ client: gt })]);
  user = (await payload.create({
    collection: 'users',
    data: { email: 'editor@example.com', password: 'secret-password' },
  })) as TypedUser;
});

afterAll(async () => {
  await payload.destroy();
});

async function call<T>(
  path: string,
  body: unknown,
  signedIn = true
): Promise<{ status: number; json: T }> {
  const endpoint = payload.config.endpoints.find(
    (e) => e.path === path && e.method === 'post'
  );
  if (!endpoint) throw new Error(`No endpoint ${path}`);
  const req = await createLocalReq(
    { user: signedIn ? user : undefined },
    payload
  );
  req.json = async () => body;
  const response = await endpoint.handler(req);
  return { status: response.status, json: (await response.json()) as T };
}

const read = (id: string | number, locale: string) =>
  payload.findByID({
    collection: 'pages',
    id,
    locale: locale as 'en',
    draft: true,
    fallbackLocale: false,
    depth: 0,
  });

describe('gtPlugin endpoints', () => {
  it('refuses requests from someone who is not signed in', async () => {
    const page = await createPage(payload);
    const { status } = await call(
      '/gt/runs',
      { targets: [{ collection: 'pages', id: page.id }], locales: ['es'] },
      false
    );

    expect(status).toBe(401);
  });

  it('translates a document through a run stepped from the admin panel', async () => {
    const page = await createPage(payload);
    const started = await call<RunProgress>('/gt/runs', {
      targets: [{ collection: 'pages', id: page.id }],
      locales: ['es'],
    });
    expect(started.json).toMatchObject({
      status: 'running',
      total: 1,
      done: 0,
    });

    let step: StepResult | undefined;
    for (let i = 0; i < 5 && step?.progress.status !== 'done'; i += 1)
      step = (await call<StepResult>('/gt/runs/step', { id: started.json.id }))
        .json;

    expect(step?.progress).toMatchObject({
      status: 'done',
      total: 1,
      done: 1,
      failedLocales: [],
    });
    expect((await read(page.id, 'es')).title).toBe('HOME');
  });

  it('starts a run over the whole site when asked', async () => {
    await createPage(payload);
    const { json } = await call<RunProgress>('/gt/runs', {
      site: true,
      locales: ['es'],
    });

    const pages = (await payload.find({ collection: 'pages', limit: 0 }))
      .totalDocs;
    expect(json.total).toBeGreaterThanOrEqual(pages);
  });

  it('saves local edits through a save run', async () => {
    const page = await createPage(payload);
    const target = { collection: 'pages', id: page.id };
    const translated = await call<RunProgress>('/gt/runs', {
      targets: [target],
      locales: ['es'],
    });
    for (let i = 0; i < 5; i += 1)
      await call('/gt/runs/step', { id: translated.json.id });
    await payload.update({
      collection: 'pages',
      id: page.id,
      locale: 'es',
      draft: true,
      data: { title: 'Inicio' },
    });
    const saved = await call<RunProgress>('/gt/runs', {
      kind: 'save',
      targets: [target],
      locales: ['es'],
    });
    const step = await call<StepResult>('/gt/runs/step', { id: saved.json.id });

    expect(step.json.progress).toMatchObject({
      kind: 'save',
      status: 'done',
      done: 1,
    });
    expect(gt.uploadedTranslations.at(-1)?.content).toContain('Inicio');
  });

  it('leaves out locales GT cannot translate into', async () => {
    gt.unsupportedLocales.add('xx-not-a-locale');
    const page = await createPage(payload);
    const { json } = await call<RunProgress>('/gt/runs', {
      targets: [{ collection: 'pages', id: page.id }],
      locales: ['es', 'xx-not-a-locale'],
    });
    for (let i = 0; i < 5; i += 1) await call('/gt/runs/step', { id: json.id });

    expect((await read(page.id, 'es')).title).toBe('HOME');
  });

  it("reports a page of the site with each language's coverage", async () => {
    const page = await createPage(payload);
    const { json } = await call<CoveragePage>('/gt/coverage', {
      page: 1,
      limit: 100,
    });

    expect(json.documents).toContainEqual({
      target: { collection: 'pages', id: page.id },
      title: 'Home',
      label: 'Pages',
      locales: { es: 'empty', fr: 'empty', de: 'empty' },
    });
    expect(json.totalPages).toBeGreaterThanOrEqual(1);
  });

  it('turns away coverage requests from signed-out users', async () => {
    const { status } = await call('/gt/coverage', {}, false);

    expect(status).toBe(401);
  });

  it('refuses to translate a document the user cannot update, before contacting GT', async () => {
    const notice = await payload.create({
      collection: 'notices',
      locale: 'en',
      data: { message: 'Closed today' },
    });
    LOCKED_OUT.add(String(user.email));
    const before = gt.calls.uploadSourceFiles;
    const { status } = await call('/gt/runs', {
      targets: [{ collection: 'notices', id: notice.id }],
      locales: ['es'],
    });
    LOCKED_OUT.delete(String(user.email));

    expect(status).toBe(403);
    expect(gt.calls.uploadSourceFiles).toBe(before);
  });

  it('refuses to translate a global the user cannot update', async () => {
    await payload.updateGlobal({
      slug: 'announcement',
      locale: 'en',
      data: { message: 'Closed today' },
    });
    LOCKED_OUT.add(String(user.email));
    const { status } = await call('/gt/runs', {
      targets: [{ global: 'announcement' }],
      locales: ['es'],
    });
    LOCKED_OUT.delete(String(user.email));

    expect(status).toBe(403);
  });

  it('leaves out of a site run what the user cannot update', async () => {
    const notice = await payload.create({
      collection: 'notices',
      locale: 'en',
      data: { message: 'Open late' },
    });
    LOCKED_OUT.add(String(user.email));
    const { json } = await call<RunProgress>('/gt/runs', {
      site: true,
      locales: ['es'],
    });
    for (let i = 0; i < 50; i += 1) {
      const step = (await call<StepResult>('/gt/runs/step', { id: json.id }))
        .json;
      if (step.progress.status === 'done') break;
    }
    LOCKED_OUT.delete(String(user.email));

    const es = await payload.findByID({
      collection: 'notices',
      id: notice.id,
      locale: 'es',
      fallbackLocale: false,
      depth: 0,
    });
    expect(es.message ?? null).toBeNull();
  });

  it('writes nothing for a run whose starter lost access before it finished', async () => {
    const notice = await payload.create({
      collection: 'notices',
      locale: 'en',
      data: { message: 'Back soon' },
    });
    const { json } = await call<RunProgress>('/gt/runs', {
      targets: [{ collection: 'notices', id: notice.id }],
      locales: ['es'],
    });
    await call('/gt/runs/step', { id: json.id });
    LOCKED_OUT.add(String(user.email));
    let progress = json;
    for (let i = 0; i < 5 && progress.status !== 'done'; i += 1)
      progress = (await call<StepResult>('/gt/runs/step', { id: json.id })).json
        .progress;
    LOCKED_OUT.delete(String(user.email));

    expect(progress.failedLocales).toEqual(['es']);
    const es = await payload.findByID({
      collection: 'notices',
      id: notice.id,
      locale: 'es',
      fallbackLocale: false,
      depth: 0,
    });
    expect(es.message ?? null).toBeNull();
  });
});
