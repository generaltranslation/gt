// Translating documents in three steps that each fit in one short request:
// start (read, upload, enqueue), check (job statuses) and finish (download
// and save into Payload). translateDocument and translateSite run all three.
import { formatDiagnosticErrorDetails } from 'generaltranslation/diagnostics';
import { ApiError } from 'generaltranslation/errors';
import type { Payload } from 'payload';
import type { FileReference } from 'generaltranslation/types';
import {
  collectUnits,
  fileKey,
  readFile,
  sourceFile,
  targetFile,
  type Unit,
} from './content/file';
import { walkFields } from './content/fields';
import { readPlainText } from './content/html';
import { decodeElement } from './content/inline';
import { createGtPayloadDiagnostic } from './diagnostics';
import { fitToLimits, type OverLimit } from './limits';
import { targetKey } from './targets';
import {
  fieldContext,
  fileNameOf,
  listSiteTargets,
  readDocument,
  resolveTarget,
  sourceLocaleOf,
  writeDocument,
  type Access,
  type ResolvedTarget,
} from './documents';
import type {
  Data,
  GtClient,
  LocaleResult,
  SkippedString,
  TranslateResult,
  TranslateTarget,
} from './types';

export type TranslateDocumentInput = {
  payload: Payload;
  gt: GtClient;
  target: TranslateTarget;
  locales: string[];
  // Runs saveTranslations first for documents GT has, so edits made in
  // Payload are kept and used as context.
  saveLocalEdits?: boolean;
} & Access;

export type TranslateSiteInput = Omit<TranslateDocumentInput, 'target'>;

export type TargetsInput = TranslateSiteInput & { targets: TranslateTarget[] };

export type DocumentResult<T> = { target: TranslateTarget; result: T };

export type SiteResult = {
  error?: string;
  documents: DocumentResult<TranslateResult>[];
};

export type SaveTranslationsResult = {
  // Absent when GT could not be reached.
  error?: string;
  locales: Record<
    string,
    | { status: 'saved' }
    // The locale has no text in Payload for this document.
    | { status: 'no_translations' }
    | { status: 'failed'; error: string }
  >;
};

// One locale of one document. Without a job id, GT already had the
// translation and queued nothing, so it is ready to download.
export type TranslationJob = {
  jobId?: string;
  target: TranslateTarget;
  fileId: string;
  versionId: string;
  branchId: string;
  locale: string;
};

export type JobStatus = { jobId: string; status: string; error?: string };

export type StartResult = {
  jobs: TranslationJob[];
  // Documents already finished at the start: not found, nothing to
  // translate (no locales), or refused by GT.
  documents: DocumentResult<TranslateResult>[];
};

// A document read and serialized, ready to send.
type Prepared = ResolvedTarget & {
  units: Unit[];
  source: Data;
  fileName: string;
};

type Batch = {
  payload: Payload;
  gt: GtClient;
  sourceLocale: string;
  locales: string[];
  access: Access;
};

const FILE_FORMAT = 'HTML' as const;
// Saves into Payload run a few documents at a time.
const WRITE_CONCURRENCY = 4;
const JOB_TIMEOUT_SECONDS = 60 * 60;

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

async function inPool<T>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<void>
) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await run(items[(next += 1) - 1]);
    })
  );
}

function batchFor(
  payload: Payload,
  gt: GtClient,
  locales: string[],
  access: Access
): Batch {
  const sourceLocale = sourceLocaleOf(payload);
  return {
    payload,
    gt,
    sourceLocale,
    locales: [...new Set(locales)].filter((l) => l !== sourceLocale),
    access,
  };
}

// Reads each target in the source locale and serializes it. Missing documents
// get an error; documents with nothing to translate finish with no locales.
async function prepare(batch: Batch, targets: TranslateTarget[]) {
  const ctx = fieldContext(batch.payload);
  const prepared: Prepared[] = [];
  const done: DocumentResult<TranslateResult>[] = [];
  for (const target of targets) {
    try {
      const resolved = resolveTarget(batch.payload, target);
      const source = await readDocument(
        batch.payload,
        target,
        batch.sourceLocale,
        batch.access
      );
      if (!source) {
        done.push({
          target,
          result: { error: 'The document does not exist.', locales: {} },
        });
        continue;
      }
      const units = collectUnits(resolved.fields, source, undefined, ctx);
      if (units.length)
        prepared.push({
          ...resolved,
          units,
          source,
          fileName: fileNameOf(batch.payload, target, source),
        });
      else done.push({ target, result: { locales: {} } });
    } catch (error) {
      done.push({
        target,
        result: { error: errorMessage(error), locales: {} },
      });
    }
  }
  return { prepared, done };
}

