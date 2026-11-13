import { getSystemErrorMap } from 'node:util';
import type {
  NativeMetadataResult,
  NativeSystemError,
} from '../analysis/native.js';
import type { InlangProject } from '../inlang/project.js';
import {
  metadataPath,
  nativeKeys,
  tooDeepError,
  type MetadataInput,
} from '../output/metadata.js';
import { relativePath } from '../utils/paths.js';
import { compareText } from '../utils/sort.js';

/** A metadata file that was left as it is, and why. */
export type SkippedFile = { file: string; reason: string };

/** What writes the files: the analysis, which kept the code and usages of the files it analyzed. */
export type MetadataWriter = {
  writeMetadata(
    input: MetadataInput,
    radius: number
  ): Promise<NativeMetadataResult>;
};

/**
 * The metadata files of a project's messages: next to each message file, the
 * source code around the usages of its messages. The analysis writes them;
 * this tells it which files and projects there are. Writes are atomic for
 * readers, and a file whose content did not change is not written.
 */
export class MetadataFiles {
  /** By absolute directory. */
  private readonly projects = new Map<string, InlangProject>();
  /** The analyzed files with usages, absolute. */
  private readonly sources = new Set<string>();
  /** By message file that usages resolve to: the directory of the inlang project they count for. */
  private readonly targetProjects = new Map<string, string>();

  constructor(
    private readonly projectRoot: string,
    private readonly radius: number
  ) {}

  /** Each message file of `project` gets a metadata file. */
  addProject(project: InlangProject): void {
    this.projects.set(project.directory, project);
  }

  /** Records that `file` (absolute) has usages: the analysis kept them. */
  add(file: string): void {
    this.sources.add(file);
  }

  /** Usages of the messages in `targetFile` count for the inlang project in `directory`. */
  addTarget(targetFile: string, directory: string): void {
    this.targetProjects.set(targetFile, directory);
  }

  /**
   * Writes the files whose content changed. Resolves with those it had to
   * skip, and the analyzed files that changed since, whose snippets it left out.
   */
  async write(
    writer: MetadataWriter
  ): Promise<{ skipped: SkippedFile[]; changed: string[] }> {
    if (this.projects.size === 0) return { skipped: [], changed: [] };

    const { skipped, failure, tooDeep, changed } = await writer.writeMetadata(
      this.input(),
      this.radius
    );
    if (failure) throw systemError(failure);
    if (tooDeep) throw tooDeepError();

    return {
      skipped: skipped.map(({ file, error }) => ({
        file,
        reason: error
          ? `it could not be read (${systemError(error).code})`
          : 'it is not a JSON object; fix or delete it',
      })),
      changed,
    };
  }

  private input(): MetadataInput {
    const relative = (file: string) => relativePath(this.projectRoot, file);
    const projects = [...this.projects.values()].sort((a, b) =>
      compareText(a.directory, b.directory)
    );

    return {
      files: [...this.sources],
      names: [...this.sources].map(relative),
      targets: [...this.targetProjects.keys()],
      targetProjects: [...this.targetProjects.values()].map(relative),
      projects: projects.map((project) => ({
        inlangProject: relative(project.directory),
        messageFiles: project.messageFiles.map((file) => ({
          metadata: metadataPath(file.path),
          keys: nativeKeys(file.keys),
        })),
      })),
    };
  }
}

/** An error like those of `node:fs`, for a system call of the analysis that failed. */
function systemError(failed: NativeSystemError): NodeJS.ErrnoException {
  const errno = failed.errno ?? undefined;
  const known =
    errno === undefined ? undefined : getSystemErrorMap().get(-errno);
  const [code, description] = known ?? [failed.code, 'unknown error'];

  const paths = [failed.path, failed.dest]
    .filter((path) => path != null)
    .map((path) => `'${path}'`)
    .join(' -> ');
  const error: NodeJS.ErrnoException = new Error(
    `${code}: ${description}, ${failed.syscall}${paths && ` ${paths}`}`
  );

  return Object.assign(error, {
    errno: errno === undefined ? undefined : -errno,
    code,
    syscall: failed.syscall,
    ...(failed.path != null && { path: failed.path }),
    ...(failed.dest != null && { dest: failed.dest }),
  });
}
