import fs from 'node:fs';
import path from 'node:path';
import type { JsxChildren } from '@generaltranslation/format/types';
import fg from 'fast-glob';
import { hashSource } from 'generaltranslation/id';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/internal';
import { extractFromVueSource } from '../extractFromVueSource.js';
import {
  resolveVueCompilerOptions,
  type VueCompilerOptionsResolution,
} from '../config/resolveVueCompilerOptions.js';
import { NUXT_CONFIG_FILES, VITE_CONFIG_FILES } from '../config/configFiles.js';
import {
  createProjectModuleResolver,
  DEFAULT_RESOLUTION_CONDITIONS,
  loadExplicitTypeScriptConfig,
} from './moduleResolver.js';
import { resolveVueProjectAliasConfiguration } from './viteAliases.js';
import {
  declaresInstalledJavaScriptDependency,
  GT_VUE_PACKAGE,
  readJavaScriptPackageManifest,
} from './manifest.js';
import {
  discoverVueProject,
  findVueSourceScope,
  readDefaultVueSourcePatterns,
  resolveProjectDirectory,
  type VueSourceScope,
} from './scopes.js';
import {
  isVueSfcSource,
  readVueProjectInspection,
} from './inspectVueProject.js';
import type {
  VueCompilerOptions,
  VueExtractionOutput,
  VueExtractionResult,
  VueProjectExtractionOptions,
  VueProjectExtractionOutput,
  VueProjectExtractionResult,
  VueSourceCode,
} from '../../types.js';

const SCRIPT_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
]);

const JSX_CONFIG_EXTENSIONS = new Set(['.jsx', '.tsx']);

/**
 * Extracts, hashes, and deduplicates every gt-vue message owned by a project.
 *
 * This is the package-level orchestration boundary used by host CLIs. It owns
 * workspace discovery, source matching, compiler/config resolution, static
 * module resolution, and catalog hashing so framework hosts do not need Vue
 * implementation details. Configuration failures return no partial updates.
 */
