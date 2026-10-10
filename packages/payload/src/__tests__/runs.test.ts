// Runs finish translations and saves whether or not the browser that started
// them stays open: Payload's job queue or any admin page steps them, one
// bounded step at a time, never two steppers on the same step.
import type { Payload } from 'payload';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { acquireLock, releaseLock } from '../locks';
import { gtPlugin } from '../plugin';
import {
  RUNS_SLUG,
  staleRuns,
  startRun,
  stepRun,
  type RunProgress,
} from '../runs';
import { createTestPayload } from './support/createTestPayload';
import { FakeGt } from './support/fakeGt';
import { createPage } from './support/fixtures';

let payload: Payload;
const gt = new FakeGt();

beforeAll(async () => {
  payload = await createTestPayload([gtPlugin({ client: gt })]);
});

afterAll(async () => {
  await payload.destroy();
});

afterEach(() => {
  gt.unreachable = false;
  gt.usageLimitReached = false;
  gt.failLocales.clear();
  vi.useRealTimers();
});

const readPage = (id: string | number, locale: string) =>
  payload.findByID({
    collection: 'pages',
    id,
    locale: locale as 'en',
    draft: true,
    fallbackLocale: false,
    depth: 0,
  });

const readRun = async (id: string | number) =>
  (await payload.findByID({
    collection: RUNS_SLUG,
    id,
    depth: 0,
  })) as unknown as RunProgress;

async function stepUntilDone(
  id: string | number,
  limit = 20
): Promise<RunProgress> {
  let progress = await readRun(id);
  for (let i = 0; i < limit && progress.status !== 'done'; i += 1)
    progress = (await stepRun({ payload, gt, id })).progress;
  return progress;
}

const startPage = async (locales = ['es']) => {
  const page = await createPage(payload);
  const run = await startRun({
    payload,
    kind: 'translate',
    targets: [{ collection: 'pages', id: page.id }],
    locales,
  });
  return { page, run };
};

