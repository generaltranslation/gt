// Translations and saves of local edits as runs stored in Payload, so they
// finish whether or not the browser that started them stays open. A run is
// moved forward one bounded step at a time by whoever steps it: the admin
// panel, or Payload's job queue. A lock on the run keeps two steppers from
// doing the same step, and a lock on each document keeps two runs from saving
// it at once.
import type { CollectionConfig, Payload, TaskConfig, TypedUser } from 'payload';
import { formatDiagnosticErrorDetails } from 'generaltranslation/diagnostics';
import { createGtPayloadDiagnostic } from './diagnostics';
import { listSiteTargets } from './documents';
import { acquireLock, releaseLock, renewLock } from './locks';
import { targetKey } from './targets';
import {
  checkTranslation,
  finishTranslation,
  saveDocuments,
  startTranslation,
  type DocumentResult,
  type TranslationJob,
} from './translation';
import type { GtClient, TranslateTarget } from './types';

export const RUNS_SLUG = 'gt-translation-runs';
const RUN_TASK = 'gtTranslationRun';

export type RunKind = 'translate' | 'save';

export type RunProgress = {
  id: string | number;
  kind: RunKind;
  status: 'running' | 'done';
  // Documents in the run, and documents finished.
  total: number;
  done: number;
  // Locales that failed in any document.
  failedLocales: string[];
  // Documents that could not be read, sent or saved at all.
  failedDocuments: number;
  // GT refused the work because the plan's usage limit is reached.
  usageLimitReached: boolean;
  // Strings left as they were: their translation broke markup or was missing.
  skippedStrings: number;
};

type Run = RunProgress & {
  locales: string[];
  saveLocalEdits: boolean;
  pending: TranslateTarget[];
  jobs: TranslationJob[];
  startedBy: { collection: string; id: string | number } | null;
  // Steps in a row that threw.
  failures: number;
  createdAt: string;
};

// Documents read and sent to GT per step.
const START_BATCH = 25;
// Documents saved into Payload per step.
const FINISH_BATCH = 10;
// How long a stepper holds a run or document before another may take it
// over, longer than any one step.
const LEASE_MS = 2 * 60 * 1000;
// A running run nobody has stepped for this long is picked up by any admin.
const STALE_MS = 30 * 1000;
const FINISHED = new Set(['completed', 'failed']);
// Steps in a row that may throw before the run gives up on what is left.
const MAX_FAILURES = 5;
// After this long, jobs GT has not finished are reported as failed.
const MAX_RUN_MS = 24 * 60 * 60 * 1000;

export const runsCollection: CollectionConfig = {
  slug: RUNS_SLUG,
  admin: { hidden: true },
  // Read and written only through the plugin's endpoints and job.
  access: {
    read: () => false,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: 'kind',
      type: 'select',
      options: ['translate', 'save'],
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      options: ['running', 'done'],
      required: true,
      index: true,
    },
    { name: 'locales', type: 'json', required: true },
    { name: 'saveLocalEdits', type: 'checkbox' },
    { name: 'pending', type: 'json', required: true },
    { name: 'jobs', type: 'json', required: true },
    { name: 'total', type: 'number', required: true },
    { name: 'done', type: 'number', required: true },
    { name: 'failedLocales', type: 'json', required: true },
    { name: 'failedDocuments', type: 'number', required: true },
    { name: 'usageLimitReached', type: 'checkbox' },
    { name: 'skippedStrings', type: 'number', defaultValue: 0 },
    { name: 'startedBy', type: 'json' },
    { name: 'failures', type: 'number', defaultValue: 0 },
  ],
};

const progressOf = (run: Run): RunProgress => ({
  id: run.id,
  kind: run.kind,
  status: run.status,
  total: run.total,
  done: run.done,
  failedLocales: run.failedLocales,
  failedDocuments: run.failedDocuments,
  usageLimitReached: Boolean(run.usageLimitReached),
  skippedStrings: run.skippedStrings ?? 0,
});

