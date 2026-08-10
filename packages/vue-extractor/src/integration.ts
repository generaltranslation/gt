import fs from 'node:fs';
import path from 'node:path';
import type {
  VueCompilerOptions,
  VueProjectExtractionOutput,
} from './types.js';
import type { InlineExtractionOutput } from './internal/project/mergeVueProjectExtraction.js';

const GT_VUE_PACKAGE = 'gt-vue';

/**
 * Framework-neutral inline extractor supplied by a host CLI.
 *
 * The planner calls this function at most once. When no explicit source
 * partition is necessary, it receives the caller's original pattern value
 * before the planner performs asynchronous Vue work.
 */
export type PrimaryInlineExtractor = (
  filePatterns: string[] | undefined
) => Promise<InlineExtractionOutput>;

/** Options captured while deciding whether a project needs Vue extraction. */
export type VueExtractionPlannerOptions = {
  /** Inline runtime selected by the host CLI. */
  library: string;
  /** Absolute or caller-relative project root captured before any async work. */
  projectRoot: string;
  /** Explicit source patterns. `undefined` retains framework defaults. */
  filePatterns?: string[];
  /** Includes surrounding source lines in extracted update metadata. */
  includeSourceCodeContext?: boolean;
  /** Package export conditions used by static local-module resolution. */
  conditionNames?: string[];
  /** Explicit hash-affecting Vue compiler options. */
  vueCompilerOptions?: VueCompilerOptions;
  /** Explicit Vite config path relative to the captured project root. */
  viteConfigPath?: string;
  /** Number of source lines captured before and after a translation. */
  surroundingLineCount?: number;
};

/** Host callbacks used only after a plan has proven Vue ownership. */
export type VueExtractionRunOptions = {
  /** Existing React, Node, or Python extraction to preserve and merge. */
  extractPrimary?: PrimaryInlineExtractor;
};

/** A synchronous decision that leaves non-Vue projects completely untouched. */
export type VueExtractionPlan =
  | {
      /** The root has no direct Vue extraction ownership. */
      readonly handled: false;
    }
  | {
      /** The selected runtime or root manifest directly owns gt-vue. */
      readonly handled: true;
      /** Executes package-owned Vue inspection, extraction, and merging. */
      run(options?: VueExtractionRunOptions): Promise<InlineExtractionOutput>;
    };

type CapturedPlannerOptions = Omit<
  VueExtractionPlannerOptions,
  'projectRoot'
> & {
  projectRoot: string;
};

const UNHANDLED_PLAN = Object.freeze({ handled: false } as const);

/**
 * Returns whether a package manifest directly enables gt-vue extraction.
 *
 * Only production and development dependencies establish ownership. An
 * optional declaration is authoritative and vetoes a matching declaration in
 * either field, while peer dependencies never establish ownership.
 */
export function manifestDirectlyDeclaresGTVue(manifest: unknown): boolean {
  if (!isRecord(manifest)) return false;
  if (hasOwnDependency(manifest.optionalDependencies, GT_VUE_PACKAGE)) {
    return false;
  }
  return (
    hasOwnDependency(manifest.dependencies, GT_VUE_PACKAGE) ||
    hasOwnDependency(manifest.devDependencies, GT_VUE_PACKAGE)
  );
}

/**
 * Plans Vue extraction without changing historical framework behavior.
 *
 * Activation is intentionally narrow: only an explicitly selected `gt-vue`
 * runtime or a non-optional root `package.json` dependency/devDependency can
 * handle the project. An optional declaration vetoes manifest ownership; peer,
 * workspace-child, wrapper, source, and transitive evidence is ignored. The
 * false branch is synchronous and performs no source scan, workspace traversal,
 * dynamic import, or asynchronous work.
 */
export function planVueExtraction(
  options: VueExtractionPlannerOptions
): VueExtractionPlan {
  const captured = capturePlannerOptions(options);
  if (
    captured.library !== GT_VUE_PACKAGE &&
    !rootDirectlyDeclaresGTVue(captured.projectRoot)
  ) {
    return UNHANDLED_PLAN;
  }

  return Object.freeze({
    handled: true as const,
    run: (runOptions: VueExtractionRunOptions = {}) =>
      runVueExtraction(captured, runOptions),
  });
}

/** Resolves the root immediately so later cwd changes cannot retarget work. */
function capturePlannerOptions(
  options: VueExtractionPlannerOptions
): CapturedPlannerOptions {
  const absoluteRoot = path.resolve(options.projectRoot);
  let projectRoot = absoluteRoot;
  try {
    projectRoot = fs.realpathSync(absoluteRoot);
  } catch {
    // A missing root is still captured absolutely; activation will remain
    // inert unless the runtime was selected explicitly.
  }
  return {
    ...options,
    projectRoot,
  };
}

/** Reads the root manifest fields that determine effective direct ownership. */
function rootDirectlyDeclaresGTVue(projectRoot: string): boolean {
  let manifest: unknown;
  try {
    manifest = JSON.parse(
      fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')
    );
  } catch {
    return false;
  }
  return manifestDirectlyDeclaresGTVue(manifest);
}

function hasOwnDependency(value: unknown, packageName: string): boolean {
  return isRecord(value) && Object.hasOwn(value, packageName);
}

