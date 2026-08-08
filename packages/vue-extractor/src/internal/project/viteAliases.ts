import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse, type ParserPlugin } from '@babel/parser';
import traverseModule, {
  type Binding,
  type NodePath,
  type Scope,
} from '@babel/traverse';
import type * as t from '@babel/types';
import {
  NUXT_CONFIG_FILES,
  VITE_CONFIG_EXTENSIONS,
  VITE_CONFIG_FILES,
} from '../config/configFiles.js';

const traverse = traverseModule.default || traverseModule;

type StaticEntry = {
  node: t.Node;
  scope: Scope;
};

type StaticObject = Map<string, StaticEntry>;

type ConfigKind = 'vite' | 'nuxt';

type ConfigSource = {
  file: string;
  kind: ConfigKind;
};

type ConfigDiscovery = {
  complete: boolean;
  source?: ConfigSource;
};

type StaticAliases = {
  entries: Array<readonly [find: string, replacement: string]>;
  form: 'array' | 'object';
};

type AliasResolution =
  | { ok: true; aliases: StaticAliases }
  | {
      ok: false;
      potentialAliasKeys: Set<string>;
      potentialAliases: Map<string, Set<string>>;
    };

type BindingSafety = 'alias' | 'config' | 'none';

type HelperBindings = {
  configFunctions: Set<Binding>;
  configNamespaces: Set<Binding>;
  fileURLToPathFunctions: Set<Binding>;
  pathNamespaces: Set<Binding>;
  pathResolveFunctions: Set<Binding>;
  urlConstructors: Set<Binding>;
  urlNamespaces: Set<Binding>;
};

type EvaluationContext = {
  configFile: string;
  helpers: HelperBindings;
  nuxtMajorVersion?: number;
  packageRoot: string;
  scopes: WeakMap<t.Node, Scope>;
};

/** Controls static Vite alias discovery for a Vue package. */
export type VueProjectAliasResolverOptions = {
  /** A single Vite config path, resolved within the Vue package directory. */
  viteConfigPath?: string;
  /** Nuxt major selected by the package, when already known by the caller. */
  nuxtMajorVersion?: number;
};

/** Result of proving the active framework alias surface statically. */
export type VueProjectAliasConfiguration = {
  /** Ordered string aliases, present only when analysis is complete. */
  aliases: Map<string, string>;
  /** Whether every active alias behavior was proven without execution. */
  complete: boolean;
  /**
   * Statically observed key-to-replacement candidates whose precedence remains
   * uncertain. These mappings are diagnostic evidence only; callers must not
   * use them to resolve imports or extract translations.
   */
  potentialAliases?: Map<string, Set<string>>;
  /**
   * Statically observed alias keys whose final behavior remains uncertain.
   * These keys are diagnostic evidence only and must never be resolved as
   * trusted aliases while `complete` is false.
   */
  potentialAliasKeys?: Set<string>;
};

/**
 * Reads string aliases from statically analyzable Vite and Nuxt config.
 *
 * Config files are parsed as source and are never imported or executed.
 * Dynamic aliases, regular-expression find values, and unsupported syntax are
 * ignored so alias discovery cannot make otherwise valid extraction fatal.
 */
export function resolveVueProjectAliases(
  cwd: string,
  options: VueProjectAliasResolverOptions = {}
): Map<string, string> {
  return resolveVueProjectAliasConfiguration(cwd, options).aliases;
}

/**
 * Resolves aliases and reports whether the active alias surface was proven.
 *
 * Incomplete analysis never returns partial aliases. This lets project-level
 * integrations distinguish a project with no configured aliases from one
 * whose dynamic resolver behavior must block safe static extraction.
 */
export function resolveVueProjectAliasConfiguration(
  cwd: string,
  options: VueProjectAliasResolverOptions = {}
): VueProjectAliasConfiguration {
  const packageRoot = path.resolve(cwd);
  const hasExplicitConfig = options.viteConfigPath !== undefined;
  const explicitConfig =
    options.viteConfigPath !== undefined
      ? resolveExplicitConfig(packageRoot, options.viteConfigPath)
      : undefined;
  const discovery: ConfigDiscovery = hasExplicitConfig
    ? explicitConfig
      ? { complete: true, source: { file: explicitConfig, kind: 'vite' } }
      : { complete: false }
    : discoverConfigSource(packageRoot);
  if (!discovery.complete) return incompleteAliasConfiguration();
  if (!discovery.source) return completeAliasConfiguration();
  return readConfigAliases(
    discovery.source,
    packageRoot,
    options.nuxtMajorVersion
  );
}

function discoverConfigSource(cwd: string): ConfigDiscovery {
  const viteConfig = findFirstConfig(cwd, VITE_CONFIG_FILES);
  const nuxtConfig = findFirstConfig(cwd, NUXT_CONFIG_FILES);
  // Match compiler-option discovery: two active framework configs are
  // ambiguous, so no alias result is safer than resolving with the wrong one.
  if (!viteConfig.complete || !nuxtConfig.complete) return { complete: false };
  if (viteConfig.file && nuxtConfig.file) return { complete: false };
  if (nuxtConfig.file) {
    return {
      complete: true,
      source: { file: nuxtConfig.file, kind: 'nuxt' },
    };
  }
  if (viteConfig.file) {
    return {
      complete: true,
      source: { file: viteConfig.file, kind: 'vite' },
    };
  }
  return { complete: true };
}

function findFirstConfig(
  cwd: string,
  filenames: readonly string[]
): { complete: boolean; file?: string } {
  for (const filename of filenames) {
    const candidate = path.join(cwd, filename);
    try {
      return fs.statSync(candidate).isFile()
        ? { complete: true, file: candidate }
        : { complete: false };
    } catch (error) {
      if (isMissingPathError(error)) continue;
      return { complete: false };
    }
  }
  return { complete: true };
}

function resolveExplicitConfig(
  cwd: string,
  configuredPath: string
): string | undefined {
  if (!configuredPath.trim()) return undefined;
  const candidate = path.resolve(cwd, configuredPath);
  if (!isInsideDirectory(cwd, candidate)) return undefined;
  if (!VITE_CONFIG_EXTENSIONS.has(path.extname(candidate).toLowerCase())) {
    return undefined;
  }
  try {
    if (!fs.statSync(candidate).isFile()) return undefined;
    const realRoot = fs.realpathSync(cwd);
    const realCandidate = fs.realpathSync(candidate);
    if (!isInsideDirectory(realRoot, realCandidate)) return undefined;
    if (
      path
        .relative(realRoot, realCandidate)
        .split(path.sep)
        .includes('node_modules')
    ) {
      return undefined;
    }
    return candidate;
  } catch {
    return undefined;
  }
}

function isInsideDirectory(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function isMissingPathError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ENOTDIR')
  );
}

function completeAliasConfiguration(
  aliases: Map<string, string> = new Map()
): VueProjectAliasConfiguration {
  return { aliases, complete: true };
}

function incompleteAliasConfiguration(
  potentialAliasKeys: Iterable<string> = [],
  potentialAliases: ReadonlyMap<string, ReadonlySet<string>> = new Map()
): VueProjectAliasConfiguration {
  const keys = new Set(potentialAliasKeys);
  const aliases = clonePotentialAliases(potentialAliases);
  for (const key of aliases.keys()) keys.add(key);
  return {
    aliases: new Map(),
    complete: false,
    ...(aliases.size > 0 && { potentialAliases: aliases }),
    ...(keys.size > 0 && { potentialAliasKeys: keys }),
  };
}

