import path from 'node:path';
import { defaultLanguages } from '../languages/index.js';
import { isSourceFile } from '../languages/language.js';
import type { ParaglideContextOptions } from '../options.js';
import { defaultTargets } from '../paraglide/targets.js';
import { FileSelection } from '../project/files.js';
import {
  directoriesUpTo,
  findProjectRoot,
  findWorkspaceRoot,
} from '../project/roots.js';
import {
  ContextCollector,
  type CollectorLogger,
  type Resolver,
} from './collector.js';

/** Lines of context above and below each usage. */
const DEFAULT_CONTEXT_RADIUS = 10;

export type CollectorEnvironment = {
  /** The project, or a directory in it, e.g. its bundler's root. */
  root: string;
  logger: CollectorLogger;
  /** Resolves the imports of the analyzed files, e.g. a `ProjectResolver`'s `resolve`. */
  resolver: Resolver;
};

/** A collector with the options resolved against the project. */
export function createCollector(
  options: ParaglideContextOptions,
  { root, logger, resolver }: CollectorEnvironment
): ContextCollector {
  const projectRoot = findProjectRoot(root);
  const workspaceRoot = findWorkspaceRoot(projectRoot);
  const languages = options.languages ?? defaultLanguages;

  return new ContextCollector({
    projectRoot,
    logger,
    resolver,
    selection: new FileSelection({
      projectRoot,
      workspaceRoot,
      include: options.include,
      exclude: options.exclude,
      isSourceFile: (file) => isSourceFile(file, languages),
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
    languages,
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
}
