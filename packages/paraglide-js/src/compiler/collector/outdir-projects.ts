import { findInlangProjects } from '../inlang/find.js';
import { matchInlangProject } from '../inlang/match.js';
import {
  readInlangProject,
  readInlangProjects,
  type InlangProject,
} from '../inlang/project.js';
import { readCompiledFrom } from '../paraglide/readme.js';

export type OutdirProjectsSettings = {
  /** Absolute inlang project directories; undefined to detect them. */
  configured: readonly string[] | undefined;
  /** Where `*.inlang` directories are looked for, nearest first. */
  searchDirectories: readonly string[];
};

/** Pairs each Paraglide outdir with the inlang project it was compiled from. */
export class OutdirProjects {
  /** Project directories by outdir, both absolute. */
  private readonly paired = new Map<string, string>();
  /** The projects an outdir is matched against, read once. */
  private candidates: Promise<InlangProject[]> | undefined;

  constructor(private readonly settings: OutdirProjectsSettings) {}

  /** The directory of the project paired with `outdir`, absolute. */
  of(outdir: string): string | undefined {
    return this.paired.get(outdir);
  }

  /**
   * Pairs `outdir` with the project its README names, else with the candidate
   * that matches `catalog`: the outdir's message ids, undefined if unknown.
   */
  async pair(
    outdir: string,
    catalog: ReadonlySet<string> | undefined
  ): Promise<InlangProject | undefined> {
    const project =
      (await this.namedBy(outdir)) ??
      matchInlangProject(await this.loadCandidates(), catalog);
    if (!project) return undefined;

    this.paired.set(outdir, project.directory);

    return project;
  }

  /** Configured projects replace the README's. */
  private async namedBy(outdir: string): Promise<InlangProject | undefined> {
    if (this.settings.configured) return undefined;

    const directory = await readCompiledFrom(outdir);
    if (!directory) return undefined;

    return readInlangProject(directory);
  }

  private loadCandidates(): Promise<InlangProject[]> {
    this.candidates ??= readCandidates(this.settings);

    return this.candidates;
  }
}

async function readCandidates({
  configured,
  searchDirectories,
}: OutdirProjectsSettings): Promise<InlangProject[]> {
  const directories =
    configured ?? (await findInlangProjects(searchDirectories));

  return readInlangProjects(directories);
}