function collectAliasResolutionKeys(
  ...sources: Array<StaticAliases | AliasResolution | undefined>
): Set<string> {
  const keys = new Set<string>();
  for (const source of sources) {
    if (!source) continue;
    if ('ok' in source) {
      addAll(
        keys,
        source.ok
          ? source.aliases.entries.map(([find]) => find)
          : source.potentialAliasKeys
      );
      continue;
    }
    for (const [find] of source.entries) keys.add(find);
  }
  return keys;
}

function collectAliasResolutionCandidates(
  ...sources: Array<StaticAliases | AliasResolution | undefined>
): Map<string, Set<string>> {
  const aliases = new Map<string, Set<string>>();
  for (const source of sources) {
    if (!source) continue;
    if ('ok' in source) {
      if (source.ok) {
        for (const [find, replacement] of source.aliases.entries) {
          addPotentialAlias(aliases, find, replacement);
        }
      } else {
        mergePotentialAliases(aliases, source.potentialAliases);
      }
      continue;
    }
    for (const [find, replacement] of source.entries) {
      addPotentialAlias(aliases, find, replacement);
    }
  }
  return aliases;
}

function readConfigAliases(
  source: ConfigSource,
  packageRoot: string,
  configuredNuxtMajor: number | undefined
): VueProjectAliasConfiguration {
  const ast = parseConfig(source.file);
  if (!ast) return incompleteAliasConfiguration();
  const { helpers, scopes } = collectAnalysisContext(ast);
  const activeExport = findActiveConfigExport(ast);
  if (!activeExport) return incompleteAliasConfiguration();
  const context: EvaluationContext = {
    configFile: source.file,
    helpers,
    nuxtMajorVersion:
      configuredNuxtMajor ?? readInstalledNuxtMajor(packageRoot),
    packageRoot,
    scopes,
  };
  const root = resolveConfigRoot(activeExport, context, new Set());
  const config = root
    ? resolveStaticObject(root, context, new Set(), 'config')
    : undefined;
  if (!config) return incompleteAliasConfiguration();

  if (source.kind === 'vite') {
    const aliases = readNestedAliasObject(
      config,
      ['resolve', 'alias'],
      context
    );
    if (!aliases) return completeAliasConfiguration();
    return aliases.ok
      ? completeAliasConfiguration(toFirstMatchMap(aliases.aliases.entries))
      : incompleteAliasConfiguration(
          aliases.potentialAliasKeys,
          aliases.potentialAliases
        );
  }

  const builtInAliases = readNuxtBuiltInAliases(config, context);
  if (!builtInAliases) return incompleteAliasConfiguration();
  const configuredNuxtAliases = readNestedAliasObject(
    config,
    ['alias'],
    context
  );
  const viteAliases = readNestedAliasObject(
    config,
    ['vite', 'resolve', 'alias'],
    context
  );
  if (configuredNuxtAliases && !configuredNuxtAliases.ok) {
    return incompleteAliasConfiguration(
      collectAliasResolutionKeys(
        builtInAliases,
        configuredNuxtAliases,
        viteAliases
      ),
      collectAliasResolutionCandidates(
        builtInAliases,
        configuredNuxtAliases,
        viteAliases
      )
    );
  }
  if (viteAliases && !viteAliases.ok) {
    return incompleteAliasConfiguration(
      collectAliasResolutionKeys(
        builtInAliases,
        configuredNuxtAliases,
        viteAliases
      ),
      collectAliasResolutionCandidates(
        builtInAliases,
        configuredNuxtAliases,
        viteAliases
      )
    );
  }
  if (
    configuredNuxtAliases?.ok &&
    configuredNuxtAliases.aliases.form !== 'object'
  ) {
    return incompleteAliasConfiguration(
      collectAliasResolutionKeys(
        builtInAliases,
        configuredNuxtAliases,
        viteAliases
      ),
      collectAliasResolutionCandidates(
        builtInAliases,
        configuredNuxtAliases,
        viteAliases
      )
    );
  }
  const nuxtAliases = mergeObjectAliases(
    builtInAliases,
    configuredNuxtAliases?.ok ? configuredNuxtAliases.aliases : undefined
  );
  return completeAliasConfiguration(
    mergeNuxtAliases(
      nuxtAliases,
      viteAliases?.ok ? viteAliases.aliases : undefined
    )
  );
}

function readNuxtBuiltInAliases(
  config: StaticObject,
  context: EvaluationContext
): StaticAliases | undefined {
  const configuredRoot = config.get('rootDir');
  const rootDirValue = configuredRoot
    ? resolveStaticString(configuredRoot, context, new Set())
    : undefined;
  if (configuredRoot && rootDirValue === undefined) return undefined;
  const rootDir = resolveSafeNuxtDirectory(
    context.packageRoot,
    rootDirValue ?? '.'
  );
  if (!rootDir) return undefined;

  const configuredSource = config.get('srcDir');
  const sourceValue = configuredSource
    ? resolveStaticString(configuredSource, context, new Set())
    : undefined;
  if (configuredSource && sourceValue === undefined) return undefined;
  const compatibilityMajor = readNuxtCompatibilityMajor(config, context);
  if (compatibilityMajor === null) return undefined;
  const effectiveNuxtMajor = compatibilityMajor ?? context.nuxtMajorVersion;
  const hasExplicitSource = Boolean(configuredSource && sourceValue);
  if (!hasExplicitSource && effectiveNuxtMajor === undefined) return undefined;
  const srcDir = hasExplicitSource
    ? resolveSafeNuxtDirectory(rootDir, sourceValue!)
    : effectiveNuxtMajor! >= 4
      ? resolveDefaultNuxt4SourceDirectory(rootDir)
      : rootDir;
  if (!srcDir) return undefined;

  const sourceAlias = withTrailingSlash(srcDir);
  const rootAlias = withTrailingSlash(rootDir);
  return {
    entries: [
      ['~', sourceAlias],
      ['@', sourceAlias],
      ['~~', rootAlias],
      ['@@', rootAlias],
    ],
    form: 'object',
  };
}

function readNuxtCompatibilityMajor(
  config: StaticObject,
  context: EvaluationContext
): number | null | undefined {
  const futureEntry = config.get('future');
  if (!futureEntry) return undefined;
  const future = resolveStaticObject(futureEntry, context, new Set(), 'config');
  if (!future) return null;
  const compatibilityEntry = future.get('compatibilityVersion');
  if (!compatibilityEntry) return undefined;
  return resolveStaticInteger(compatibilityEntry, context, new Set()) ?? null;
}

function resolveStaticInteger(
  entry: StaticEntry,
  context: EvaluationContext,
  seen: Set<t.Node>
): number | undefined {
  const unwrapped = unwrapEntry(entry);
  if (seen.has(unwrapped.node)) return undefined;
  seen.add(unwrapped.node);
  try {
    if (
      unwrapped.node.type === 'NumericLiteral' &&
      Number.isInteger(unwrapped.node.value)
    ) {
      return unwrapped.node.value;
    }
    if (
      unwrapped.node.type === 'StringLiteral' &&
      /^\d+$/.test(unwrapped.node.value)
    ) {
      return Number(unwrapped.node.value);
    }
    if (unwrapped.node.type !== 'Identifier') return undefined;
    const bound = resolveImmutableBinding(unwrapped, context, 'none');
    return bound ? resolveStaticInteger(bound, context, seen) : undefined;
  } finally {
    seen.delete(unwrapped.node);
  }
}