const fileReference = (
  doc: Prepared,
  ref: { versionId: string; branchId: string }
) => ({
  fileId: doc.fileId,
  versionId: ref.versionId,
  branchId: ref.branchId,
  fileName: doc.fileName,
  fileFormat: FILE_FORMAT,
});

async function uploadSources(batch: Batch, docs: Prepared[]) {
  const uploaded = await batch.gt.uploadSourceFiles(
    docs.map((doc) => ({
      source: {
        content: sourceFile(doc.units),
        fileName: doc.fileName,
        fileFormat: FILE_FORMAT,
        locale: batch.sourceLocale,
        fileId: doc.fileId,
      },
    })),
    { sourceLocale: batch.sourceLocale }
  );
  return new Map(uploaded.uploadedFiles.map((file) => [file.fileId, file]));
}

// Each locale's current text in Payload for a document, as files.
async function targetFiles(batch: Batch, doc: Prepared) {
  const ctx = fieldContext(batch.payload);
  const files = new Map<string, string | null>();
  for (const locale of batch.locales) {
    const target = await readDocument(
      batch.payload,
      doc.target,
      locale,
      batch.access
    );
    files.set(
      locale,
      target
        ? targetFile(collectUnits(doc.fields, doc.source, target, ctx))
        : null
    );
  }
  return files;
}

type TranslationUpload = Parameters<GtClient['uploadTranslations']>[0][number];

// Sends each document's current translations as the translation of a
// version, and reports per locale whether there was anything to send.
async function sendTranslations(
  batch: Batch,
  docs: { doc: Prepared; version: FileReference; sourceContent: string }[]
) {
  const sent = new Map<string, Map<string, boolean>>();
  const uploads: TranslationUpload[] = [];
  for (const { doc, version, sourceContent } of docs) {
    const files = await targetFiles(batch, doc);
    sent.set(
      doc.fileId,
      new Map([...files].map(([locale, content]) => [locale, content !== null]))
    );
    const translations = [...files].flatMap(([locale, content]) =>
      content === null ? [] : [{ ...version, locale, content }]
    );
    if (translations.length)
      uploads.push({
        source: {
          ...version,
          locale: batch.sourceLocale,
          content: sourceContent,
        },
        translations,
      });
  }
  if (uploads.length)
    await batch.gt.uploadTranslations(uploads, {
      sourceLocale: batch.sourceLocale,
    });
  return sent;
}

// The latest version GT holds of each document, with its source content.
async function latestVersions(batch: Batch, docs: Prepared[]) {
  const latest = await batch.gt.downloadFileBatch(
    docs.map((doc) => ({ fileId: doc.fileId }))
  );
  return new Map(
    latest.files.filter((f) => !f.locale).map((file) => [file.fileId, file])
  );
}

// Sends each locale's current text in Payload to GT as a translation: of the
// version GT holds when it has the document, otherwise of the current source,
// uploaded first, unless onlyKnown. GT treats the upload as that version's
// complete translation. Nothing is translated.
async function saveToGt(
  batch: Batch,
  docs: Prepared[],
  { onlyKnown = false } = {}
) {
  if (!docs.length) return new Map<string, Map<string, boolean>>();
  const latest = await latestVersions(batch, docs);
  const unknown = onlyKnown
    ? []
    : docs.filter((doc) => !latest.has(doc.fileId));
  const sending = docs.filter(
    (doc) => latest.has(doc.fileId) || unknown.includes(doc)
  );
  const uploaded = unknown.length
    ? await uploadSources(batch, unknown)
    : new Map<string, FileReference>();
  return sendTranslations(
    batch,
    sending.map((doc) => {
      const held = latest.get(doc.fileId);
      return held
        ? { doc, version: fileReference(doc, held), sourceContent: held.data }
        : {
            doc,
            version: fileReference(doc, uploaded.get(doc.fileId)!),
            sourceContent: sourceFile(doc.units),
          };
    })
  );
}

