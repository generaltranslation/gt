import { parse, parseFragment, serialize } from 'parse5';
import type { DefaultTreeAdapterMap } from 'parse5';
import { ApiError } from 'generaltranslation/errors';
import type { GtClient } from '../../types';

type Element = DefaultTreeAdapterMap['element'];
type ChildNode = DefaultTreeAdapterMap['childNode'];
type ParentNode = DefaultTreeAdapterMap['parentNode'];

type Version = {
  versionId: string;
  content: string;
  fileName: string;
  translations: Map<string, { content: string; human: boolean }>;
};

type Job = { fileId: string; versionId: string; locale: string };

// The translated string a fake translation gives: every text node upper-cased.
export function fakeTranslate(html: string): string {
  const fragment = parseFragment(html);
  const visit = (node: ParentNode) => {
    for (const child of node.childNodes) {
      if (child.nodeName === '#text') {
        (child as DefaultTreeAdapterMap['textNode']).value = (
          child as DefaultTreeAdapterMap['textNode']
        ).value.toUpperCase();
      } else if ('childNodes' in child) visit(child as ParentNode);
    }
  };
  visit(fragment);
  return serialize(fragment);
}

// Key to inner HTML of every `data-gt-key` element in an HTML file.
export function readKeyedHtml(content: string): Map<string, string> {
  const out = new Map<string, string>();
  const visit = (node: ParentNode) => {
    for (const child of node.childNodes as ChildNode[]) {
      if (!('tagName' in child)) continue;
      const key = (child as Element).attrs.find(
        (a) => a.name === 'data-gt-key'
      )?.value;
      if (key !== undefined) out.set(key, serialize(child as Element));
      else visit(child as Element);
    }
  };
  visit(parse(content));
  return out;
}

function writeKeyedHtml(source: string, values: Map<string, string>): string {
  const document = parse(source);
  const visit = (node: ParentNode) => {
    for (const child of node.childNodes as ChildNode[]) {
      if (!('tagName' in child)) continue;
      const element = child as Element;
      const key = element.attrs.find((a) => a.name === 'data-gt-key')?.value;
      if (key !== undefined && values.has(key)) {
        element.childNodes = parseFragment(values.get(key)!).childNodes;
        element.childNodes.forEach((c) => {
          c.parentNode = element;
        });
      } else visit(element);
    }
  };
  visit(document);
  return serialize(document);
}

// What a lengthened translation adds.
const LONGER = ' AND THEN SOME MORE WORDS';

// Upper-cases a string and drops whole words until it fits maxChars.
function fitWords(text: string, maxChars: number): string {
  const words = text.toUpperCase().split(' ');
  while (words.length > 1 && words.join(' ').length > maxChars) words.pop();
  return words.join(' ');
}

// Removes every link tag from a string, keeping its text.
function dropLinks(html: string): string {
  return html.replace(/<a [^>]*>|<\/a>/g, '');
}

// Swaps the first and last top-level links, as a translation that reorders them.
function swapLinks(html: string): string {
  const fragment = parseFragment(html);
  const links = fragment.childNodes.filter((c) => c.nodeName === 'a');
  if (links.length < 2) return html;
  const first = fragment.childNodes.indexOf(links[0]);
  const last = fragment.childNodes.indexOf(links[links.length - 1]);
  [fragment.childNodes[first], fragment.childNodes[last]] = [
    fragment.childNodes[last],
    fragment.childNodes[first],
  ];
  return serialize(fragment);
}

/**
 * An in-memory GT for tests. Like the real pipeline, it uses a translation
 * already stored for the version first, then reuses a key's translation when
 * its source did not change from the previous translated version, and
 * otherwise translates it with the previous translation recorded as context.
 * Uploaded translations replace the version's translation.
 */
export class FakeGt {
  private files = new Map<string, Version[]>();
  private jobs = new Map<string, Job>();
  private nextJob = 0;