function resolveSafeNuxtDirectory(
  root: string,
  configuredPath: string
): string | undefined {
  const candidate = path.resolve(root, configuredPath);
  if (!isInsideDirectory(root, candidate)) return undefined;
  if (path.relative(root, candidate).split(path.sep).includes('node_modules')) {
    return undefined;
  }
  try {
    const realRoot = fs.realpathSync(root);
    let existingAncestor = candidate;
    while (!fs.existsSync(existingAncestor)) {
      const parent = path.dirname(existingAncestor);
      if (parent === existingAncestor) return undefined;
      existingAncestor = parent;
    }
    const realAncestor = fs.realpathSync(existingAncestor);
    const realCandidate = path.resolve(
      realAncestor,
      path.relative(existingAncestor, candidate)
    );
    return isInsideDirectory(realRoot, realCandidate) ? candidate : undefined;
  } catch {
    return undefined;
  }
}

function resolveDefaultNuxt4SourceDirectory(rootDir: string): string {
  const appDir = path.join(rootDir, 'app');
  try {
    if (!fs.statSync(appDir).isDirectory()) return rootDir;
    const meaningfulAppEntries = fs
      .readdirSync(appDir)
      .filter(
        (entry) =>
          entry !== 'spa-loading-template.html' &&
          !entry.startsWith('router.options')
      );
    if (meaningfulAppEntries.length > 0) return appDir;
    if (
      [
        'app.vue',
        'App.vue',
        'assets',
        'layouts',
        'middleware',
        'pages',
        'plugins',
      ]
        .map((entry) => path.join(rootDir, entry))
        .some((entry) => fs.existsSync(entry))
    ) {
      return rootDir;
    }
    return appDir;
  } catch {
    return rootDir;
  }
}

function withTrailingSlash(directory: string): string {
  return `${directory.replaceAll(path.sep, '/')}/`;
}

function readInstalledNuxtMajor(cwd: string): number | undefined {
  try {
    const requireFromProject = createRequire(path.join(cwd, 'package.json'));
    const manifestPath = requireFromProject.resolve('nuxt/package.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      version?: unknown;
    };
    if (typeof manifest.version !== 'string') return undefined;
    const major = Number(manifest.version.split('.')[0]);
    return Number.isInteger(major) ? major : undefined;
  } catch {
    return undefined;
  }
}

function parseConfig(configFile: string): t.File | undefined {
  try {
    const source = fs.readFileSync(configFile, 'utf8');
    const plugins: ParserPlugin[] = [
      'decorators-legacy',
      'typescript',
      'jsx',
      'importAttributes',
    ];
    return parse(source, {
      allowAwaitOutsideFunction: true,
      plugins,
      sourceType: 'unambiguous',
    });
  } catch {
    return undefined;
  }
}

function collectAnalysisContext(ast: t.File): {
  helpers: HelperBindings;
  scopes: WeakMap<t.Node, Scope>;
} {
  const helpers: HelperBindings = {
    configFunctions: new Set(),
    configNamespaces: new Set(),
    fileURLToPathFunctions: new Set(),
    pathNamespaces: new Set(),
    pathResolveFunctions: new Set(),
    urlConstructors: new Set(),
    urlNamespaces: new Set(),
  };
  const scopes = new WeakMap<t.Node, Scope>();

  traverse(ast, {
    enter(nodePath) {
      scopes.set(nodePath.node, nodePath.scope);
    },
    ImportDeclaration(importPath) {
      const source = importPath.node.source.value;
      for (const specifierPath of importPath.get('specifiers')) {
        const binding = specifierPath.scope.getBinding(
          specifierPath.node.local.name
        );
        if (!binding || !binding.constant || hasDirectMemberMutation(binding)) {
          continue;
        }
        const importedName =
          specifierPath.node.type === 'ImportSpecifier'
            ? specifierPath.node.imported.type === 'Identifier'
              ? specifierPath.node.imported.name
              : specifierPath.node.imported.value
            : specifierPath.node.type === 'ImportDefaultSpecifier'
              ? 'default'
              : '*';
        registerHelperBinding(helpers, source, importedName, binding);
      }
    },
    VariableDeclarator(variablePath) {
      registerRequireBinding(variablePath, helpers);
    },
  });

  return { helpers, scopes };
}

function registerHelperBinding(
  helpers: HelperBindings,
  source: string,
  importedName: string,
  binding: Binding
): void {
  if (
    source === 'vite' ||
    source === 'nuxt/config' ||
    source === 'nuxt' ||
    source === '#imports'
  ) {
    if (
      importedName === 'defineConfig' ||
      importedName === 'defineNuxtConfig'
    ) {
      helpers.configFunctions.add(binding);
    } else if (importedName === '*' || importedName === 'default') {
      helpers.configNamespaces.add(binding);
    }
    return;
  }
  if (source === 'node:path' || source === 'path') {
    if (importedName === 'resolve') {
      helpers.pathResolveFunctions.add(binding);
    } else if (importedName === '*' || importedName === 'default') {
      helpers.pathNamespaces.add(binding);
    }
    return;
  }
  if (source === 'node:url' || source === 'url') {
    if (importedName === 'fileURLToPath') {
      helpers.fileURLToPathFunctions.add(binding);
    } else if (importedName === 'URL') {
      helpers.urlConstructors.add(binding);
    } else if (importedName === '*' || importedName === 'default') {
      helpers.urlNamespaces.add(binding);
    }
  }
}

function registerRequireBinding(
  variablePath: NodePath<t.VariableDeclarator>,
  helpers: HelperBindings
): void {
  const source = readRequireSource(variablePath.node.init);
  if (!source) return;
  const idPath = variablePath.get('id');
  if (idPath.isIdentifier()) {
    const binding = idPath.scope.getBinding(idPath.node.name);
    if (!binding || !binding.constant || hasDirectMemberMutation(binding)) {
      return;
    }
    registerHelperBinding(helpers, source, '*', binding);
    return;
  }
  if (!idPath.isObjectPattern()) return;
  for (const propertyPath of idPath.get('properties')) {
    if (!propertyPath.isObjectProperty()) continue;
    const importedName = readPropertyKey(propertyPath.node);
    const valuePath = propertyPath.get('value');
    const localPath = valuePath.isAssignmentPattern()
      ? valuePath.get('left')
      : valuePath;
    if (!importedName || !localPath.isIdentifier()) continue;
    const binding = localPath.scope.getBinding(localPath.node.name);
    if (binding?.constant && !hasDirectMemberMutation(binding)) {
      registerHelperBinding(helpers, source, importedName, binding);
    }
  }
}

