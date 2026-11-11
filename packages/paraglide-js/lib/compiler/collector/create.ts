import path from 'node:path';
import { defaultLanguages } from '../languages/index.js';
import type { ParaglideContextOptions } from '../options.js';
import { defaultTargets } from '../paraglide/targets.js';
import { FileSelection } from '../project/files.js';
import {
  directoriesUpTo,
  findProjectRoot,
  findWorkspaceRoot,
} from '../project/roots.js';
import { ContextCollector, type CollectorLogger } from './collector.js';

/** Lines of context above and below each usage. */
export const DEFAULT_CONTEXT_RADIUS = 10;

export type CollectorEnvironment = {
  /** The bundler's root, e.g. Vite's `root` or webpack's `context`. */
  root: string;
  logger: CollectorLogger;
  /** Absolute directories that are never sources, e.g. the build output. */
  ignoredDirectories?: readonly string[];
};

/** A collector for any bundler: resolves the options against the project. */
export function createCollector(
  options: ParaglideContextOptions,
  { root, logger, ignoredDirectories = [] }: CollectorEnvironment
): ContextCollector {
  const projectRoot = findProjectRoot(root);
  const workspaceRoot = findWorkspaceRoot(projectRoot);
  const collector: ContextCollector = new ContextCollector({
    projectRoot,
    logger,
    selection: new FileSelection({
      projectRoot,
      workspaceRoot,
      include: options.include,
      exclude: options.exclude,
      ignoredDirectories,
      isSourceFile: (file) => collector.isSourceFile(file),
    }),
    explicitInclude: options.include !== undefined,
    inlangProjects: options.inlangProjects?.map((directory) =>
      path.resolve(projectRoot, directory)
    ),
    inlangSearchDirectories: directoriesUpTo(
      root,
      workspaceRoot ?? projectRoot
    ),
    radius: options.radius ?? DEFAULT_CONTEXT_RADIUS,
    targets: options.targets ?? defaultTargets,
    languages: options.languages ?? defaultLanguages,
    outdirs: (options.outdirs ?? []).map((outdir) =>
      path.resolve(projectRoot, outdir)
    ),
    autoImports: options.autoImports,
    fallbackDirectories: [
      root,
      projectRoot,
      ...(workspaceRoot ? [workspaceRoot] : []),
    ],
  });
  return collector;
}

/** Whether a test runner is running; plugins are off there unless `enabled` is set. */
export function isTestEnvironment(mode?: string): boolean {
  return (
    process.env.VITEST !== undefined ||
    process.env.NODE_ENV === 'test' ||
    mode === 'test'
  );
}