describe('runs', () => {
  it("finishes through Payload's job queue with no browser stepping it", async () => {
    const { page, run } = await startPage();
    await payload.jobs.run();

    expect(await readRun(run.id)).toMatchObject({ status: 'done', done: 1 });
    expect((await readPage(page.id, 'es')).title).toBe('HOME');
  });

  it('finishes when stepped and counts documents as they finish', async () => {
    const { page, run } = await startPage(['es', 'fr']);

    expect(run).toMatchObject({ status: 'running', total: 1, done: 0 });
    expect(await stepUntilDone(run.id)).toMatchObject({
      status: 'done',
      total: 1,
      done: 1,
      failedLocales: [],
    });
    expect((await readPage(page.id, 'fr')).title).toBe('HOME');
  });

  it('does a step once when two steppers try at the same time', async () => {
    const { run } = await startPage();
    const before = gt.calls.uploadSourceFiles;
    const steps = await Promise.all([
      stepRun({ payload, gt, id: run.id }),
      stepRun({ payload, gt, id: run.id }),
    ]);

    expect(steps.filter((step) => step.progressed)).toHaveLength(1);
    expect(gt.calls.uploadSourceFiles - before).toBe(1);
  });

  it('covers every document on the site', async () => {
    const pages = [await createPage(payload), await createPage(payload)];
    const run = await startRun({
      payload,
      kind: 'translate',
      targets: 'site',
      locales: ['es'],
    });

    expect(await stepUntilDone(run.id, 50)).toMatchObject({ status: 'done' });
    for (const page of pages)
      expect((await readPage(page.id, 'es')).title).toBe('HOME');
  });

  it('reports locales that failed', async () => {
    gt.failLocales.add('fr');
    const { run } = await startPage(['es', 'fr']);

    expect(await stepUntilDone(run.id)).toMatchObject({
      status: 'done',
      failedLocales: ['fr'],
    });
  });

  it('saves local edits in a save run', async () => {
    const { page, run } = await startPage();
    await stepUntilDone(run.id);
    await payload.update({
      collection: 'pages',
      id: page.id,
      locale: 'es',
      draft: true,
      data: { title: 'Página principal' },
    });
    const save = await startRun({
      payload,
      kind: 'save',
      targets: [{ collection: 'pages', id: page.id }],
      locales: ['es'],
    });

    expect(await stepUntilDone(save.id)).toMatchObject({
      status: 'done',
      done: 1,
    });
    expect(gt.uploadedTranslations.at(-1)?.content).toContain(
      'Página principal'
    );
  });

  it('ends a run whose steps keep failing, counting what is left as failed', async () => {
    const { run } = await startPage();
    await stepRun({ payload, gt, id: run.id });
    gt.unreachable = true;

    expect(await stepUntilDone(run.id)).toMatchObject({
      status: 'done',
      failedDocuments: 1,
    });
  });

  it('lists running runs nobody has stepped recently', async () => {
    const { run } = await startPage();
    expect((await staleRuns(payload)).map((r) => r.id)).not.toContain(run.id);

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 60_000);
    expect((await staleRuns(payload)).map((r) => r.id)).toContain(run.id);
  });

  it('ends at once when there is nothing to do', async () => {
    const run = await startRun({
      payload,
      kind: 'translate',
      targets: [],
      locales: ['es'],
    });

    expect(run).toMatchObject({ status: 'done', total: 0 });
  });

  it("stops at the plan's usage limit instead of trying every document", async () => {
    for (let i = 0; i < 30; i += 1) await createPage(payload);
    gt.usageLimitReached = true;
    const before = gt.calls.enqueueFiles;
    const run = await startRun({
      payload,
      kind: 'translate',
      targets: 'site',
      locales: ['es'],
    });

    expect(await stepUntilDone(run.id)).toMatchObject({
      status: 'done',
      usageLimitReached: true,
    });
    expect(gt.calls.enqueueFiles - before).toBe(1);
  });

  it('counts strings that could not be written', async () => {
    gt.breakMarkupWhen = (source) => source.includes('docs');
    const { run } = await startPage();
    const progress = await stepUntilDone(run.id);
    gt.breakMarkupWhen = () => false;

    expect(progress.skippedStrings).toBeGreaterThan(0);
  });

  it('keeps both languages when two runs finish the same document at once', async () => {
    const page = await createPage(payload);
    const target = { collection: 'pages', id: page.id };
    const es = await startRun({
      payload,
      kind: 'translate',
      targets: [target],
      locales: ['es'],
    });
    const fr = await startRun({
      payload,
      kind: 'translate',
      targets: [target],
      locales: ['fr'],
    });
    await stepRun({ payload, gt, id: es.id });
    await stepRun({ payload, gt, id: fr.id });
    await Promise.all([stepUntilDone(es.id), stepUntilDone(fr.id)]);

    expect((await readPage(page.id, 'es')).title).toBe('HOME');
    expect((await readPage(page.id, 'fr')).title).toBe('HOME');
  });

  it('drops the progress of a step that lost its lock to another stepper', async () => {
    const { run } = await startPage();
    await stepRun({ payload, gt, id: run.id });
    vi.useFakeTimers({ toFake: ['Date'] });
    let takenOver: string | null = null;
    gt.duringTranslation = async () => {
      vi.setSystemTime(Date.now() + 10 * 60_000);
      takenOver = await acquireLock(payload, `run:${run.id}`, 60_000);
    };
    await stepRun({ payload, gt, id: run.id });
    gt.duringTranslation = null;

    expect(takenOver).toBeTruthy();
    expect(await readRun(run.id)).toMatchObject({ status: 'running', done: 0 });
  });

  it('clears removed text only while holding the document, like other saves', async () => {
    const media = await payload.create({
      collection: 'media',
      locale: 'en',
      data: { alt: 'Photo' },
    });
    const target = { collection: 'media', id: media.id };
    const first = await startRun({
      payload,
      kind: 'translate',
      targets: [target],
      locales: ['es'],
    });
    await stepUntilDone(first.id);
    await payload.update({
      collection: 'media',
      id: media.id,
      locale: 'en',
      data: { alt: '' },
    });
    const token = await acquireLock(
      payload,
      `document:media:${media.id}`,
      60_000
    );
    const run = await startRun({
      payload,
      kind: 'translate',
      targets: [target],
      locales: ['es'],
    });
    for (let i = 0; i < 3; i += 1) await stepRun({ payload, gt, id: run.id });
    const esAlt = async () =>
      (
        await payload.findByID({
          collection: 'media',
          id: media.id,
          locale: 'es',
          fallbackLocale: false,
          depth: 0,
        })
      ).alt;

    expect(await esAlt()).toBe('PHOTO');
    expect(await readRun(run.id)).toMatchObject({ status: 'running' });
    await releaseLock(payload, `document:media:${media.id}`, token!);
    await stepUntilDone(run.id);
    expect((await esAlt()) || null).toBeNull();
  });

  it('keeps the progress of a step that ran past its lock when nobody took over', async () => {
    const { run } = await startPage();
    await stepRun({ payload, gt, id: run.id });
    vi.useFakeTimers({ toFake: ['Date'] });
    gt.duringTranslation = async () => {
      vi.setSystemTime(Date.now() + 10 * 60_000);
    };
    await stepRun({ payload, gt, id: run.id });
    gt.duringTranslation = null;

    expect(await readRun(run.id)).toMatchObject({ status: 'done', done: 1 });
  });
});