function readRequireSource(
  node: t.Expression | null | undefined
): string | undefined {
  const unwrapped = unwrapNode(node);
  if (
    !unwrapped ||
    unwrapped.type !== 'CallExpression' ||
    unwrapped.callee.type !== 'Identifier' ||
    unwrapped.callee.name !== 'require' ||
    unwrapped.arguments.length !== 1 ||
    unwrapped.arguments[0]?.type !== 'StringLiteral'
  ) {
    return undefined;
  }
  return unwrapped.arguments[0].value;
}

function findActiveConfigExport(ast: t.File): StaticEntry | undefined {
  const candidates: Array<StaticEntry & { start: number }> = [];
  traverse(ast, {
    ExportDefaultDeclaration(exportPath) {
      candidates.push({
        node: exportPath.node.declaration,
        scope: exportPath.scope,
        start: exportPath.node.start ?? -1,
      });
    },
    ExportNamedDeclaration(exportPath) {
      for (const specifierPath of exportPath.get('specifiers')) {
        if (!specifierPath.isExportSpecifier()) continue;
        const exported = specifierPath.node.exported;
        const exportedName =
          exported.type === 'Identifier' ? exported.name : exported.value;
        if (exportedName !== 'default') continue;
        candidates.push({
          node: specifierPath.node.local,
          scope: specifierPath.scope,
          start: exportPath.node.start ?? -1,
        });
      }
    },
    TSExportAssignment(exportPath) {
      candidates.push({
        node: exportPath.node.expression,
        scope: exportPath.scope,
        start: exportPath.node.start ?? -1,
      });
    },
    AssignmentExpression(assignmentPath) {
      if (!isCommonJsConfigExport(assignmentPath.node.left)) return;
      candidates.push({
        node: assignmentPath.node.right,
        scope: assignmentPath.scope,
        start: assignmentPath.node.start ?? -1,
      });
    },
  });
  candidates.sort((left, right) => left.start - right.start);
  return candidates.at(-1);
}

function isCommonJsConfigExport(
  node: t.LVal | t.OptionalMemberExpression
): boolean {
  if (node.type !== 'MemberExpression' || node.computed) return false;
  if (
    node.object.type === 'Identifier' &&
    node.property.type === 'Identifier'
  ) {
    return (
      (node.object.name === 'module' && node.property.name === 'exports') ||
      (node.object.name === 'exports' && node.property.name === 'default')
    );
  }
  if (
    node.object.type === 'MemberExpression' &&
    !node.object.computed &&
    node.object.object.type === 'Identifier' &&
    node.object.object.name === 'module' &&
    node.object.property.type === 'Identifier' &&
    node.object.property.name === 'exports' &&
    node.property.type === 'Identifier' &&
    node.property.name === 'default'
  ) {
    return true;
  }
  return false;
}

function resolveConfigRoot(
  entry: StaticEntry,
  context: EvaluationContext,
  seen: Set<t.Node>
): StaticEntry | undefined {
  const unwrapped = unwrapEntry(entry);
  if (seen.has(unwrapped.node)) return undefined;
  seen.add(unwrapped.node);
  try {
    if (unwrapped.node.type === 'Identifier') {
      const bound = resolveImmutableBinding(unwrapped, context, 'config');
      return bound ? resolveConfigRoot(bound, context, seen) : undefined;
    }
    if (
      unwrapped.node.type === 'CallExpression' ||
      unwrapped.node.type === 'OptionalCallExpression'
    ) {
      if (!isConfigHelperCall(unwrapped, context.helpers)) return undefined;
      const argument = unwrapped.node.arguments[0];
      if (
        !argument ||
        argument.type === 'SpreadElement' ||
        argument.type === 'ArgumentPlaceholder'
      ) {
        return undefined;
      }
      return resolveConfigRoot(
        scopedEntry(argument, unwrapped.scope, context),
        context,
        seen
      );
    }
    if (
      unwrapped.node.type === 'ArrowFunctionExpression' ||
      unwrapped.node.type === 'FunctionExpression' ||
      unwrapped.node.type === 'FunctionDeclaration'
    ) {
      const returned = readStaticFunctionReturn(unwrapped, context);
      return returned ? resolveConfigRoot(returned, context, seen) : undefined;
    }
    return unwrapped;
  } finally {
    seen.delete(unwrapped.node);
  }
}

function isConfigHelperCall(
  entry: StaticEntry,
  helpers: HelperBindings
): boolean {
  if (
    entry.node.type !== 'CallExpression' &&
    entry.node.type !== 'OptionalCallExpression'
  ) {
    return false;
  }
  const callee = unwrapNode(entry.node.callee);
  if (!callee) return false;
  if (callee.type === 'Identifier') {
    const binding = entry.scope.getBinding(callee.name);
    return binding
      ? helpers.configFunctions.has(binding)
      : callee.name === 'defineConfig' || callee.name === 'defineNuxtConfig';
  }
  if (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object.type === 'Identifier' &&
    callee.property.type === 'Identifier' &&
    (callee.property.name === 'defineConfig' ||
      callee.property.name === 'defineNuxtConfig')
  ) {
    const binding = entry.scope.getBinding(callee.object.name);
    return Boolean(binding && helpers.configNamespaces.has(binding));
  }
  return false;
}

function readStaticFunctionReturn(
  entry: StaticEntry,
  context: EvaluationContext
): StaticEntry | undefined {
  if (
    entry.node.type !== 'ArrowFunctionExpression' &&
    entry.node.type !== 'FunctionExpression' &&
    entry.node.type !== 'FunctionDeclaration'
  ) {
    return undefined;
  }
  if (entry.node.body.type !== 'BlockStatement') {
    return scopedEntry(entry.node.body, entry.scope, context);
  }
  const returns = entry.node.body.body.filter(
    (statement): statement is t.ReturnStatement =>
      statement.type === 'ReturnStatement' && Boolean(statement.argument)
  );
  if (returns.length !== 1 || !returns[0]!.argument) return undefined;
  return scopedEntry(returns[0]!.argument, entry.scope, context);
}

function readNestedAliasObject(
  root: StaticObject,
  keys: readonly string[],
  context: EvaluationContext
): AliasResolution | undefined {
  let entry: StaticEntry | undefined;
  let object = root;
  for (const [index, key] of keys.entries()) {
    entry = object.get(key);
    if (!entry) return undefined;
    if (isDefinitelyAbsentAliasValue(entry, context, new Set())) {
      return undefined;
    }
    if (index === keys.length - 1) break;
    const nested = resolveStaticObject(entry, context, new Set(), 'config');
    if (!nested) {
      return {
        ok: false,
        potentialAliasKeys: new Set(),
        potentialAliases: new Map(),
      };
    }
    object = nested;
  }
  return entry ? readAliasValue(entry, context) : undefined;
}

function isDefinitelyAbsentAliasValue(
  entry: StaticEntry,
  context: EvaluationContext,
  seen: Set<t.Node>
): boolean {
  const unwrapped = unwrapEntry(entry);
  if (seen.has(unwrapped.node)) return false;
  seen.add(unwrapped.node);
  try {
    if (unwrapped.node.type === 'NullLiteral') return true;
    if (unwrapped.node.type === 'BooleanLiteral' && !unwrapped.node.value) {
      return true;
    }
    if (
      unwrapped.node.type === 'Identifier' &&
      unwrapped.node.name === 'undefined' &&
      !unwrapped.scope.getBinding('undefined')
    ) {
      return true;
    }
    if (
      unwrapped.node.type === 'UnaryExpression' &&
      unwrapped.node.operator === 'void'
    ) {
      return true;
    }
    if (unwrapped.node.type !== 'Identifier') return false;
    const bound = resolveImmutableBinding(unwrapped, context, 'none');
    return bound ? isDefinitelyAbsentAliasValue(bound, context, seen) : false;
  } finally {
    seen.delete(unwrapped.node);
  }
}