export async function extractFromVueProject(
  options: VueProjectExtractionOptions = {}
): Promise<VueProjectExtractionOutput> {
  const projectRoot = resolveProjectDirectory(
    options.cwd ?? options.inspection?.projectRoot ?? process.cwd()
  );
  const discovery =
    readVueProjectInspection(options.inspection, projectRoot) ??
    discoverVueProject(projectRoot);
  const discoveryErrors =
    options.filePatterns === undefined
      ? validateNuxtSourceScopes(discovery.scopes, options.vueCompilerOptions)
      : [];
  if (discoveryErrors.length > 0) {
    return { updates: [], errors: discoveryErrors, warnings: [] };
  }
  const patterns =
    options.filePatterns ?? readDefaultVueSourcePatterns(discovery.scopes);
  if (patterns.length === 0) {
    return { updates: [], errors: [], warnings: [] };
  }

  const fileMatches = matchProjectFiles(projectRoot, patterns);
  if (fileMatches.errors.length > 0) {
    return { updates: [], errors: fileMatches.errors, warnings: [] };
  }
  const matchedFiles = fileMatches.files;
  const scopes = addExplicitSourceScopes(
    projectRoot,
    discovery.scopes,
    options.filePatterns === undefined ? [] : matchedFiles
  );
  const sourceByFile = new Map<string, string>();
  const standaloneResults = new Map<string, VueExtractionOutput>();
  const fileScopes = new Map(
    matchedFiles.map((file) => [file, findVueSourceScope(file, scopes)])
  );
  // Explicit globs can also match files owned by another framework package.
  // They are not Vue inputs unless discovery placed them in a Vue scope.
  const ownedFiles = matchedFiles.filter(
    (file) => fileScopes.get(file) !== undefined
  );
  const files = await filterVueSourceFiles(ownedFiles, sourceByFile);
  if (files.length === 0) {
    return { updates: [], errors: [], warnings: [] };
  }
  const errors: string[] = [];
  const warnings = new Set<string>();
  const tsconfigPath = resolveExplicitTypeScriptConfigPath(
    projectRoot,
    options.tsconfigPath,
    errors
  );
  if (errors.length > 0) {
    return { updates: [], errors, warnings: [] };
  }
  let explicitCompilerResolution = validateExplicitCompilerConfig(
    projectRoot,
    options,
    files.some((file) => path.extname(file).toLowerCase() === '.vue'),
    errors
  );
  if (errors.length > 0) {
    return { updates: [], errors, warnings: [] };
  }

  const moduleResolution = createVueModuleResolver(
    projectRoot,
    scopes,
    fileScopes,
    options,
    createProjectModuleResolver(
      options.conditionNames ?? DEFAULT_RESOLUTION_CONDITIONS,
      { tsconfigPath }
    )
  );
  errors.push(...moduleResolution.errors);
  if (errors.length > 0) {
    return { updates: [], errors, warnings: [] };
  }
  const resolveModuleForFile = moduleResolution.resolveModuleForFile;

  for (const file of files) {
    const extension = path.extname(file).toLowerCase();
    if (extension !== '.vue' && !SCRIPT_EXTENSIONS.has(extension)) continue;
    let source = sourceByFile.get(file);
    if (source === undefined) {
      try {
        source = await fs.promises.readFile(file, 'utf8');
      } catch (error) {
        errors.push(createReadDiagnostic(projectRoot, file, error));
        continue;
      }
      sourceByFile.set(file, source);
    }
    if (extension === '.vue') continue;
    standaloneResults.set(
      file,
      await extractFromVueSource(source, file, {
        compilerOptions: {},
        includeSourceCodeContext: options.includeSourceCodeContext,
        projectRoot,
        requireGTProvenance: true,
        resolveModule: resolveModuleForFile(file),
        surroundingLineCount: options.surroundingLineCount,
      })
    );
  }

  if (
    explicitCompilerResolution === undefined &&
    [...standaloneResults.values()].some(hasExtractionSignal)
  ) {
    explicitCompilerResolution = validateExplicitCompilerConfig(
      projectRoot,
      options,
      true,
      errors
    );
  }

  const potentialAliasProvenanceScopes = await probePotentialAliasProvenance(
    files,
    sourceByFile,
    fileScopes,
    standaloneResults,
    moduleResolution.resolvePotentialModulesForFile,
    projectRoot
  );

  validateIncompleteAliasScopes(
    files,
    fileScopes,
    standaloneResults,
    moduleResolution.incompleteAliasScopes,
    potentialAliasProvenanceScopes,
    errors
  );

  // I/O failures make project discovery incomplete, so never return a partial
  // catalog that a caller could mistake for a successful extraction.
  if (errors.length > 0) {
    return { updates: [], errors, warnings: [] };
  }

  const configAffectedFiles = files.filter((file) => {
    const extension = path.extname(file).toLowerCase();
    if (extension === '.vue') return true;
    const standaloneResult = standaloneResults.get(file);
    return (
      hasExtractionSignal(standaloneResult) &&
      (JSX_CONFIG_EXTENSIONS.has(extension) ||
        standaloneResult?.results.some(
          ({ dataFormat }) => dataFormat === 'JSX'
        ) === true)
    );
  });
  const compilerOptionsByScope = resolveCompilerOptionsByScope(
    projectRoot,
    configAffectedFiles,
    fileScopes,
    scopes,
    options,
    explicitCompilerResolution,
    errors
  );
  if (errors.length > 0) {
    return { updates: [], errors, warnings: [] };
  }

  const results: VueExtractionResult[] = [];
  for (const file of files) {
    const extension = path.extname(file).toLowerCase();
    if (extension !== '.vue' && !SCRIPT_EXTENSIONS.has(extension)) continue;
    const source = sourceByFile.get(file);
    if (source === undefined) continue;
    const result =
      extension === '.vue'
        ? await extractFromVueSource(source, file, {
            compilerOptions:
              compilerOptionsByScope.get(
                fileScopes.get(file)?.directory ?? ''
              ) ?? {},
            includeSourceCodeContext: options.includeSourceCodeContext,
            projectRoot,
            requireGTProvenance: true,
            resolveModule: resolveModuleForFile(file),
            surroundingLineCount: options.surroundingLineCount,
          })
        : standaloneResults.get(file);
    if (!result) continue;
    results.push(...result.results);
    errors.push(...result.errors);
    for (const warning of result.warnings) warnings.add(warning);
  }

  const updates = results.map(addCatalogHash);
  deduplicateProjectUpdates(updates);
  return {
    updates: errors.length > 0 ? [] : updates,
    errors,
    warnings: [...warnings],
  };
}

