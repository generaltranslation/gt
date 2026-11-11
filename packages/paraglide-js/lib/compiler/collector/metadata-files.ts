import { randomUUID } from 'node:crypto';
import fsp from 'node:fs/promises';
import type { FileUsages } from '../analysis/types.js';
import type { MessageFile } from '../inlang/message-file.js';
import { readInlangProject, type InlangProject } from '../inlang/project.js';
import { metadataPath, renderMetadataFile } from '../output/metadata.js';
import { parseJsonObject } from '../utils/json.js';
import { relativePath } from '../utils/paths.js';

/** A metadata file that was left as it is, and why. */
export type SkippedFile = { file: string; reason: string };

type Registry = Map<string, MetadataFiles>;

type ProjectMessageFile = { project: InlangProject; messageFile: MessageFile };

const REGISTRY = Symbol.for('paraglide-context/metadata-files');
/** What a metadata file that does not exist counts as, so that none is created for nothing. */
const NO_METADATA = '{}\n';

/**
 * The metadata files of a project's messages, shared by every collector in the
 * process that analyzes the project.
 *
 * Frameworks run several bundler instances at once or one after another
 * (Nuxt's client and server, Astro's build-info server and build, Next.js's
 * client, server and edge compilers). Each sees part of the app, so the files
 * hold, for each source file, the analysis that ran last, whichever instance
 * ran it. Writes are serialized, and atomic for readers.
 */
export class MetadataFiles {
  /** By absolute path; `undefined` once a file has no usages, or is gone. */
  private readonly entries = new Map<string, FileUsages | undefined>();
  /** Absolute inlang project directories. */
  private readonly projects = new Set<string>();
  private queue: Promise<unknown> = Promise.resolve();

  private constructor(
    private readonly projectRoot: string,
    private readonly radius: number
  ) {}

  /** The shared instance for `projectRoot`. The first caller's `radius` is used. */
  static for(projectRoot: string, radius: number): MetadataFiles {
    const global = globalThis as { [REGISTRY]?: Registry };
    const registry = (global[REGISTRY] ??= new Map());
    let files = registry.get(projectRoot);
    if (!files) {
      files = new MetadataFiles(projectRoot, radius);
      registry.set(projectRoot, files);
    }

    return files;
  }

  /** Each message file of the inlang project at `directory` (absolute) gets a metadata file. */
  addProject(directory: string): void {
    this.projects.add(directory);
  }

  /** Records the analysis of `file` (absolute); `undefined` when it has no usages. */
  set(file: string, usages: FileUsages | undefined): void {
    this.entries.set(file, usages);
  }

  /** Forgets files that no longer exist, e.g. deleted while another instance ran. */
  prune(exists: (file: string) => boolean): void {
    for (const file of this.entries.keys()) {
      if (!exists(file)) this.entries.delete(file);
    }
  }

  /** Writes the files whose content changed. Resolves with those it had to skip. */
  write(): Promise<SkippedFile[]> {
    const written = this.queue.then(() => this.writeAll());
    // A write that fails does not stop the ones after it.
    this.queue = written.catch(() => undefined);

    return written;
  }

  private async writeAll(): Promise<SkippedFile[]> {
    const messageFiles = await this.messageFiles();
    const results = await Promise.all(
      messageFiles.map((messageFile) => this.writeMetadataOf(messageFile))
    );

    return results.filter((skipped) => skipped !== undefined);
  }

  /** Read anew for each write: message files change while the collector runs. */
  private async messageFiles(): Promise<ProjectMessageFile[]> {
    const directories = [...this.projects].sort();
    const projects = await Promise.all(directories.map(readInlangProject));

    return projects
      .filter((project) => project !== undefined)
      .flatMap((project) =>
        project.messageFiles.map((messageFile) => ({ project, messageFile }))
      );
  }

  /** Returns the file if it was skipped. */
  private async writeMetadataOf({
    project,
    messageFile,
  }: ProjectMessageFile): Promise<SkippedFile | undefined> {
    const file = metadataPath(messageFile.path);
    const current =
      (await fsp.readFile(file, 'utf8').catch(() => undefined)) ?? NO_METADATA;
    const existing = parseJsonObject(current);
    // Overwriting it could lose hand-written fields.
    if (!existing) {
      return { file, reason: 'it is not a JSON object; fix or delete it' };
    }

    const metadata = renderMetadataFile({
      keys: messageFile.keys,
      sourceFiles: this.sourceFiles(),
      inlangProject: relativePath(this.projectRoot, project.directory),
      radius: this.radius,
      existing,
    });
    const content = `${JSON.stringify(metadata, null, 2)}\n`;
    if (content === current) return undefined;

    await writeAtomically(file, content);

    return undefined;
  }

  /** Every source file with usages. */
  private sourceFiles(): FileUsages[] {
    return [...this.entries.values()].filter((usages) => usages !== undefined);
  }
}

async function writeAtomically(file: string, content: string): Promise<void> {
  // A unique name: other processes may write the same file.
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await fsp.writeFile(temporary, content);
  await fsp.rename(temporary, file);
}