function readAliasValue(
  entry: StaticEntry,
  context: EvaluationContext
): AliasResolution {
  const potentialAliasKeys = collectPotentialAliasKeys(
    entry,
    context,
    new Set()
  );
  const potentialAliases = collectPotentialAliases(entry, context, new Set());
  const object = resolveStaticObject(entry, context, new Set(), 'alias');
  if (object) {
    const entries: Array<readonly [string, string]> = [];
    for (const [find, replacementEntry] of object) {
      const replacement = resolveStaticString(
        replacementEntry,
        context,
        new Set()
      );
      if (replacement === undefined) {
        return { ok: false, potentialAliasKeys, potentialAliases };
      }
      entries.push([find, replacement]);
    }
    return { ok: true, aliases: { entries, form: 'object' } };
  }

  const entries = resolveStaticArray(entry, context, new Set(), 'alias');
  if (!entries) {
    return { ok: false, potentialAliasKeys, potentialAliases };
  }
  const arrayAliases = new Map<string, string>();
  for (const item of entries) {
    const aliasObject = resolveStaticObject(item, context, new Set(), 'alias');
    if (!aliasObject || aliasObject.has('customResolver')) {
      return { ok: false, potentialAliasKeys, potentialAliases };
    }
    const findEntry = aliasObject.get('find');
    const replacementEntry = aliasObject.get('replacement');
    if (!findEntry || !replacementEntry) {
      return { ok: false, potentialAliasKeys, potentialAliases };
    }
    const find = resolveStaticString(findEntry, context, new Set());
    const replacement = resolveStaticString(
      replacementEntry,
      context,
      new Set()
    );
    if (find === undefined || replacement === undefined) {
      return { ok: false, potentialAliasKeys, potentialAliases };
    }
    if (!arrayAliases.has(find)) arrayAliases.set(find, replacement);
  }
  return {
    ok: true,
    aliases: { entries: [...arrayAliases], form: 'array' },
  };
}

/** Collects only fully static key-to-replacement candidates. */
function collectPotentialAliases(
  entry: StaticEntry,
  context: EvaluationContext,
  seen: Set<t.Node>
): Map<string, Set<string>> {
  const unwrapped = unwrapEntry(entry);
  if (seen.has(unwrapped.node)) return new Map();
  seen.add(unwrapped.node);
  try {
    if (unwrapped.node.type === 'Identifier') {
      const bound = resolveImmutableBinding(unwrapped, context, 'none');
      return bound ? collectPotentialAliases(bound, context, seen) : new Map();
    }
    if (unwrapped.node.type === 'ObjectExpression') {
      const aliases = new Map<string, Set<string>>();
      for (const property of unwrapped.node.properties) {
        if (property.type === 'SpreadElement') {
          mergePotentialAliases(
            aliases,
            collectPotentialAliases(
              scopedEntry(property.argument, unwrapped.scope, context),
              context,
              seen
            )
          );
          continue;
        }
        if (property.type !== 'ObjectProperty') continue;
        const find = readPropertyKey(property);
        if (find === undefined) continue;
        const replacement = resolveStaticString(
          scopedEntry(property.value, unwrapped.scope, context),
          context,
          new Set()
        );
        if (replacement !== undefined) {
          addPotentialAlias(aliases, find, replacement);
        }
      }
      return aliases;
    }
    if (unwrapped.node.type === 'ArrayExpression') {
      const aliases = new Map<string, Set<string>>();
      for (const element of unwrapped.node.elements) {
        if (!element) continue;
        if (element.type === 'SpreadElement') {
          mergePotentialAliases(
            aliases,
            collectPotentialAliases(
              scopedEntry(element.argument, unwrapped.scope, context),
              context,
              seen
            )
          );
          continue;
        }
        const item = scopedEntry(element, unwrapped.scope, context);
        const aliasObject = resolveStaticObject(
          item,
          context,
          new Set(),
          'none'
        );
        const findEntry = aliasObject?.get('find');
        const replacementEntry = aliasObject?.get('replacement');
        if (!findEntry || !replacementEntry) continue;
        const find = resolveStaticString(findEntry, context, new Set());
        const replacement = resolveStaticString(
          replacementEntry,
          context,
          new Set()
        );
        if (find !== undefined && replacement !== undefined) {
          addPotentialAlias(aliases, find, replacement);
        }
      }
      return aliases;
    }
    return new Map();
  } finally {
    seen.delete(unwrapped.node);
  }
}

/**
 * Collects statically visible alias keys without claiming that their final
 * replacement or precedence is known. Dynamic spreads and overrides can make
 * the full alias surface incomplete, but the observed keys remain useful as
 * narrowly scoped evidence that an import may belong to the Vue project.
 */
function collectPotentialAliasKeys(
  entry: StaticEntry,
  context: EvaluationContext,
  seen: Set<t.Node>
): Set<string> {
  const unwrapped = unwrapEntry(entry);
  if (seen.has(unwrapped.node)) return new Set();
  seen.add(unwrapped.node);
  try {
    if (unwrapped.node.type === 'Identifier') {
      const bound = resolveImmutableBinding(unwrapped, context, 'none');
      return bound
        ? collectPotentialAliasKeys(bound, context, seen)
        : new Set();
    }
    if (unwrapped.node.type === 'ObjectExpression') {
      const keys = new Set<string>();
      for (const property of unwrapped.node.properties) {
        if (property.type === 'SpreadElement') {
          addAll(
            keys,
            collectPotentialAliasKeys(
              scopedEntry(property.argument, unwrapped.scope, context),
              context,
              seen
            )
          );
          continue;
        }
        if (
          property.type !== 'ObjectProperty' &&
          property.type !== 'ObjectMethod'
        ) {
          continue;
        }
        const key = readPropertyKey(property);
        if (key !== undefined) keys.add(key);
      }
      return keys;
    }
    if (unwrapped.node.type === 'ArrayExpression') {
      const keys = new Set<string>();
      for (const element of unwrapped.node.elements) {
        if (!element) continue;
        if (element.type === 'SpreadElement') {
          addAll(
            keys,
            collectPotentialAliasKeys(
              scopedEntry(element.argument, unwrapped.scope, context),
              context,
              seen
            )
          );
          continue;
        }
        addAll(
          keys,
          collectPotentialArrayAliasKeys(
            scopedEntry(element, unwrapped.scope, context),
            context,
            seen
          )
        );
      }
      return keys;
    }
    return new Set();
  } finally {
    seen.delete(unwrapped.node);
  }
}