/** Excludes script modules whose filename happens to end in `.vue`. */
async function filterVueSourceFiles(
  files: readonly string[],
  sourceByFile: Map<string, string>
): Promise<string[]> {
  const included = await Promise.all(
    files.map(async (file) => {
      if (path.extname(file).toLowerCase() !== '.vue') return true;
      try {
        const source = await fs.promises.readFile(file, 'utf8');
        sourceByFile.set(file, source);
        return isVueSfcSource(source);
      } catch {
        // Preserve the file so the normal extraction pass reports its I/O error.
        return true;
      }
    })
  );
  return files.filter((_file, index) => included[index]);
}

/** Returns whether a standalone file has observable gt-vue extraction work. */
function hasExtractionSignal(result: VueExtractionOutput | undefined): boolean {
  return Boolean(
    result &&
    (result.results.length > 0 ||
      result.errors.length > 0 ||
      result.warnings.length > 0)
  );
}

/**
 * Proves whether a statically observed alias candidate can expose gt-vue.
 *
 * Incomplete config candidates are diagnostic evidence only: results from
 * these probes are never published. Reusing the normal provenance analyzer
 * avoids treating ordinary React/local helpers with GT-shaped names as Vue.
 */
async function probePotentialAliasProvenance(
  files: readonly string[],
  sourceByFile: ReadonlyMap<string, string>,
  fileScopes: ReadonlyMap<string, VueSourceScope | undefined>,
  standaloneResults: ReadonlyMap<string, VueExtractionOutput>,
  resolvePotentialModulesForFile: (
    sourceFile: string
  ) => Array<(specifier: string, importer: string) => string | undefined>,
  projectRoot: string
): Promise<Set<string>> {
  const provenScopes = new Set<string>();
  for (const file of files) {
    if (path.extname(file).toLowerCase() === '.vue') continue;
    const scope = fileScopes.get(file);
    const source = sourceByFile.get(file);
    if (
      !scope ||
      source === undefined ||
      provenScopes.has(scope.directory) ||
      hasExtractionSignal(standaloneResults.get(file))
    ) {
      continue;
    }
    for (const resolveModule of resolvePotentialModulesForFile(file)) {
      const probe = await extractFromVueSource(source, file, {
        compilerOptions: {},
        projectRoot,
        requireGTProvenance: true,
        resolveModule,
      });
      if (!hasExtractionSignal(probe)) continue;
      provenScopes.add(scope.directory);
      break;
    }
  }
  return provenScopes;
}

/** Maximum diagnostic-only alias combinations explored for one application. */
const MAX_POTENTIAL_ALIAS_CONFIGURATIONS = 128;

/** Builds deterministic candidate maps without trusting any as active config. */
function createPotentialAliasConfigurations(
  potentialAliases: ReadonlyMap<string, ReadonlySet<string>> | undefined
): Map<string, string>[] {
  if (!potentialAliases || potentialAliases.size === 0) return [];
  let configurations: Map<string, string>[] = [new Map()];
  for (const [key, replacements] of potentialAliases) {
    if (replacements.size === 0) continue;
    const next: Map<string, string>[] = [];
    for (const configuration of configurations) {
      for (const replacement of replacements) {
        next.push(new Map(configuration).set(key, replacement));
        if (next.length >= MAX_POTENTIAL_ALIAS_CONFIGURATIONS) break;
      }
      if (next.length >= MAX_POTENTIAL_ALIAS_CONFIGURATIONS) break;
    }
    configurations = next;
    if (configurations.length === 0) return [];
  }
  return configurations;
}