const readRun = async (payload: Payload, id: string | number) =>
  (await payload.findByID({
    collection: RUNS_SLUG,
    id,
    depth: 0,
  })) as unknown as Run;

const updateRun = (payload: Payload, id: string | number, data: Partial<Run>) =>
  payload.update({
    collection: RUNS_SLUG,
    id,
    data: data as Record<string, unknown>,
    depth: 0,
  });

// Records each document's outcome on the run's counts, and logs why
// documents and locales failed.
function tally(
  payload: Payload,
  run: Run,
  documents: DocumentResult<{
    error?: string;
    locales: Record<
      string,
      { status: string; error?: string; skipped?: unknown[]; unsaved?: number }
    >;
  }>[]
): Pick<Run, 'done' | 'failedLocales' | 'failedDocuments' | 'skippedStrings'> {
  const failed = new Set(run.failedLocales);
  let failedDocuments = run.failedDocuments;
  let skippedStrings = run.skippedStrings ?? 0;
  for (const { target, result } of documents) {
    if (result.error && !Object.keys(result.locales).length) {
      failedDocuments += 1;
      payload.logger.warn(
        createGtPayloadDiagnostic({
          severity: 'Warning',
          whatHappened: 'Could not translate a document',
          details: [`Document: ${targetKey(target)}`, result.error],
        })
      );
    }
    for (const [locale, outcome] of Object.entries(result.locales)) {
      skippedStrings += (outcome.skipped?.length ?? 0) + (outcome.unsaved ?? 0);
      if (outcome.status !== 'failed') continue;
      failed.add(locale);
      payload.logger.warn(
        createGtPayloadDiagnostic({
          severity: 'Warning',
          whatHappened: `Could not translate a document into ${locale}`,
          details: [
            `Document: ${targetKey(target)}`,
            ...('error' in outcome && outcome.error ? [outcome.error] : []),
          ],
        })
      );
    }
  }
  return {
    done: run.done + documents.length,
    failedLocales: [...failed],
    failedDocuments,
    skippedStrings,
  };
}

async function userOf(
  payload: Payload,
  run: Run
): Promise<TypedUser | undefined> {
  if (!run.startedBy) return undefined;
  const user = await payload.findByID({
    collection: run.startedBy.collection,
    id: run.startedBy.id,
    depth: 0,
  });
  return { ...user, collection: run.startedBy.collection } as TypedUser;
}

export type StartRunInput = {
  payload: Payload;
  kind: RunKind;
  // Documents, or the whole site.
  targets: TranslateTarget[] | 'site';
  locales: string[];
  saveLocalEdits?: boolean;
  user?: TypedUser | null;
};

// Creates a run and queues Payload's job for it.
export async function startRun({
  payload,
  kind,
  targets,
  locales,
  saveLocalEdits = false,
  user,
}: StartRunInput): Promise<RunProgress> {
  const pending =
    targets === 'site' ? await listSiteTargets(payload, { user }) : targets;
  const run = (await payload.create({
    collection: RUNS_SLUG,
    data: {
      kind,
      status: pending.length ? 'running' : 'done',
      locales,
      saveLocalEdits,
      pending,
      jobs: [],
      total: pending.length,
      done: 0,
      failedLocales: [],
      failedDocuments: 0,
      usageLimitReached: false,
      skippedStrings: 0,
      startedBy: user ? { collection: user.collection, id: user.id } : null,
    } as unknown as Record<string, unknown>,
    depth: 0,
  })) as unknown as Run;
  if (pending.length)
    await payload.jobs.queue({
      task: RUN_TASK,
      input: { runId: String(run.id) },
    });
  return progressOf(run);
}