function collectPotentialArrayAliasKeys(
  entry: StaticEntry,
  context: EvaluationContext,
  seen: Set<t.Node>
): Set<string> {
  const unwrapped = unwrapEntry(entry);
  if (seen.has(unwrapped.node)) return new Set();
  seen.add(unwrapped.node);
  try {
    if (unwrapped.node.type === 'Identifier') {
      const bound = resolveImmutableBinding(unwrapped, context, 'none');
      return bound
        ? collectPotentialArrayAliasKeys(bound, context, seen)
        : new Set();
    }
    if (unwrapped.node.type !== 'ObjectExpression') return new Set();
    const keys = new Set<string>();
    for (const property of unwrapped.node.properties) {
      if (property.type === 'SpreadElement') {
        addAll(
          keys,
          collectPotentialArrayAliasKeys(
            scopedEntry(property.argument, unwrapped.scope, context),
            context,
            seen
          )
        );
        continue;
      }
      if (
        property.type !== 'ObjectProperty' ||
        readPropertyKey(property) !== 'find'
      ) {
        continue;
      }
      const find = resolveStaticString(
        scopedEntry(property.value, unwrapped.scope, context),
        context,
        new Set()
      );
      if (find !== undefined) keys.add(find);
    }
    return keys;
  } finally {
    seen.delete(unwrapped.node);
  }
}

function addAll(target: Set<string>, values: Iterable<string>): void {
  for (const value of values) target.add(value);
}

function addPotentialAlias(
  target: Map<string, Set<string>>,
  find: string,
  replacement: string
): void {
  const replacements = target.get(find) ?? new Set<string>();
  replacements.add(replacement);
  target.set(find, replacements);
}

function mergePotentialAliases(
  target: Map<string, Set<string>>,
  source: ReadonlyMap<string, ReadonlySet<string>>
): void {
  for (const [find, replacements] of source) {
    for (const replacement of replacements) {
      addPotentialAlias(target, find, replacement);
    }
  }
}

function clonePotentialAliases(
  aliases: ReadonlyMap<string, ReadonlySet<string>>
): Map<string, Set<string>> {
  const clone = new Map<string, Set<string>>();
  mergePotentialAliases(clone, aliases);
  return clone;
}

function resolveStaticObject(
  entry: StaticEntry,
  context: EvaluationContext,
  seen: Set<t.Node>,
  bindingSafety: BindingSafety
): StaticObject | undefined {
  const unwrapped = unwrapEntry(entry);
  if (seen.has(unwrapped.node)) return undefined;
  seen.add(unwrapped.node);
  try {
    if (unwrapped.node.type === 'Identifier') {
      const bound = resolveImmutableBinding(unwrapped, context, bindingSafety);
      return bound
        ? resolveStaticObject(bound, context, seen, bindingSafety)
        : undefined;
    }
    if (unwrapped.node.type !== 'ObjectExpression') return undefined;
    const object: StaticObject = new Map();
    for (const property of unwrapped.node.properties) {
      if (property.type === 'SpreadElement') {
        const spread = resolveStaticObject(
          scopedEntry(property.argument, unwrapped.scope, context),
          context,
          seen,
          bindingSafety
        );
        if (!spread) return undefined;
        for (const pair of spread) object.set(...pair);
        continue;
      }
      if (
        property.type !== 'ObjectProperty' &&
        property.type !== 'ObjectMethod'
      ) {
        continue;
      }
      const key = readPropertyKey(property);
      if (key === undefined) return undefined;
      object.set(
        key,
        scopedEntry(
          property.type === 'ObjectProperty' ? property.value : property,
          unwrapped.scope,
          context
        )
      );
    }
    return object;
  } finally {
    seen.delete(unwrapped.node);
  }
}

function resolveStaticArray(
  entry: StaticEntry,
  context: EvaluationContext,
  seen: Set<t.Node>,
  bindingSafety: BindingSafety
): StaticEntry[] | undefined {
  const unwrapped = unwrapEntry(entry);
  if (seen.has(unwrapped.node)) return undefined;
  seen.add(unwrapped.node);
  try {
    if (unwrapped.node.type === 'Identifier') {
      const bound = resolveImmutableBinding(unwrapped, context, bindingSafety);
      return bound
        ? resolveStaticArray(bound, context, seen, bindingSafety)
        : undefined;
    }
    if (unwrapped.node.type !== 'ArrayExpression') return undefined;
    const result: StaticEntry[] = [];
    for (const element of unwrapped.node.elements) {
      if (!element) continue;
      if (element.type === 'SpreadElement') {
        const spread = resolveStaticArray(
          scopedEntry(element.argument, unwrapped.scope, context),
          context,
          seen,
          bindingSafety
        );
        if (!spread) return undefined;
        result.push(...spread);
        continue;
      }
      result.push(scopedEntry(element, unwrapped.scope, context));
    }
    return result;
  } finally {
    seen.delete(unwrapped.node);
  }
}

function resolveStaticString(
  entry: StaticEntry,
  context: EvaluationContext,
  seen: Set<t.Node>
): string | undefined {
  const unwrapped = unwrapEntry(entry);
  if (seen.has(unwrapped.node)) return undefined;
  seen.add(unwrapped.node);
  try {
    const node = unwrapped.node;
    if (node.type === 'StringLiteral') return node.value;
    if (node.type === 'Identifier') {
      if (node.name === '__dirname' && !unwrapped.scope.getBinding(node.name)) {
        return path.dirname(context.configFile);
      }
      const bound = resolveImmutableBinding(unwrapped, context, 'none');
      return bound ? resolveStaticString(bound, context, seen) : undefined;
    }
    if (node.type === 'TemplateLiteral') {
      let value = node.quasis[0]?.value.cooked ?? '';
      for (const [index, expression] of node.expressions.entries()) {
        const resolved = resolveStaticString(
          scopedEntry(expression, unwrapped.scope, context),
          context,
          seen
        );
        if (resolved === undefined) return undefined;
        value += resolved + (node.quasis[index + 1]?.value.cooked ?? '');
      }
      return value;
    }
    if (node.type === 'BinaryExpression' && node.operator === '+') {
      const left = resolveStaticString(
        scopedEntry(node.left, unwrapped.scope, context),
        context,
        seen
      );
      const right = resolveStaticString(
        scopedEntry(node.right, unwrapped.scope, context),
        context,
        seen
      );
      return left === undefined || right === undefined
        ? undefined
        : left + right;
    }
    if (
      node.type === 'CallExpression' ||
      node.type === 'OptionalCallExpression'
    ) {
      if (isPathResolveCall(unwrapped, context.helpers)) {
        const parts: string[] = [];
        for (const argument of node.arguments) {
          if (
            argument.type === 'SpreadElement' ||
            argument.type === 'ArgumentPlaceholder'
          ) {
            return undefined;
          }
          const part = resolveStaticString(
            scopedEntry(argument, unwrapped.scope, context),
            context,
            seen
          );
          if (part === undefined) return undefined;
          parts.push(part);
        }
        if (parts.length === 0 || !path.isAbsolute(parts[0]!)) {
          return undefined;
        }
        return path.resolve(...parts);
      }
      if (isFileURLToPathCall(unwrapped, context.helpers)) {
        const argument = node.arguments[0];
        if (
          !argument ||
          argument.type === 'SpreadElement' ||
          argument.type === 'ArgumentPlaceholder'
        ) {
          return undefined;
        }
        const url = resolveStaticUrl(
          scopedEntry(argument, unwrapped.scope, context),
          context,
          seen
        );
        if (!url || url.protocol !== 'file:') return undefined;
        return fileURLToPath(url);
      }
    }
    if (
      node.type === 'MemberExpression' &&
      !node.computed &&
      node.object.type === 'MetaProperty' &&
      node.object.meta.name === 'import' &&
      node.object.property.name === 'meta' &&
      node.property.type === 'Identifier' &&
      node.property.name === 'dirname'
    ) {
      return path.dirname(context.configFile);
    }
    return undefined;
  } finally {
    seen.delete(unwrapped.node);
  }
}