  // Called after enqueue and before translations are produced, as an editor
  // working in Payload while GT translates.
  duringTranslation: (() => Promise<void>) | null = null;
  // Strings whose translation comes back with its links dropped.
  breakMarkupWhen: (source: string) => boolean = () => false;
  // Strings whose translation reorders its links.
  swapLinksWhen: (source: string) => boolean = () => false;
  // Strings whose file translation comes back longer than the source.
  lengthenWhen: (source: string) => boolean = () => false;
  // How single-string translation treats a character limit: kept, ignored,
  // or the call fails.
  maxCharsMode: 'obey' | 'ignore' | 'fail' = 'obey';
  readonly translateManyCalls: {
    source: string;
    maxChars?: number;
    targetLocale: string;
  }[] = [];
  // Locales whose jobs fail.
  failLocales = new Set<string>();
  // Locales the project does not have: enqueue refuses the whole request.
  unsupportedLocales = new Set<string>();
  // When set, enqueue refuses the work as GT does at a plan's usage limit.
  usageLimitReached = false;
  // When set, every call fails as if GT were unreachable.
  unreachable = false;
  // Previous translation given as context, by fileId, locale and key.
  readonly contextUsed = new Map<string, string>();
  readonly uploadedSources: {
    fileId: string;
    fileName: string;
    content: string;
  }[] = [];
  // How many times each SDK method was called.
  readonly calls = {
    uploadSourceFiles: 0,
    enqueueFiles: 0,
    awaitJobs: 0,
    downloadFileBatch: 0,
    uploadTranslations: 0,
    checkJobStatus: 0,
    translateMany: 0,
  };
  private finished = new Map<
    string,
    { status: 'completed' | 'failed'; error?: { message: string } }
  >();
  readonly uploadedTranslations: {
    fileId: string;
    versionId: string;
    locale: string;
    content: string;
  }[] = [];

  latestSource(fileId: string): string | undefined {
    return this.files.get(fileId)?.at(-1)?.content;
  }

  fileIds(): string[] {
    return [...this.files.keys()];
  }

  private check() {
    if (this.unreachable) throw new Error('fetch failed');
  }

  private version(fileId: string, versionId?: string): Version | undefined {
    const versions = this.files.get(fileId) ?? [];
    return versionId
      ? versions.find((v) => v.versionId === versionId)
      : versions.at(-1);
  }

  private translate({ fileId, versionId, locale }: Job) {
    const versions = this.files.get(fileId)!;
    const index = versions.findIndex((v) => v.versionId === versionId);
    const current = versions[index];
    const previous = versions
      .slice(0, index)
      .reverse()
      .find((v) => v.translations.has(locale));
    const previousSource = previous
      ? readKeyedHtml(previous.content)
      : new Map<string, string>();
    const previousTranslation = previous
      ? readKeyedHtml(previous.translations.get(locale)!.content)
      : new Map<string, string>();
    // A translation already stored for this version (an upload) is used
    // first, string by string; only strings it lacks are translated.
    const stored = current.translations.get(locale);
    const storedValues = stored
      ? readKeyedHtml(stored.content)
      : new Map<string, string>();
    const values = new Map<string, string>();
    for (const [key, source] of readKeyedHtml(current.content)) {
      if (storedValues.get(key)) {
        values.set(key, storedValues.get(key)!);
        continue;
      }
      if (previousSource.get(key) === source && previousTranslation.has(key)) {
        values.set(key, previousTranslation.get(key)!);
        continue;
      }
      if (previousTranslation.has(key)) {
        this.contextUsed.set(
          `${fileId}|${locale}|${key}`,
          previousTranslation.get(key)!
        );
      }
      let translated = fakeTranslate(source);
      if (this.lengthenWhen(source)) translated += LONGER;
      if (this.swapLinksWhen(source)) translated = swapLinks(translated);
      if (this.breakMarkupWhen(source)) translated = dropLinks(translated);
      values.set(key, translated);
    }
    current.translations.set(locale, {
      content: writeKeyedHtml(current.content, values),
      human: false,
    });
  }

  readonly uploadSourceFiles: GtClient['uploadSourceFiles'] = async (files) => {
    this.check();
    this.calls.uploadSourceFiles += 1;
    const uploadedFiles = files.map(({ source }) => {
      const fileId = source.fileId!;
      const versions = this.files.get(fileId) ?? [];
      this.files.set(fileId, versions);
      this.uploadedSources.push({
        fileId,
        fileName: source.fileName,
        content: source.content,
      });
      let version = versions.at(-1);
      if (!version || version.content !== source.content) {
        version = {
          versionId: `${fileId}@${versions.length + 1}`,
          content: source.content,
          fileName: source.fileName,
          translations: new Map(),
        };
        versions.push(version);
      }
      return {
        fileId,
        versionId: version.versionId,
        branchId: 'main',
        fileName: source.fileName,
        fileFormat: source.fileFormat,
      };
    });
    return { uploadedFiles, count: uploadedFiles.length, message: 'ok' };
  };