/**
 * Runs the handled branch while preserving primary extractor timing.
 *
 * With framework-default patterns, the primary extractor starts synchronously
 * and receives the exact original `undefined` value before the first await.
 * Explicit patterns wait for package-owned SFC partitioning; if another task
 * changes `process.cwd()` in the meantime, only relative primary patterns are
 * anchored back to the captured project root.
 */
async function runVueExtraction(
  options: CapturedPlannerOptions,
  { extractPrimary }: VueExtractionRunOptions
): Promise<InlineExtractionOutput> {
  const filePatterns = options.filePatterns;
  if (filePatterns === undefined) {
    if (extractPrimary) {
      const primaryPromise = extractPrimary(filePatterns);
      const vueContextPromise = loadVueExtractionContext(options);
      // Observe both branches immediately. This lets an already-rejected
      // primary extractor retain its error identity and settle the returned
      // promise without waiting for workspace inspection. Promise.all also
      // keeps the losing branch observed if it rejects later.
      const vuePromise = vueContextPromise.then(
        async ({ inspection, project }) => ({
          project,
          vue: await project.extractFromVueProject(
            createProjectExtractionOptions(options, inspection, filePatterns)
          ),
        })
      );
      const [primary, { project, vue }] = await Promise.all([
        primaryPromise,
        vuePromise,
      ]);
      return project.mergeVueProjectExtraction(primary, vue);
    }

    const { project, inspection } = await loadVueExtractionContext(options);
    return adaptVueOnlyExtraction(
      project,
      await project.extractFromVueProject(
        createProjectExtractionOptions(options, inspection, filePatterns)
      )
    );
  }

  const vueContextPromise = loadVueExtractionContext(options);
  const { inspectionModule, project, inspection } = await vueContextPromise;

  if (!extractPrimary) {
    return adaptVueOnlyExtraction(
      project,
      await project.extractFromVueProject(
        createProjectExtractionOptions(options, inspection, filePatterns)
      )
    );
  }

  const partition = inspection.hasVueScopes
    ? inspectionModule.partitionVueSourcePatterns(inspection, filePatterns)
    : { primaryExclusionPatterns: [], vueExclusionPatterns: [] };
  const stablePrimaryPatterns =
    process.cwd() === options.projectRoot
      ? filePatterns
      : await anchorFilePatterns(options.projectRoot, filePatterns);
  const primaryPatterns =
    partition.primaryExclusionPatterns.length === 0
      ? stablePrimaryPatterns
      : [...stablePrimaryPatterns, ...partition.primaryExclusionPatterns];
  const vuePatterns =
    partition.vueExclusionPatterns.length === 0
      ? filePatterns
      : [...filePatterns, ...partition.vueExclusionPatterns];

  // Calling before constructing/awaiting Vue extraction preserves the
  // historical extractor's synchronous process.cwd() observation.
  const primaryPromise = extractPrimary(primaryPatterns);
  const vuePromise = project.extractFromVueProject(
    createProjectExtractionOptions(options, inspection, vuePatterns)
  );
  const [primary, vue] = await Promise.all([primaryPromise, vuePromise]);
  return project.mergeVueProjectExtraction(primary, vue);
}

/** Adapts accurate Vue wire types at the legacy host-CLI Updates boundary. */
function adaptVueOnlyExtraction(
  project: typeof import('./project.js'),
  vue: VueProjectExtractionOutput
): InlineExtractionOutput {
  return project.mergeVueProjectExtraction(
    { updates: [], errors: [], warnings: [] },
    vue
  );
}

/** Loads the lazy Vue modules and performs package-owned project inspection. */
async function loadVueExtractionContext(options: CapturedPlannerOptions) {
  const [inspectionModule, project] = await Promise.all([
    import('./internal/project/inspectVueProject.js'),
    import('./project.js'),
  ]);
  const inspection = await inspectionModule.inspectVueProjectForRuntime(
    options.projectRoot,
    options.library === GT_VUE_PACKAGE
  );
  return { inspectionModule, project, inspection };
}

function createProjectExtractionOptions(
  options: CapturedPlannerOptions,
  inspection: import('./types.js').VueProjectInspection,
  filePatterns: string[] | undefined
): import('./types.js').VueProjectExtractionOptions {
  return {
    cwd: options.projectRoot,
    inspection,
    filePatterns,
    includeSourceCodeContext: options.includeSourceCodeContext,
    conditionNames: options.conditionNames,
    vueCompilerOptions: options.vueCompilerOptions,
    viteConfigPath: options.viteConfigPath,
    surroundingLineCount: options.surroundingLineCount,
  };
}

/** Anchors relative globs without changing absolute or negative patterns. */
async function anchorFilePatterns(
  projectRoot: string,
  filePatterns: readonly string[]
): Promise<string[]> {
  const { default: fg } = await import('fast-glob');
  const rootPattern = fg.convertPathToPattern(projectRoot).replace(/\/$/, '');
  return filePatterns.map((pattern) => {
    const negative = pattern.startsWith('!') && pattern[1] !== '(';
    const positivePattern = negative ? pattern.slice(1) : pattern;
    if (path.isAbsolute(positivePattern)) return pattern;
    const relativePattern = positivePattern.startsWith('./')
      ? positivePattern.slice(2)
      : positivePattern;
    const anchoredPattern = `${rootPattern}/${relativePattern}`;
    return negative ? `!${anchoredPattern}` : anchoredPattern;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export type { InlineExtractionOutput } from './internal/project/mergeVueProjectExtraction.js';