function resolveStaticUrl(
  entry: StaticEntry,
  context: EvaluationContext,
  seen: Set<t.Node>
): URL | undefined {
  const unwrapped = unwrapEntry(entry);
  if (seen.has(unwrapped.node)) return undefined;
  seen.add(unwrapped.node);
  try {
    if (unwrapped.node.type === 'Identifier') {
      const bound = resolveImmutableBinding(unwrapped, context, 'none');
      return bound ? resolveStaticUrl(bound, context, seen) : undefined;
    }
    if (
      unwrapped.node.type !== 'NewExpression' ||
      unwrapped.node.callee.type !== 'Identifier' ||
      unwrapped.node.callee.name !== 'URL' ||
      !isTrustedUrlConstructor(unwrapped, context.helpers) ||
      unwrapped.node.arguments.length !== 2
    ) {
      return undefined;
    }
    const [relativeArgument, baseArgument] = unwrapped.node.arguments;
    if (
      !relativeArgument ||
      relativeArgument.type === 'SpreadElement' ||
      relativeArgument.type === 'ArgumentPlaceholder' ||
      !baseArgument ||
      baseArgument.type === 'SpreadElement' ||
      baseArgument.type === 'ArgumentPlaceholder' ||
      !isImportMetaUrl(baseArgument)
    ) {
      return undefined;
    }
    const relative = resolveStaticString(
      scopedEntry(relativeArgument, unwrapped.scope, context),
      context,
      seen
    );
    if (relative === undefined) return undefined;
    return new URL(relative, pathToFileURL(context.configFile));
  } catch {
    return undefined;
  } finally {
    seen.delete(unwrapped.node);
  }
}

/** Accepts the global URL constructor and immutable imports from node:url. */
function isTrustedUrlConstructor(
  entry: StaticEntry,
  helpers: HelperBindings
): boolean {
  if (
    entry.node.type !== 'NewExpression' ||
    entry.node.callee.type !== 'Identifier' ||
    entry.node.callee.name !== 'URL'
  ) {
    return false;
  }
  const binding = entry.scope.getBinding(entry.node.callee.name);
  return binding === undefined || helpers.urlConstructors.has(binding);
}

function isPathResolveCall(
  entry: StaticEntry,
  helpers: HelperBindings
): boolean {
  if (
    entry.node.type !== 'CallExpression' &&
    entry.node.type !== 'OptionalCallExpression'
  ) {
    return false;
  }
  const callee = unwrapNode(entry.node.callee);
  if (!callee) return false;
  if (callee.type === 'Identifier') {
    const binding = entry.scope.getBinding(callee.name);
    return Boolean(binding && helpers.pathResolveFunctions.has(binding));
  }
  if (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object.type === 'Identifier' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'resolve'
  ) {
    const binding = entry.scope.getBinding(callee.object.name);
    return Boolean(binding && helpers.pathNamespaces.has(binding));
  }
  return false;
}

function isFileURLToPathCall(
  entry: StaticEntry,
  helpers: HelperBindings
): boolean {
  if (
    entry.node.type !== 'CallExpression' &&
    entry.node.type !== 'OptionalCallExpression'
  ) {
    return false;
  }
  const callee = unwrapNode(entry.node.callee);
  if (!callee) return false;
  if (callee.type === 'Identifier') {
    const binding = entry.scope.getBinding(callee.name);
    return Boolean(binding && helpers.fileURLToPathFunctions.has(binding));
  }
  if (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object.type === 'Identifier' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'fileURLToPath'
  ) {
    const binding = entry.scope.getBinding(callee.object.name);
    return Boolean(binding && helpers.urlNamespaces.has(binding));
  }
  return false;
}

function isImportMetaUrl(node: t.Node): boolean {
  const unwrapped = unwrapNode(node);
  return Boolean(
    unwrapped &&
    unwrapped.type === 'MemberExpression' &&
    !unwrapped.computed &&
    unwrapped.object.type === 'MetaProperty' &&
    unwrapped.object.meta.name === 'import' &&
    unwrapped.object.property.name === 'meta' &&
    unwrapped.property.type === 'Identifier' &&
    unwrapped.property.name === 'url'
  );
}

function resolveImmutableBinding(
  entry: StaticEntry,
  context: EvaluationContext,
  safety: BindingSafety
): StaticEntry | undefined {
  if (entry.node.type !== 'Identifier') return undefined;
  const binding = entry.scope.getBinding(entry.node.name);
  if (
    !binding ||
    binding.kind !== 'const' ||
    !binding.constant ||
    binding.constantViolations.length > 0 ||
    !binding.path.isVariableDeclarator() ||
    hasDirectMemberMutation(binding) ||
    (safety === 'alias' &&
      hasUnsafeAliasBindingUse(binding, context, new Set())) ||
    (safety === 'config' &&
      !isSafeConfigBinding(binding, context, new Set())) ||
    !binding.path.node.init
  ) {
    return undefined;
  }
  return scopedEntry(binding.path.node.init, binding.path.scope, context);
}

function hasUnsafeAliasBindingUse(
  binding: Binding,
  context: EvaluationContext,
  seen: Set<Binding>
): boolean {
  if (seen.has(binding)) return false;
  seen.add(binding);
  try {
    return binding.referencePaths.some((referencePath) => {
      let targetPath = unwrapReferencePath(referencePath);
      while (
        (targetPath.parentPath?.isMemberExpression() ||
          targetPath.parentPath?.isOptionalMemberExpression()) &&
        targetPath.parentPath.node.object === targetPath.node
      ) {
        targetPath = targetPath.parentPath;
      }
      const parentPath = targetPath.parentPath;
      if (!parentPath) return true;
      if (parentPath.isAssignmentExpression()) return true;
      if (parentPath.isUpdateExpression()) return true;
      if (parentPath.isUnaryExpression({ operator: 'delete' })) return true;
      if (
        parentPath.isCallExpression() ||
        parentPath.isOptionalCallExpression()
      ) {
        if (parentPath.node.callee === targetPath.node) return true;
        return !isConfigHelperCall(
          { node: parentPath.node, scope: parentPath.scope },
          context.helpers
        );
      }
      if (parentPath.isSpreadElement()) {
        return !isSafeConfigValuePath(parentPath.parentPath, context, seen);
      }
      if (parentPath.isObjectProperty()) {
        return !(
          parentPath.node.value === targetPath.node &&
          readPropertyKey(parentPath.node) === 'alias' &&
          isSafeConfigValuePath(parentPath.parentPath, context, seen)
        );
      }
      if (parentPath.isArrayExpression()) {
        return !isSafeConfigValuePath(parentPath, context, seen);
      }
      if (parentPath.isVariableDeclarator()) {
        if (
          parentPath.node.init !== targetPath.node ||
          parentPath.node.id.type !== 'Identifier' ||
          !parentPath.parentPath?.isVariableDeclaration({ kind: 'const' })
        ) {
          return true;
        }
        const aliasBinding = parentPath.scope.getBinding(
          parentPath.node.id.name
        );
        return (
          !aliasBinding || hasUnsafeAliasBindingUse(aliasBinding, context, seen)
        );
      }
      return true;
    });
  } finally {
    seen.delete(binding);
  }
}