// Strings not written: broken markup, translations whose place is gone (named
// by file key, since their field path no longer exists), and strings the
// translation lacks.
function skippedFor(
  units: Unit[],
  translations: Map<string, string>,
  applied: Set<string>,
  broken: Set<string>
): SkippedString[] {
  const used = new Set([...applied, ...broken].map(fileKey));
  return [
    ...[...broken].map((key) => ({ key, reason: 'broken_markup' as const })),
    ...[...translations.keys()]
      .filter((key) => !used.has(key))
      .map((key) => ({ key, reason: 'removed' as const })),
    ...units
      .filter((u) => !translations.has(fileKey(u.key)))
      .map((u) => ({ key: u.key, reason: 'missing' as const })),
  ];
}

// Rebuilds the locale from the document as it is now and saves it.
async function applyTranslation(
  batch: Batch,
  doc: ResolvedTarget,
  locale: string,
  translations: Map<string, string>
): Promise<LocaleResult> {
  const source = await readDocument(
    batch.payload,
    doc.target,
    batch.sourceLocale,
    batch.access
  );
  if (!source)
    return { status: 'failed', error: 'The document no longer exists.' };
  const target =
    (await readDocument(batch.payload, doc.target, locale, batch.access)) ??
    undefined;
  const ctx = fieldContext(batch.payload);
  const applied = new Set<string>();
  const broken = new Set<string>();
  const plainText = (key: string) => {
    const html = translations.get(fileKey(key));
    return html === undefined ? undefined : readPlainText(html);
  };
  // First pass: translations longer than their field allows.
  const over: OverLimit[] = [];
  walkFields(
    doc.fields,
    source,
    target,
    '',
    false,
    {
      text(key, sourceText, _target, limit) {
        const text = plainText(key);
        if (limit && text && text.length > limit.maxChars)
          over.push({ key, source: sourceText, translation: text, limit });
        return undefined;
      },
      element: () => undefined,
    },
    ctx
  );
  const fitted = await fitToLimits(
    batch.gt,
    over,
    { locale, sourceLocale: batch.sourceLocale },
    (error) =>
      batch.payload.logger.warn(
        createGtPayloadDiagnostic({
          severity: 'Warning',
          whatHappened:
            'Could not translate again the translations that run over their field length',
          reassurance: 'Translations over a maxLength were cut to fit instead',
          details: formatDiagnosticErrorDetails(error),
        })
      )
  );
  const rebuilt = walkFields(
    doc.fields,
    source,
    target,
    '',
    false,
    {
      text(key) {
        const text = fitted.get(key) ?? plainText(key);
        if (text === undefined) return undefined;
        if (text === null) broken.add(key);
        else applied.add(key);
        return text ?? undefined;
      },
      element(key, encoded) {
        const html = translations.get(fileKey(key));
        if (html === undefined) return undefined;
        const decoded = decodeElement(html, encoded);
        if ('problems' in decoded) {
          broken.add(key);
          return undefined;
        }
        applied.add(key);
        return decoded.children;
      },
    },
    ctx
  );
  if (rebuilt.changed)
    await writeDocument(
      batch.payload,
      doc.target,
      locale,
      rebuilt.value,
      batch.access
    );
  const sent = collectUnits(doc.fields, source, undefined, ctx);
  return {
    status: 'applied',
    applied: [...applied],
    skipped: skippedFor(sent, translations, applied, broken),
  };
}

const failedLocales = (locales: string[], error: string): TranslateResult => ({
  error,
  locales: Object.fromEntries(
    locales.map((locale) => [locale, { status: 'failed' as const, error }])
  ),
});