function addCatalogHash(
  result: VueExtractionResult
): VueProjectExtractionResult {
  const hash = hashSource({
    // hashSource's historical shared type omits boolean/null branch sources,
    // although its runtime sanitizer has always supported those React values.
    source: result.source as JsxChildren | string,
    ...(result.metadata.context && { context: result.metadata.context }),
    dataFormat: result.dataFormat,
  });
  return {
    ...result,
    metadata: { ...result.metadata, hash },
  } as VueProjectExtractionResult;
}

/** Merges duplicate Vue hashes without repeating source-location metadata. */
function deduplicateProjectUpdates(
  updates: VueProjectExtractionResult[]
): void {
  const byHash = new Map<string, VueProjectExtractionResult>();
  for (const update of updates) {
    const existing = byHash.get(update.metadata.hash);
    if (!existing) {
      byHash.set(update.metadata.hash, update);
      continue;
    }
    existing.metadata.filePaths = mergeUnique(
      existing.metadata.filePaths,
      update.metadata.filePaths
    );
    existing.metadata.sourceCode = mergeSourceCode(
      existing.metadata.sourceCode,
      update.metadata.sourceCode
    );
  }
  updates.splice(0, updates.length, ...byHash.values());
}

function mergeUnique(
  left: string[] | undefined,
  right: string[] | undefined
): string[] | undefined {
  const merged = [...new Set([...(left ?? []), ...(right ?? [])])];
  return merged.length > 0 ? merged : undefined;
}

function mergeSourceCode(
  left: Record<string, VueSourceCode[]> | undefined,
  right: Record<string, VueSourceCode[]> | undefined
): Record<string, VueSourceCode[]> | undefined {
  if (!left && !right) return undefined;
  const merged: Record<string, VueSourceCode[]> = {};
  for (const sourceCode of [left, right]) {
    for (const [file, entries] of Object.entries(sourceCode ?? {})) {
      const known = new Set(
        (merged[file] ?? []).map((entry) => JSON.stringify(entry))
      );
      for (const entry of entries) {
        const key = JSON.stringify(entry);
        if (known.has(key)) continue;
        (merged[file] ??= []).push(entry);
        known.add(key);
      }
    }
  }
  return merged;
}

/** Matches source patterns without hiding filesystem discovery failures. */
function matchProjectFiles(
  cwd: string,
  patterns: readonly string[]
): { files: string[]; errors: string[] } {
  let matches: string[];
  try {
    matches = fg.sync([...patterns], {
      absolute: true,
      cwd,
      followSymbolicLinks: false,
      ignore: ['**/node_modules/**'],
      onlyFiles: true,
      unique: true,
    });
  } catch (error) {
    return {
      files: [],
      errors: [createGlobDiagnostic(patterns, error)],
    };
  }
  let realRoot: string;
  try {
    realRoot = fs.realpathSync(cwd);
  } catch (error) {
    return {
      files: [],
      errors: [createRootRealpathDiagnostic(cwd, error)],
    };
  }
  const files = new Set<string>();
  const errors: string[] = [];
  for (const file of matches) {
    let realFile: string;
    try {
      realFile = fs.realpathSync(file);
    } catch (error) {
      errors.push(createMatchedFileRealpathDiagnostic(cwd, file, error));
      continue;
    }
    const relative = path.relative(realRoot, realFile);
    if (
      relative === '' ||
      relative === '..' ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    ) {
      // Symlinks outside the project are intentionally outside its catalog.
      continue;
    }
    files.add(realFile);
  }
  return {
    errors,
    files: [...files].sort((left, right) => left.localeCompare(right)),
  };
}

/**
 * Makes custom Nuxt source layouts fail closed before another scope can make
 * an incomplete project look successful. Vite config does not influence
 * source discovery and remains gated on a matched SFC or proven gt-vue JSX.
 */