function hasDirectMemberMutation(binding: Binding): boolean {
  return binding.referencePaths.some((referencePath) => {
    let targetPath = unwrapReferencePath(referencePath);
    while (
      (targetPath.parentPath?.isMemberExpression() ||
        targetPath.parentPath?.isOptionalMemberExpression()) &&
      targetPath.parentPath.node.object === targetPath.node
    ) {
      targetPath = targetPath.parentPath;
    }
    const parentPath = targetPath.parentPath;
    return Boolean(
      parentPath &&
      (parentPath.isAssignmentExpression() ||
        parentPath.isUpdateExpression() ||
        parentPath.isUnaryExpression({ operator: 'delete' }))
    );
  });
}

function isSafeConfigValuePath(
  inputPath: NodePath | null,
  context: EvaluationContext,
  seen: Set<Binding>
): boolean {
  if (!inputPath) return false;
  const targetPath = unwrapReferencePath(inputPath);
  const parentPath = targetPath.parentPath;
  if (!parentPath) return false;
  if (parentPath.isObjectProperty()) {
    if (parentPath.node.value !== targetPath.node) return false;
    return isSafeConfigValuePath(parentPath.parentPath, context, seen);
  }
  if (parentPath.isSpreadElement()) {
    return isSafeConfigValuePath(parentPath.parentPath, context, seen);
  }
  if (parentPath.isArrowFunctionExpression()) {
    if (parentPath.node.body !== targetPath.node) return false;
    return isSafeConfigValuePath(parentPath, context, seen);
  }
  if (parentPath.isReturnStatement()) {
    const functionScope = parentPath.scope.getFunctionParent();
    return functionScope
      ? isSafeConfigValuePath(functionScope.path, context, seen)
      : false;
  }
  if (parentPath.isVariableDeclarator()) {
    if (
      parentPath.node.init !== targetPath.node ||
      parentPath.node.id.type !== 'Identifier' ||
      !parentPath.parentPath?.isVariableDeclaration({ kind: 'const' })
    ) {
      return false;
    }
    const binding = parentPath.scope.getBinding(parentPath.node.id.name);
    return binding ? isSafeConfigBinding(binding, context, seen) : false;
  }
  if (parentPath.isCallExpression() || parentPath.isOptionalCallExpression()) {
    if (!parentPath.node.arguments.includes(targetPath.node as t.Expression)) {
      return false;
    }
    return isConfigHelperCall(
      { node: parentPath.node, scope: parentPath.scope },
      context.helpers
    );
  }
  if (parentPath.isExportDefaultDeclaration()) return true;
  if (parentPath.isExportSpecifier()) {
    const exported = parentPath.node.exported;
    return (
      (exported.type === 'Identifier' ? exported.name : exported.value) ===
      'default'
    );
  }
  if (parentPath.isAssignmentExpression()) {
    return (
      parentPath.node.right === targetPath.node &&
      isCommonJsConfigExport(parentPath.node.left)
    );
  }
  return false;
}

function isSafeConfigBinding(
  binding: Binding,
  context: EvaluationContext,
  seen: Set<Binding>
): boolean {
  if (seen.has(binding)) return true;
  if (
    binding.kind !== 'const' ||
    !binding.constant ||
    binding.constantViolations.length > 0
  ) {
    return false;
  }
  seen.add(binding);
  try {
    return binding.referencePaths.every((referencePath) =>
      isSafeConfigValuePath(referencePath, context, seen)
    );
  } finally {
    seen.delete(binding);
  }
}

function unwrapReferencePath(referencePath: NodePath): NodePath {
  let targetPath = referencePath;
  while (
    targetPath.parentPath &&
    isTransparentExpression(targetPath.parentPath.node) &&
    targetPath.parentPath.node.expression === targetPath.node
  ) {
    targetPath = targetPath.parentPath;
  }
  return targetPath;
}

function isTransparentExpression(
  node: t.Node
): node is
  | t.TSAsExpression
  | t.TSSatisfiesExpression
  | t.TSNonNullExpression
  | t.TypeCastExpression
  | t.ParenthesizedExpression
  | t.TSInstantiationExpression {
  return (
    node.type === 'TSAsExpression' ||
    node.type === 'TSSatisfiesExpression' ||
    node.type === 'TSNonNullExpression' ||
    node.type === 'TypeCastExpression' ||
    node.type === 'ParenthesizedExpression' ||
    node.type === 'TSInstantiationExpression'
  );
}

function scopedEntry(
  node: t.Node,
  fallbackScope: Scope,
  context: EvaluationContext
): StaticEntry {
  return { node, scope: context.scopes.get(node) ?? fallbackScope };
}

function toFirstMatchMap(
  entries: readonly (readonly [string, string])[]
): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const [find, replacement] of entries) {
    if (!aliases.has(find)) aliases.set(find, replacement);
  }
  return aliases;
}

function mergeObjectAliases(
  defaults: StaticAliases,
  overrides: StaticAliases | undefined
): StaticAliases {
  if (!overrides) return defaults;
  const entries = new Map(defaults.entries);
  for (const [find, replacement] of overrides.entries) {
    entries.set(find, replacement);
  }
  return { entries: [...entries], form: 'object' };
}

/**
 * Mirrors Vite's mergeAlias behavior used by Nuxt. Two object forms merge in
 * property order with nested `vite.resolve.alias` values overriding duplicate
 * Nuxt aliases. If either side is an array, nested Vite aliases are prepended
 * because Vite resolves array aliases from first to last.
 */
function mergeNuxtAliases(
  nuxtAliases: StaticAliases | undefined,
  viteAliases: StaticAliases | undefined
): Map<string, string> {
  if (!nuxtAliases) return toFirstMatchMap(viteAliases?.entries ?? []);
  if (!viteAliases) return toFirstMatchMap(nuxtAliases.entries);
  if (nuxtAliases.form === 'object' && viteAliases.form === 'object') {
    const merged = new Map(nuxtAliases.entries);
    for (const [find, replacement] of viteAliases.entries) {
      merged.set(find, replacement);
    }
    return merged;
  }
  return toFirstMatchMap([...viteAliases.entries, ...nuxtAliases.entries]);
}

function readPropertyKey(
  property: t.ObjectMethod | t.ObjectProperty
): string | undefined {
  if (!property.computed && property.key.type === 'Identifier') {
    return property.key.name;
  }
  if (property.key.type === 'StringLiteral') return property.key.value;
  if (property.key.type === 'NumericLiteral') return String(property.key.value);
  return undefined;
}

function unwrapEntry(entry: StaticEntry): StaticEntry {
  return { node: unwrapNode(entry.node) ?? entry.node, scope: entry.scope };
}

function unwrapNode(node: t.Node | null | undefined): t.Node | undefined {
  let current = node;
  while (current) {
    if (isTransparentExpression(current)) {
      current = current.expression;
      continue;
    }
    break;
  }
  return current ?? undefined;
}