// Reads and uploads the documents and puts them in GT's queue.
export async function startTranslation({
  payload,
  gt,
  targets,
  locales,
  saveLocalEdits = false,
  user,
}: TargetsInput): Promise<StartResult> {
  const batch = batchFor(payload, gt, locales, { user });
  const { prepared, done } = await prepare(batch, targets);
  if (!prepared.length || !batch.locales.length) {
    return {
      jobs: [],
      documents: [
        ...done,
        ...prepared.map((doc) => ({
          target: doc.target,
          result: { locales: {} },
        })),
      ],
    };
  }
  try {
    // Only documents GT has: an upload for a new one would count as its
    // complete translation and leave missing strings untranslated.
    if (saveLocalEdits) await saveToGt(batch, prepared, { onlyKnown: true });
    const refs = await uploadSources(batch, prepared);
    const enqueued = await gt.enqueueFiles(
      [...refs.values()].map((ref) => ({
        fileId: ref.fileId,
        versionId: ref.versionId,
        branchId: ref.branchId,
        fileName: ref.fileName,
        fileFormat: FILE_FORMAT,
      })),
      { sourceLocale: batch.sourceLocale, targetLocales: batch.locales }
    );
    const queued = Object.entries(enqueued.jobData).map(([jobId, job]) => ({
      jobId,
      target: prepared.find((doc) => doc.fileId === job.fileId)!.target,
      fileId: job.fileId,
      versionId: job.versionId,
      branchId: job.branchId,
      locale: job.targetLocale,
    }));
    const isQueued = new Set(
      queued.map((job) => `${job.fileId}|${job.locale}`)
    );
    const ready = prepared.flatMap((doc) => {
      const ref = refs.get(doc.fileId)!;
      return batch.locales
        .filter((locale) => !isQueued.has(`${doc.fileId}|${locale}`))
        .map((locale) => ({
          target: doc.target,
          fileId: doc.fileId,
          versionId: ref.versionId,
          branchId: ref.branchId,
          locale,
        }));
    });
    return { jobs: [...queued, ...ready], documents: done };
  } catch (error) {
    const message = errorMessage(error);
    // GT answers 402 only when billing stops the work.
    const usageLimitReached = error instanceof ApiError && error.code === 402;
    return {
      jobs: [],
      documents: [
        ...done,
        ...prepared.map((doc) => ({
          target: doc.target,
          result: {
            ...failedLocales(batch.locales, message),
            ...(usageLimitReached && { usageLimitReached: true as const }),
          },
        })),
      ],
    };
  }
}

// The current status of each job.
export async function checkTranslation({
  gt,
  jobIds,
}: {
  gt: GtClient;
  jobIds: string[];
}): Promise<JobStatus[]> {
  const statuses = await gt.checkJobStatus(jobIds);
  return statuses.map((s) => ({
    jobId: s.jobId,
    status: s.status,
    error: s.error?.message,
  }));
}

// Downloads finished jobs and saves them into Payload. Jobs that did not
// complete are reported as failed.
export async function finishTranslation({
  payload,
  gt,
  jobs,
  statuses,
  user,
}: {
  payload: Payload;
  gt: GtClient;
  jobs: TranslationJob[];
  statuses: JobStatus[];
} & Access): Promise<DocumentResult<TranslateResult>[]> {
  const batch = batchFor(payload, gt, [...new Set(jobs.map((j) => j.locale))], {
    user,
  });
  const status = new Map<string | undefined, JobStatus>(
    statuses.map((s) => [s.jobId, s])
  );
  const statusOf = (job: TranslationJob): JobStatus | undefined =>
    job.jobId ? status.get(job.jobId) : { jobId: '', status: 'completed' };
  const completed = jobs.filter((job) => statusOf(job)?.status === 'completed');
  const downloads = completed.length
    ? await gt.downloadFileBatch(
        completed.map((job) => ({
          fileId: job.fileId,
          versionId: job.versionId,
          branchId: job.branchId,
          locale: job.locale,
        }))
      )
    : { files: [] };
  const contents = new Map(
    downloads.files.map((file) => [`${file.fileId}|${file.locale}`, file.data])
  );
  const byFile = new Map<string, TranslationJob[]>();
  for (const job of jobs)
    byFile.set(job.fileId, [...(byFile.get(job.fileId) ?? []), job]);

  const results: DocumentResult<TranslateResult>[] = [];
  // Documents are saved a few at a time, and one document's locales one
  // after another: each save carries the other locales from the version it
  // started from, so parallel saves of one document lose locales.
  await inPool([...byFile.values()], WRITE_CONCURRENCY, async (fileJobs) => {
    const target = fileJobs[0].target;
    const result: TranslateResult = { locales: {} };
    results.push({ target, result });
    const doc = resolveTarget(payload, target);
    for (const job of fileJobs) {
      const jobStatus = statusOf(job);
      const content = contents.get(`${job.fileId}|${job.locale}`);
      if (jobStatus?.status !== 'completed' || content === undefined) {
        result.locales[job.locale] = {
          status: 'failed',
          error:
            jobStatus?.error ??
            `Translation did not finish (${jobStatus?.status ?? 'unknown'}).`,
        };
        continue;
      }
      try {
        result.locales[job.locale] = await applyTranslation(
          batch,
          doc,
          job.locale,
          readFile(content)
        );
      } catch (error) {
        result.locales[job.locale] = {
          status: 'failed',
          error: errorMessage(error),
        };
      }
    }
  });
  return results;
}