  readonly enqueueFiles: GtClient['enqueueFiles'] = async (files, options) => {
    this.check();
    this.calls.enqueueFiles += 1;
    if (this.usageLimitReached) {
      const message =
        'Translating 511 tokens would exceed your free usage limit for this month.';
      throw new ApiError(message, 402, message);
    }
    const unsupported = (options.targetLocales ?? []).filter((l) =>
      this.unsupportedLocales.has(l)
    );
    if (unsupported.length) {
      throw new Error(
        `Target locale(s) not authorized: ${unsupported.join(', ')}.`
      );
    }
    const jobData: Awaited<ReturnType<GtClient['enqueueFiles']>>['jobData'] =
      {};
    for (const file of files) {
      for (const locale of options.targetLocales ?? []) {
        // Like GT, no job when the version already has this locale.
        if (
          this.version(file.fileId, file.versionId!)?.translations.has(locale)
        )
          continue;
        const jobId = `job-${(this.nextJob += 1)}`;
        this.jobs.set(jobId, {
          fileId: file.fileId,
          versionId: file.versionId!,
          locale,
        });
        jobData[jobId] = {
          sourceFileId: file.fileId,
          fileId: file.fileId,
          versionId: file.versionId!,
          branchId: 'main',
          targetLocale: locale,
          projectId: 'test-project',
          force: false,
        };
      }
    }
    return { jobData } as Awaited<ReturnType<GtClient['enqueueFiles']>>;
  };

  // Jobs finish the first time anyone waits on or checks them.
  private async finish(ids: string[]) {
    const pending = ids.filter((id) => !this.finished.has(id));
    if (pending.length && this.duringTranslation)
      await this.duringTranslation();
    for (const jobId of pending) {
      const job = this.jobs.get(jobId)!;
      if (this.failLocales.has(job.locale)) {
        this.finished.set(jobId, {
          status: 'failed',
          error: { message: 'translation failed' },
        });
        continue;
      }
      this.translate(job);
      this.finished.set(jobId, { status: 'completed' });
    }
    return ids.map((jobId) => ({ jobId, ...this.finished.get(jobId)! }));
  }

  readonly awaitJobs: GtClient['awaitJobs'] = async (jobs) => {
    this.check();
    this.calls.awaitJobs += 1;
    const ids = Array.isArray(jobs) ? jobs : Object.keys(jobs.jobData);
    return { complete: true, jobs: await this.finish(ids) };
  };

  readonly checkJobStatus: GtClient['checkJobStatus'] = async (jobIds) => {
    this.check();
    this.calls.checkJobStatus += 1;
    return this.finish(jobIds);
  };

  readonly downloadFileBatch: GtClient['downloadFileBatch'] = async (
    requests
  ) => {
    this.check();
    this.calls.downloadFileBatch += 1;
    const files = requests.flatMap((request) => {
      const version = this.version(request.fileId, request.versionId);
      if (!version) return [];
      const data = request.locale
        ? version.translations.get(request.locale)?.content
        : version.content;
      if (data === undefined) return [];
      return [
        {
          id: `${request.fileId}:${version.versionId}:${request.locale ?? ''}`,
          branchId: 'main',
          fileId: request.fileId,
          versionId: version.versionId,
          locale: request.locale,
          fileName: version.fileName,
          data,
          metadata: {},
          fileFormat: 'HTML' as const,
        },
      ];
    });
    return { files, count: files.length };
  };

  readonly translateMany = (async (
    sources: (string | { source: unknown; metadata?: { maxChars?: number } })[],
    options: string | { targetLocale: string }
  ) => {
    this.check();
    this.calls.translateMany += 1;
    const targetLocale =
      typeof options === 'string' ? options : options.targetLocale;
    if (this.maxCharsMode === 'fail') throw new Error('translate failed');
    return sources.map((entry) => {
      const source = String(typeof entry === 'string' ? entry : entry.source);
      const maxChars =
        typeof entry === 'string' ? undefined : entry.metadata?.maxChars;
      this.translateManyCalls.push({ source, maxChars, targetLocale });
      const translation =
        this.maxCharsMode === 'obey' && maxChars !== undefined
          ? fitWords(source, maxChars)
          : source.toUpperCase() + LONGER;
      return {
        success: true as const,
        translation,
        dataFormat: 'STRING' as const,
        locale: targetLocale,
      };
    });
  }) as unknown as GtClient['translateMany'];

  readonly uploadTranslations: GtClient['uploadTranslations'] = async (
    files
  ) => {
    this.check();
    this.calls.uploadTranslations += 1;
    for (const { source, translations } of files) {
      const version = this.version(source.fileId!, source.versionId);
      if (!version) throw new Error('source version not found');
      for (const translation of translations) {
        version.translations.set(translation.locale, {
          content: translation.content,
          human: true,
        });
        this.uploadedTranslations.push({
          fileId: source.fileId!,
          versionId: version.versionId,
          locale: translation.locale,
          content: translation.content,
        });
      }
    }
    return { uploadedFiles: [], count: files.length, message: 'ok' };
  };
}