async function startNext(
  payload: Payload,
  gt: GtClient,
  run: Run,
  user: TypedUser | undefined
): Promise<Partial<Run>> {
  const batch = run.pending.slice(0, START_BATCH);
  const pending = run.pending.slice(START_BATCH);
  if (run.kind === 'save') {
    const documents = await saveDocuments({
      payload,
      gt,
      targets: batch,
      locales: run.locales,
      user,
    });
    // A document with nothing to save is still done.
    const skipped = batch.length - documents.length;
    const counts = tally(payload, run, documents);
    return { pending, ...counts, done: counts.done + skipped };
  }
  const started = await startTranslation({
    payload,
    gt,
    targets: batch,
    locales: run.locales,
    saveLocalEdits: run.saveLocalEdits,
    user,
  });
  const counts = tally(payload, run, started.documents);
  // Past the usage limit GT refuses every batch, so the rest is not tried.
  if (started.documents.some((d) => d.result.usageLimitReached))
    return {
      pending: [],
      jobs: [...run.jobs, ...started.jobs],
      ...counts,
      done: counts.done + pending.length,
      usageLimitReached: true,
    };
  return { pending, jobs: [...run.jobs, ...started.jobs], ...counts };
}

async function finishReady(
  payload: Payload,
  gt: GtClient,
  run: Run,
  user: TypedUser | undefined
): Promise<Partial<Run> | null> {
  const jobIds = run.jobs.flatMap((job) => (job.jobId ? [job.jobId] : []));
  const statuses = jobIds.length ? await checkTranslation({ gt, jobIds }) : [];
  const finished = new Set(
    statuses.filter((s) => FINISHED.has(s.status)).map((s) => s.jobId)
  );
  const isReady = (job: TranslationJob) =>
    !job.jobId || finished.has(job.jobId);
  const byFile = new Map<string, TranslationJob[]>();
  for (const job of run.jobs)
    byFile.set(job.fileId, [...(byFile.get(job.fileId) ?? []), job]);
  const expired = Date.now() - new Date(run.createdAt).getTime() > MAX_RUN_MS;
  const ready = [...byFile.values()]
    .filter((jobs) => expired || jobs.every(isReady))
    .slice(0, FINISH_BATCH);
  // Another run may be saving the same document; its locales are saved one
  // at a time, so a document another run holds waits for a later step.
  const held: { key: string; token: string; jobs: TranslationJob[] }[] = [];
  for (const jobs of ready) {
    const key = `document:${targetKey(jobs[0].target)}`;
    const token = await acquireLock(payload, key, LEASE_MS);
    if (token) held.push({ key, token, jobs });
  }
  if (!held.length) return null;
  try {
    const documents = await finishTranslation({
      payload,
      gt,
      saveLocalEdits: run.saveLocalEdits,
      jobs: held.flatMap((h) => h.jobs),
      statuses,
      user,
    });
    const finishedFiles = new Set(held.map((h) => h.jobs[0].fileId));
    return {
      jobs: run.jobs.filter((job) => !finishedFiles.has(job.fileId)),
      ...tally(payload, run, documents),
    };
  } finally {
    for (const { key, token } of held) await releaseLock(payload, key, token);
  }
}

export type StepResult = { progress: RunProgress; progressed: boolean };

// Moves the run forward by one step if no one else is stepping it.
export async function stepRun({
  payload,
  gt,
  id,
}: {
  payload: Payload;
  gt: GtClient;
  id: string | number;
}): Promise<StepResult> {
  const lock = `run:${id}`;
  const token = await acquireLock(payload, lock, LEASE_MS);
  if (!token)
    return {
      progress: progressOf(await readRun(payload, id)),
      progressed: false,
    };
  // Kept while the step runs, however long it takes.
  const renewal = setInterval(
    () =>
      void renewLock(payload, lock, token, LEASE_MS).catch((error: unknown) =>
        payload.logger.warn(
          createGtPayloadDiagnostic({
            severity: 'Warning',
            whatHappened: 'Could not renew a translation run lock',
            reassurance: 'The step checks the lock again before saving',
            details: formatDiagnosticErrorDetails(error),
          })
        )
      ),
    LEASE_MS / 4
  );
  try {
    return await stepHeld(payload, gt, id, { key: lock, token });
  } finally {
    clearInterval(renewal);
    await releaseLock(payload, lock, token);
  }
}