// All three steps, waiting on GT in between.
async function translateTargets(input: TargetsInput) {
  const started = await startTranslation(input);
  if (!started.jobs.length) return started.documents;
  const jobIds = started.jobs.flatMap((j) => (j.jobId ? [j.jobId] : []));
  const done = jobIds.length
    ? await input.gt.awaitJobs(jobIds, { timeoutSeconds: JOB_TIMEOUT_SECONDS })
    : { jobs: [] };
  const statuses = done.jobs.map((j) => ({
    jobId: j.jobId,
    status: j.status,
    error: j.error?.message,
  }));
  return [
    ...started.documents,
    ...(await finishTranslation({ ...input, jobs: started.jobs, statuses })),
  ];
}

// Sends a document's readable text to GT, waits, and saves the translations
// into each locale's slots.
export async function translateDocument({
  target,
  ...input
}: TranslateDocumentInput): Promise<TranslateResult> {
  const documents = await translateTargets({ ...input, targets: [target] });
  return (
    documents.find((d) => targetKey(d.target) === targetKey(target))
      ?.result ?? {
      locales: {},
    }
  );
}

// Translates every document in every collection and global with localized
// fields, each as its own file, in one batch. Documents with nothing to
// translate are left out.
export async function translateSite(
  input: TranslateSiteInput
): Promise<SiteResult> {
  const targets = await listSiteTargets(input.payload, { user: input.user });
  const documents = await translateTargets({ ...input, targets });
  return {
    documents: documents.filter(
      (d) => d.result.error || Object.keys(d.result.locales).length
    ),
  };
}

// saveTranslations for a list of documents, in one batch.
export async function saveDocuments(input: TargetsInput) {
  const batch = batchFor(input.payload, input.gt, input.locales, {
    user: input.user,
  });
  const { prepared, done } = await prepare(batch, input.targets);
  // Documents with nothing to translate have nothing to save either.
  const results: DocumentResult<SaveTranslationsResult>[] = done
    .filter(({ result }) => result.error)
    .map(({ target, result }) => ({
      target,
      result: { error: result.error, locales: {} },
    }));
  try {
    const sent = await saveToGt(batch, prepared);
    for (const doc of prepared) {
      const locales = Object.fromEntries(
        batch.locales.map((locale) => [
          locale,
          sent.get(doc.fileId)?.get(locale)
            ? { status: 'saved' as const }
            : { status: 'no_translations' as const },
        ])
      );
      results.push({ target: doc.target, result: { locales } });
    }
  } catch (error) {
    results.push(
      ...prepared.map((doc) => ({
        target: doc.target,
        result: { error: errorMessage(error), locales: {} },
      }))
    );
  }
  return results;
}

// Saves each locale's current text in Payload to GT, so later runs keep it:
// edits made in Payload, or translations made before GT. Nothing is
// translated and nothing is written to Payload.
export async function saveTranslations({
  target,
  ...input
}: TranslateDocumentInput): Promise<SaveTranslationsResult> {
  const results = await saveDocuments({ ...input, targets: [target] });
  return (
    results.find((d) => targetKey(d.target) === targetKey(target))?.result ?? {
      locales: {},
    }
  );
}

// saveTranslations for every document translateSite covers, in one batch.
export async function saveSiteTranslations(input: TranslateSiteInput) {
  const targets = await listSiteTargets(input.payload, { user: input.user });
  return { documents: await saveDocuments({ ...input, targets }) };
}