function validateNuxtSourceScopes(
  scopes: readonly VueSourceScope[],
  explicitOptions: VueCompilerOptions | undefined
): string[] {
  const errors: string[] = [];
  for (const scope of scopes) {
    if (
      !NUXT_CONFIG_FILES.some((file) =>
        fs.existsSync(path.join(scope.directory, file))
      )
    ) {
      continue;
    }
    errors.push(
      ...resolveVueCompilerOptions(scope.directory, explicitOptions).errors
    );
  }
  return errors;
}

/** Adds independent package boundaries only for explicit user-selected sources. */
function addExplicitSourceScopes(
  projectRoot: string,
  discoveredScopes: readonly VueSourceScope[],
  files: readonly string[]
): VueSourceScope[] {
  const scopes = [...discoveredScopes];
  const known = new Set(scopes.map(({ directory }) => directory));
  for (const file of files) {
    const directory = findNearestPackageDirectory(file, projectRoot);
    if (known.has(directory)) continue;
    const inheritedScope = findVueSourceScope(file, scopes);
    if (!inheritedScope) continue;
    if (!ownsIndependentVueConfiguration(directory)) {
      continue;
    }
    known.add(directory);
    scopes.push({
      directory,
      includeByDefault: false,
      relativeDirectory: toPosixPath(path.relative(projectRoot, directory)),
    });
  }
  return scopes;
}

/** Returns whether a package must resolve its own Vue build configuration. */
function ownsIndependentVueConfiguration(directory: string): boolean {
  if (
    [...VITE_CONFIG_FILES, ...NUXT_CONFIG_FILES].some((file) =>
      fs.existsSync(path.join(directory, file))
    )
  ) {
    return true;
  }
  const manifest = readJavaScriptPackageManifest(
    path.join(directory, 'package.json')
  );
  return Boolean(
    manifest && declaresInstalledJavaScriptDependency(manifest, GT_VUE_PACKAGE)
  );
}