// One step of a run this stepper holds the lock of.
async function stepHeld(
  payload: Payload,
  gt: GtClient,
  id: string | number,
  lock: { key: string; token: string }
): Promise<StepResult> {
  const run = await readRun(payload, id);
  if (run.status === 'done')
    return { progress: progressOf(run), progressed: false };
  let changes: Partial<Run> | null = null;
  let failed = false;
  try {
    const user = await userOf(payload, run);
    changes = run.pending.length
      ? await startNext(payload, gt, run, user)
      : await finishReady(payload, gt, run, user);
  } catch (error) {
    failed = true;
    payload.logger.error(
      createGtPayloadDiagnostic({
        severity: 'Error',
        whatHappened: 'A translation step failed',
        reassurance: 'The next step tries again',
        details: formatDiagnosticErrorDetails(error),
      })
    );
  }
  const failures = failed ? run.failures + 1 : 0;
  const next = { ...run, ...changes };
  // A run that keeps failing ends, with what is left counted as failed.
  const givenUp = failures >= MAX_FAILURES;
  const left = new Set(
    [...next.pending, ...next.jobs.map((job) => job.target)].map((t) =>
      JSON.stringify(t)
    )
  ).size;
  // A step whose lock another stepper took over leaves the run to it, which
  // repeats the step; saving here would overwrite its progress.
  if (!(await renewLock(payload, lock.key, lock.token, LEASE_MS)))
    return { progress: progressOf(run), progressed: false };
  await updateRun(payload, id, {
    ...changes,
    ...(givenUp && {
      pending: [],
      jobs: [],
      done: next.total,
      failedDocuments: next.failedDocuments + left,
    }),
    failures,
    status:
      givenUp || !(next.pending.length || next.jobs.length)
        ? 'done'
        : 'running',
  });
  return {
    progress: progressOf(await readRun(payload, id)),
    progressed: changes !== null,
  };
}

// Running runs nobody has stepped recently.
export async function staleRuns(payload: Payload): Promise<RunProgress[]> {
  const result = await payload.find({
    collection: RUNS_SLUG,
    where: {
      and: [
        { status: { equals: 'running' } },
        {
          updatedAt: {
            less_than: new Date(Date.now() - STALE_MS).toISOString(),
          },
        },
      ],
    },
    limit: 10,
    depth: 0,
  });
  return (result.docs as unknown as Run[]).map(progressOf);
}

// How long one job keeps stepping before it queues the next.
const JOB_BUDGET_MS = 25 * 1000;
// How long a job waits before checking GT again when nothing was ready.
const JOB_WAIT_MS = 5 * 1000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Payload's job for a run: steps it for a while, then queues itself again
// until the run is done.
export function runTask(
  client: (payload: Payload) => GtClient
): TaskConfig<{ input: { runId: string }; output: object }> {
  return {
    slug: RUN_TASK,
    inputSchema: [{ name: 'runId', type: 'text', required: true }],
    handler: async ({ input, req }) => {
      const { payload } = req;
      const gt = client(payload);
      const until = Date.now() + JOB_BUDGET_MS;
      let progress: RunProgress;
      do {
        const step = await stepRun({ payload, gt, id: input.runId });
        progress = step.progress;
        if (progress.status === 'done') return { output: {} };
        if (!step.progressed) await wait(JOB_WAIT_MS);
      } while (Date.now() < until);
      await payload.jobs.queue({
        task: RUN_TASK,
        input: { runId: input.runId },
      });
      return { output: {} };
    },
  };
}