function findNearestPackageDirectory(
  file: string,
  projectRoot: string
): string {
  let current = path.dirname(file);
  const root = path.resolve(projectRoot);
  while (current !== root && isWithin(root, current)) {
    if (fs.existsSync(path.join(current, 'package.json'))) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return root;
}

/** Applies each Vue app's statically resolved Vite/Nuxt aliases before Node resolution. */
function createVueModuleResolver(
  projectRoot: string,
  scopes: readonly VueSourceScope[],
  fileScopes: ReadonlyMap<string, VueSourceScope | undefined>,
  options: VueProjectExtractionOptions,
  resolveModule: (specifier: string, importer: string) => string | undefined
): {
  resolveModuleForFile: (
    sourceFile: string
  ) => (specifier: string, importer: string) => string | undefined;
  resolvePotentialModulesForFile: (
    sourceFile: string
  ) => Array<(specifier: string, importer: string) => string | undefined>;
  errors: string[];
  incompleteAliasScopes: Set<string>;
} {
  const matchedScopes = uniqueSourceScopes(fileScopes.values());
  const ownedMatchedScopes = matchedScopes.filter(
    ({ includeByDefault }) => includeByDefault
  );
  const candidateExplicitScopes =
    ownedMatchedScopes.length > 0 ? ownedMatchedScopes : matchedScopes;
  const aliasesByScope = new Map<string, Map<string, string>>();
  const errors: string[] = [];
  const incompleteAliasScopes = new Set<string>();
  const potentialAliasesByScope = new Map<string, Map<string, Set<string>>>();
  if (options.viteConfigPath !== undefined) {
    const explicitConfig = path.resolve(projectRoot, options.viteConfigPath);
    const explicitScope =
      candidateExplicitScopes.length === 1
        ? candidateExplicitScopes[0]
        : findVueSourceScope(explicitConfig, candidateExplicitScopes);
    if (!explicitScope) {
      errors.push(
        createExplicitConfigOwnershipDiagnostic(options.viteConfigPath)
      );
    } else {
      for (const scope of matchedScopes) {
        addAliasesForScope(
          aliasesByScope,
          incompleteAliasScopes,
          potentialAliasesByScope,
          scope,
          scope.directory === explicitScope.directory
            ? {
                directory: projectRoot,
                viteConfigPath: options.viteConfigPath,
              }
            : { directory: scope.directory }
        );
      }
    }
  } else {
    for (const scope of matchedScopes) {
      addAliasesForScope(
        aliasesByScope,
        incompleteAliasScopes,
        potentialAliasesByScope,
        scope,
        { directory: scope.directory }
      );
    }
  }

  return {
    errors,
    incompleteAliasScopes,
    resolveModuleForFile(sourceFile) {
      // Keep aliases attached to the application that initiated traversal.
      // A local barrel can live in a sibling/linked package and import another
      // application alias transitively; selecting by that barrel's directory
      // would either lose the alias or leak a different app's configuration.
      const sourceScope = findVueSourceScope(sourceFile, scopes);
      return (specifier, importer) => {
        const scope = sourceScope ?? findVueSourceScope(importer, scopes);
        const aliases = scope ? aliasesByScope.get(scope.directory) : undefined;
        return resolveModule(applyStaticAlias(specifier, aliases), importer);
      };
    },
    resolvePotentialModulesForFile(sourceFile) {
      const sourceScope = findVueSourceScope(sourceFile, scopes);
      if (!sourceScope) return [];
      return createPotentialAliasConfigurations(
        potentialAliasesByScope.get(sourceScope.directory)
      ).map(
        (aliases) => (specifier: string, importer: string) =>
          resolveModule(applyStaticAlias(specifier, aliases), importer)
      );
    },
  };
}

function addAliasesForScope(
  aliasesByScope: Map<string, Map<string, string>>,
  incompleteAliasScopes: Set<string>,
  potentialAliasesByScope: Map<string, Map<string, Set<string>>>,
  scope: VueSourceScope,
  config: { directory: string; viteConfigPath?: string }
): void {
  const resolution = resolveVueProjectAliasConfiguration(config.directory, {
    viteConfigPath: config.viteConfigPath,
  });
  if (!resolution.complete) {
    incompleteAliasScopes.add(scope.directory);
    if (resolution.potentialAliases) {
      potentialAliasesByScope.set(scope.directory, resolution.potentialAliases);
    }
    aliasesByScope.set(scope.directory, new Map());
    return;
  }
  aliasesByScope.set(scope.directory, resolution.aliases);
}

/** Blocks incomplete aliases only after a source proves Vue ownership. */
function validateIncompleteAliasScopes(
  files: readonly string[],
  fileScopes: ReadonlyMap<string, VueSourceScope | undefined>,
  standaloneResults: ReadonlyMap<string, VueExtractionOutput>,
  incompleteScopes: ReadonlySet<string>,
  potentialAliasProvenanceScopes: ReadonlySet<string>,
  errors: string[]
): void {
  const diagnosedScopes = new Set<string>();
  for (const file of files) {
    const scope = fileScopes.get(file);
    if (
      !scope ||
      !incompleteScopes.has(scope.directory) ||
      diagnosedScopes.has(scope.directory)
    ) {
      continue;
    }
    const isVueSource = path.extname(file).toLowerCase() === '.vue';
    const hasVueSignal = hasExtractionSignal(standaloneResults.get(file));
    const hasPotentialAliasProvenance = potentialAliasProvenanceScopes.has(
      scope.directory
    );
    if (!isVueSource && !hasVueSignal && !hasPotentialAliasProvenance) {
      continue;
    }
    diagnosedScopes.add(scope.directory);
    errors.push(createIncompleteAliasDiagnostic(scope));
  }
}

function createIncompleteAliasDiagnostic(scope: VueSourceScope): string {
  return createDiagnosticMessage({
    source: '@generaltranslation/vue-extractor',
    severity: 'Error',
    whatHappened:
      'Could not statically resolve the Vue application module aliases',
    why: 'Dynamic alias behavior can hide gt-vue imports and produce an incomplete translation catalog',
    fix: 'Define Vite or Nuxt aliases with static string values and remove custom alias resolvers',
    details: scope.relativeDirectory || '.',
  });
}

function uniqueSourceScopes(
  scopes: Iterable<VueSourceScope | undefined>
): VueSourceScope[] {
  const unique = new Map<string, VueSourceScope>();
  for (const scope of scopes) {
    if (scope) unique.set(scope.directory, scope);
  }
  return [...unique.values()];
}

function applyStaticAlias(
  specifier: string,
  aliases: ReadonlyMap<string, string> | undefined
): string {
  if (!aliases) return specifier;
  for (const [find, replacement] of aliases) {
    const normalized =
      find.endsWith('/') && replacement.endsWith('/')
        ? {
            find: find.slice(0, -1),
            replacement: replacement.slice(0, -1),
          }
        : { find, replacement };
    if (
      specifier === normalized.find ||
      specifier.startsWith(`${normalized.find}/`)
    ) {
      return specifier.replace(normalized.find, normalized.replacement);
    }
  }
  return specifier;
}

/** Resolves every affected scope before parsing any SFC catalog content. */
function resolveCompilerOptionsByScope(
  projectRoot: string,
  files: readonly string[],
  fileScopes: ReadonlyMap<string, VueSourceScope | undefined>,
  scopes: readonly VueSourceScope[],
  options: VueProjectExtractionOptions,
  explicitCompilerResolution: VueCompilerOptionsResolution | undefined,
  errors: string[]
): Map<string, VueCompilerOptions> {
  const optionsByScope = new Map<string, VueCompilerOptions>();
  const affectedScopes = new Map<string, VueSourceScope>();
  for (const file of files) {
    const scope = fileScopes.get(file);
    if (scope) affectedScopes.set(scope.directory, scope);
  }
  if (affectedScopes.size === 0) return optionsByScope;

  if (options.viteConfigPath !== undefined) {
    const explicitConfig = path.resolve(projectRoot, options.viteConfigPath);
    const explicitResolution =
      explicitCompilerResolution ??
      resolveVueCompilerOptions(projectRoot, options.vueCompilerOptions, {
        viteConfigPath: options.viteConfigPath,
        sourceDiscoveryIsExplicit: options.filePatterns !== undefined,
      });
    errors.push(...explicitResolution.errors);
    if (explicitResolution.errors.length > 0) return optionsByScope;
    const explicitScope =
      affectedScopes.size === 1
        ? [...affectedScopes.values()][0]
        : findVueSourceScope(explicitConfig, scopes);
    if (!explicitScope || !affectedScopes.has(explicitScope.directory)) {
      errors.push(
        createExplicitConfigOwnershipDiagnostic(options.viteConfigPath)
      );
      return optionsByScope;
    }

    for (const scope of affectedScopes.values()) {
      const resolution =
        scope.directory === explicitScope.directory
          ? explicitResolution
          : resolveVueCompilerOptions(
              scope.directory,
              options.vueCompilerOptions,
              {
                sourceDiscoveryIsExplicit: options.filePatterns !== undefined,
              }
            );
      errors.push(...resolution.errors);
      optionsByScope.set(scope.directory, resolution.compilerOptions);
    }
    return optionsByScope;
  }

  for (const scope of affectedScopes.values()) {
    const resolution = resolveVueCompilerOptions(
      scope.directory,
      options.vueCompilerOptions,
      {
        sourceDiscoveryIsExplicit: options.filePatterns !== undefined,
      }
    );
    errors.push(...resolution.errors);
    optionsByScope.set(scope.directory, resolution.compilerOptions);
  }
  return optionsByScope;
}

/** Validates an explicitly selected config even when every match is STRING. */
function validateExplicitCompilerConfig(
  projectRoot: string,
  options: VueProjectExtractionOptions,
  hasPotentialVueSource: boolean,
  errors: string[]
): VueCompilerOptionsResolution | undefined {
  if (!hasPotentialVueSource || options.viteConfigPath === undefined) {
    return undefined;
  }
  const resolution = resolveVueCompilerOptions(
    projectRoot,
    options.vueCompilerOptions,
    {
      viteConfigPath: options.viteConfigPath,
      sourceDiscoveryIsExplicit: options.filePatterns !== undefined,
    }
  );
  errors.push(...resolution.errors);
  return resolution;
}

function createExplicitConfigOwnershipDiagnostic(configPath: string): string {
  return createDiagnosticMessage({
    source: '@generaltranslation/vue-extractor',
    severity: 'Error',
    whatHappened:
      'The configured Vite config does not own any matched Vue sources',
    fix: 'Run extraction from that application root, include only one centrally configured Vue application, or remove files.gt.parsingFlags.viteConfigPath',
    details: configPath,
  });
}

/** Resolves and validates one explicit TypeScript project file atomically. */
function resolveExplicitTypeScriptConfigPath(
  projectRoot: string,
  configuredPath: string | undefined,
  errors: string[]
): string | undefined {
  if (configuredPath === undefined) return undefined;
  const absolutePath = path.resolve(projectRoot, configuredPath);
  try {
    const configPath = fs.realpathSync(absolutePath);
    if (!fs.statSync(configPath).isFile()) {
      throw new Error('The configured path is not a file');
    }
    const resolution = loadExplicitTypeScriptConfig(configPath);
    if (resolution.resultType === 'failed') {
      throw new Error(resolution.message);
    }
    const loadedPath = fs.realpathSync(resolution.configFileAbsolutePath);
    if (loadedPath !== configPath) {
      throw new Error(
        `The resolver selected a different config file: ${loadedPath}`
      );
    }
    return configPath;
  } catch (error) {
    errors.push(
      createDiagnosticMessage({
        source: '@generaltranslation/vue-extractor',
        severity: 'Error',
        whatHappened: 'Could not load the configured TypeScript project file',
        why: 'Unresolved path aliases can hide gt-vue imports and produce an incomplete translation catalog',
        fix: 'Set tsconfigPath to a readable tsconfig.json or jsconfig.json file',
        details: [
          configuredPath,
          formatDiagnosticErrorDetails(error) ?? 'Unknown config error',
        ],
      })
    );
    return undefined;
  }
}

function createReadDiagnostic(
  projectRoot: string,
  file: string,
  error: unknown
): string {
  return createDiagnosticMessage({
    source: '@generaltranslation/vue-extractor',
    severity: 'Error',
    whatHappened: 'Could not read a matched Vue source file',
    fix: 'Restore read access or exclude the file from the configured source patterns',
    details: [
      toPosixPath(path.relative(projectRoot, file)),
      formatDiagnosticErrorDetails(error) ?? 'Unknown read error',
    ],
  });
}

function createGlobDiagnostic(
  patterns: readonly string[],
  error: unknown
): string {
  return createDiagnosticMessage({
    source: '@generaltranslation/vue-extractor',
    severity: 'Error',
    whatHappened: 'Could not match the configured Vue source patterns',
    fix: 'Correct the source patterns and rerun extraction',
    details: [
      patterns.join(', ') || '(no patterns)',
      formatDiagnosticErrorDetails(error) ?? 'Unknown glob error',
    ],
  });
}

function createRootRealpathDiagnostic(
  projectRoot: string,
  error: unknown
): string {
  return createDiagnosticMessage({
    source: '@generaltranslation/vue-extractor',
    severity: 'Error',
    whatHappened: 'Could not resolve the Vue project root',
    fix: 'Restore access to the project directory and rerun extraction',
    details: [
      projectRoot,
      formatDiagnosticErrorDetails(error) ?? 'Unknown filesystem error',
    ],
  });
}

function createMatchedFileRealpathDiagnostic(
  projectRoot: string,
  file: string,
  error: unknown
): string {
  return createDiagnosticMessage({
    source: '@generaltranslation/vue-extractor',
    severity: 'Error',
    whatHappened: 'Could not resolve a matched Vue source file',
    fix: 'Restore the file or exclude it from the configured source patterns',
    details: [
      toPosixPath(path.relative(projectRoot, file)),
      formatDiagnosticErrorDetails(error) ?? 'Unknown filesystem error',
    ],
  });
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return (
    relative === '' ||
    (relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join(path.posix.sep);
}
