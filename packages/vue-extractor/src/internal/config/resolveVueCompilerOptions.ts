import fs from 'node:fs';
import path from 'node:path';
import { parse, type ParserPlugin } from '@babel/parser';
import traverseModule, {
  type Binding,
  type NodePath,
  type Scope,
} from '@babel/traverse';
import type * as t from '@babel/types';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/internal';
import type { VueCompilerOptions } from '../../types.js';
import {
  NUXT_CONFIG_FILES,
  VITE_CONFIG_EXTENSIONS,
  VITE_CONFIG_FILES,
} from './configFiles.js';

const traverse = traverseModule.default || traverseModule;

type CompilerOptionName = keyof VueCompilerOptions;

type OptionSource = {
  file: string;
  node?: t.Node;
};

type CompilerOptionState = {
  options: VueCompilerOptions;
  sources: Partial<Record<CompilerOptionName, OptionSource>>;
};

type ObjectEntry = {
  node: t.Node;
  scope: Scope;
};

type StaticObject = {
  entries: Map<string, ObjectEntry>;
};

type ObjectResolution =
  | { ok: true; value: StaticObject }
  | { ok: false; node: t.Node };

type ActiveConfigResolution =
  | { ok: true; value: ObjectEntry }
  | { ok: false; node: t.Node };

type ConfigHelperResolution = 'dynamic' | 'static' | undefined;

type ScopedPluginCall = {
  node: t.CallExpression | t.OptionalCallExpression;
  scope: Scope;
};

type VitePluginContext = {
  moduleSource: '@vitejs/plugin-vue' | '@vitejs/plugin-vue-jsx';
  namespaceBindings: Set<Binding>;
  pluginBindings: Set<Binding>;
  referencePositions: number[];
};

/** Result of resolving hash-affecting options from project configuration. */
export type VueCompilerOptionsResolution = {
  /** Static compiler options that must be passed to Vue source extraction. */
  compilerOptions: VueCompilerOptions;
  /** Diagnostics that make extraction unsafe until the configuration is fixed. */
  errors: string[];
};

/** Controls project configuration discovery for compiler-option resolution. */
export type VueCompilerOptionsResolverOptions = {
  /** A single explicit Vite config path, resolved relative to the project root. */
  viteConfigPath?: string;
  /**
   * Whether caller-supplied source globs already cover custom Nuxt layouts.
   * This relaxes only layout validation; discovered config remains mandatory
   * to read and parse successfully.
   */
  sourceDiscoveryIsExplicit?: boolean;
};

/**
 * Resolves hash-affecting Vue template compiler options without executing
 * project configuration files.
 *
 * Explicit `gt.config.json` values are combined with statically analyzable
 * Vite and Nuxt configuration. Conflicting, dynamic, or unsupported relevant
 * options produce errors so extraction never publishes hashes calculated with
 * compiler behavior that the runtime does not share.
 */
export function resolveVueCompilerOptions(
  cwd: string,
  explicitOptions: VueCompilerOptions | undefined,
  resolverOptions: VueCompilerOptionsResolverOptions = {}
): VueCompilerOptionsResolution {
  const state: CompilerOptionState = { options: {}, sources: {} };
  const errors: string[] = [];

  readExplicitOptions(explicitOptions, state, errors);

  if (resolverOptions.viteConfigPath !== undefined) {
    const file = resolveCustomViteConfig(
      cwd,
      resolverOptions.viteConfigPath,
      errors
    );
    if (file) readViteConfig(file, state, errors, true);
    return { compilerOptions: state.options, errors };
  }

  const nuxtConfig = findFirstConfig(cwd, NUXT_CONFIG_FILES, errors);
  const viteConfig = findFirstConfig(cwd, VITE_CONFIG_FILES, errors);
  if (nuxtConfig && viteConfig) {
    errors.push(
      optionError(
        'Found both Nuxt and Vite project config files',
        'For direct Vite builds, set files.gt.parsingFlags.viteConfigPath to the active Vite config. For Nuxt builds, remove or relocate the inactive Vite config so the compiler configuration is unambiguous'
      )
    );
    return { compilerOptions: state.options, errors };
  }
  if (nuxtConfig) {
    readNuxtConfig(
      nuxtConfig,
      state,
      errors,
      resolverOptions.sourceDiscoveryIsExplicit ?? false
    );
    return { compilerOptions: state.options, errors };
  }

  if (viteConfig) {
    readViteConfig(
      viteConfig,
      state,
      errors,
      resolverOptions.sourceDiscoveryIsExplicit ?? false
    );
  }

  return { compilerOptions: state.options, errors };
}

/** Selects the first config file in the framework's documented lookup order. */
function findFirstConfig(
  cwd: string,
  filenames: readonly string[],
  errors: string[]
): string | undefined {
  for (const filename of filenames) {
    const resolution = inspectConfigFile(
      path.resolve(cwd),
      path.resolve(cwd, filename),
      false,
      errors
    );
    if (resolution.kind === 'file') return resolution.file;
    if (resolution.kind === 'invalid') return undefined;
  }
  return undefined;
}

/** Validates an explicit Vite config without searching or executing files. */
function resolveCustomViteConfig(
  cwd: string,
  configuredPath: unknown,
  errors: string[]
): string | undefined {
  if (typeof configuredPath !== 'string' || !configuredPath.trim()) {
    errors.push(
      optionError(
        'Found an empty Vite config path',
        'Set files.gt.parsingFlags.viteConfigPath to one in-project Vite config file'
      )
    );
    return undefined;
  }
  const root = path.resolve(cwd);
  const candidate = path.resolve(root, configuredPath);
  const relativeCandidate = path.relative(root, candidate);
  if (
    relativeCandidate.startsWith(`..${path.sep}`) ||
    relativeCandidate === '..' ||
    path.isAbsolute(relativeCandidate) ||
    relativeCandidate.split(path.sep).includes('node_modules')
  ) {
    errors.push(
      optionError(
        'Found a Vite config path outside the project source boundary',
        'Choose a Vite config file inside the project root and outside node_modules'
      )
    );
    return undefined;
  }
  if (!VITE_CONFIG_EXTENSIONS.has(path.extname(candidate).toLowerCase())) {
    errors.push(
      optionError(
        'Found an unsupported Vite config file extension',
        'Use a JavaScript or TypeScript Vite config file'
      )
    );
    return undefined;
  }
  const resolution = inspectConfigFile(root, candidate, true, errors);
  return resolution.kind === 'file' ? resolution.file : undefined;
}

type ConfigFileResolution =
  | { kind: 'file'; file: string }
  | { kind: 'invalid' }
  | { kind: 'missing' };

/** Validates one config candidate without letting filesystem races escape. */
function inspectConfigFile(
  root: string,
  candidate: string,
  missingIsError: boolean,
  errors: string[]
): ConfigFileResolution {
  let candidateWasFound = false;
  try {
    const stats = fs.statSync(candidate);
    candidateWasFound = true;
    if (!stats.isFile()) {
      errors.push(
        configFileDiagnostic(
          'Found a Vue project config path that is not a regular file',
          'Replace it with a readable JavaScript or TypeScript config file',
          candidate
        )
      );
      return { kind: 'invalid' };
    }

    fs.accessSync(candidate, fs.constants.R_OK);
    const realRoot = fs.realpathSync(root);
    const realCandidate = fs.realpathSync(candidate);
    const realRelative = path.relative(realRoot, realCandidate);
    if (
      realRelative.startsWith(`..${path.sep}`) ||
      realRelative === '..' ||
      path.isAbsolute(realRelative) ||
      realRelative.split(path.sep).includes('node_modules')
    ) {
      errors.push(
        optionError(
          'Found a Vue project config path outside the project source boundary',
          'Choose a project config file inside the project root and outside node_modules'
        )
      );
      return { kind: 'invalid' };
    }
    return { kind: 'file', file: realCandidate };
  } catch (error) {
    if (isMissingPathError(error) && !missingIsError && !candidateWasFound) {
      return { kind: 'missing' };
    }
    if (isMissingPathError(error) && missingIsError && !candidateWasFound) {
      errors.push(
        configFileDiagnostic(
          'Could not find the configured Vite config file',
          'Set files.gt.parsingFlags.viteConfigPath to an existing file inside the project root',
          candidate,
          error
        )
      );
    } else {
      errors.push(
        configFileDiagnostic(
          'Could not read the Vue project config file',
          'Restore read access to the config file and try extraction again',
          candidate,
          error
        )
      );
    }
    return { kind: 'invalid' };
  }
}

function isMissingPathError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}

function readExplicitOptions(
  input: VueCompilerOptions | undefined,
  state: CompilerOptionState,
  errors: string[]
): void {
  if (input === undefined) return;
  if (!isRecord(input)) {
    errors.push(
      optionError(
        'Found an invalid vueCompilerOptions parsing setting',
        'Set files.gt.parsingFlags.vueCompilerOptions to an object containing only whitespace and delimiters'
      )
    );
    return;
  }

  for (const key of Object.keys(input)) {
    if (key !== 'whitespace' && key !== 'delimiters') {
      errors.push(
        optionError(
          `Found unsupported Vue compiler option "${key}" in gt.config.json`,
          'Configure only whitespace and delimiters in files.gt.parsingFlags.vueCompilerOptions'
        )
      );
    }
  }

  if (input.whitespace !== undefined) {
    if (input.whitespace !== 'condense' && input.whitespace !== 'preserve') {
      errors.push(
        optionError(
          'Found an invalid Vue whitespace compiler option in gt.config.json',
          'Set whitespace to either "condense" or "preserve"'
        )
      );
    } else {
      mergeOption(
        state,
        'whitespace',
        input.whitespace,
        { file: 'gt.config.json' },
        errors
      );
    }
  }

  if (input.delimiters !== undefined) {
    if (!isDelimiterPair(input.delimiters)) {
      errors.push(
        optionError(
          'Found invalid Vue interpolation delimiters in gt.config.json',
          'Set delimiters to exactly two non-empty strings, such as ["[[", "]]"]'
        )
      );
    } else {
      mergeOption(
        state,
        'delimiters',
        input.delimiters,
        { file: 'gt.config.json' },
        errors
      );
    }
  }
}

function readViteConfig(
  file: string,
  state: CompilerOptionState,
  errors: string[],
  reportAllSyntaxErrors: boolean
): void {
  const ast = parseConfig(file, errors, reportAllSyntaxErrors);
  if (!ast) return;

  const pluginBindings = new Set<Binding>();
  const namespaceBindings = new Set<Binding>();
  const jsxPluginBindings = new Set<Binding>();
  const jsxNamespaceBindings = new Set<Binding>();
  const defineConfigBindings = new Set<Binding>();

  traverse(ast, {
    ImportDeclaration(importPath) {
      if (importPath.node.source.value === 'vite') {
        for (const specifierPath of importPath.get('specifiers')) {
          const specifier = specifierPath.node;
          if (
            specifier.type !== 'ImportSpecifier' ||
            (specifier.imported.type === 'Identifier'
              ? specifier.imported.name
              : specifier.imported.value) !== 'defineConfig'
          ) {
            continue;
          }
          const binding = specifierPath.scope.getBinding(specifier.local.name);
          if (binding) defineConfigBindings.add(binding);
        }
        return;
      }
      const moduleSource = importPath.node.source.value;
      if (
        moduleSource !== '@vitejs/plugin-vue' &&
        moduleSource !== '@vitejs/plugin-vue-jsx'
      ) {
        return;
      }
      const targetPluginBindings =
        moduleSource === '@vitejs/plugin-vue-jsx'
          ? jsxPluginBindings
          : pluginBindings;
      const targetNamespaceBindings =
        moduleSource === '@vitejs/plugin-vue-jsx'
          ? jsxNamespaceBindings
          : namespaceBindings;
      for (const specifierPath of importPath.get('specifiers')) {
        const specifier = specifierPath.node;
        const binding = specifierPath.scope.getBinding(specifier.local.name);
        if (!binding) continue;
        if (specifier.type === 'ImportNamespaceSpecifier') {
          targetNamespaceBindings.add(binding);
        } else if (
          specifier.type === 'ImportDefaultSpecifier' ||
          (specifier.type === 'ImportSpecifier' &&
            (specifier.imported.type === 'Identifier'
              ? specifier.imported.name
              : specifier.imported.value) === 'default')
        ) {
          targetPluginBindings.add(binding);
        }
      }
    },
    TSImportEqualsDeclaration(importPath) {
      const reference = importPath.node.moduleReference;
      if (
        reference.type !== 'TSExternalModuleReference' ||
        reference.expression.type !== 'StringLiteral' ||
        (reference.expression.value !== '@vitejs/plugin-vue' &&
          reference.expression.value !== '@vitejs/plugin-vue-jsx')
      ) {
        return;
      }
      const binding = importPath.scope.getBinding(importPath.node.id.name);
      if (!binding) return;
      if (reference.expression.value === '@vitejs/plugin-vue-jsx') {
        jsxNamespaceBindings.add(binding);
      } else {
        namespaceBindings.add(binding);
      }
    },
    VariableDeclarator(variablePath) {
      const vueRequireKind = getPluginVueRequireKind(
        variablePath.node.init,
        '@vitejs/plugin-vue'
      );
      const jsxRequireKind = getPluginVueRequireKind(
        variablePath.node.init,
        '@vitejs/plugin-vue-jsx'
      );
      const requireKind = vueRequireKind ?? jsxRequireKind;
      if (!requireKind) return;
      const targetPluginBindings = jsxRequireKind
        ? jsxPluginBindings
        : pluginBindings;
      const targetNamespaceBindings = jsxRequireKind
        ? jsxNamespaceBindings
        : namespaceBindings;
      if (variablePath.node.id.type === 'Identifier') {
        const binding = variablePath.scope.getBinding(
          variablePath.node.id.name
        );
        if (!binding) return;
        if (requireKind === 'namespace') targetNamespaceBindings.add(binding);
        else targetPluginBindings.add(binding);
        return;
      }
      if (
        requireKind !== 'namespace' ||
        variablePath.node.id.type !== 'ObjectPattern'
      ) {
        return;
      }
      for (const property of variablePath.node.id.properties) {
        if (
          property.type !== 'ObjectProperty' ||
          readPropertyKey(property) !== 'default'
        ) {
          continue;
        }
        const localName = readBindingIdentifier(property.value);
        const binding = localName
          ? variablePath.scope.getBinding(localName)
          : undefined;
        if (binding) targetPluginBindings.add(binding);
      }
    },
  });

  const activeExport = findActiveConfigExport(ast, file, errors);
  if (!activeExport) return;
  const functionReturns = collectFunctionReturns(ast);
  const configRoot = resolveActiveConfigRoot(
    activeExport.node,
    activeExport.scope,
    functionReturns,
    (callee, scope) =>
      resolveConfigHelperCall(callee, scope, defineConfigBindings, undefined),
    new Set()
  );
  if (!configRoot.ok) {
    errors.push(dynamicConfigError(file, configRoot.node));
    return;
  }

  const configObject = resolveStaticObject(
    configRoot.value.node,
    configRoot.value.scope,
    new Set()
  );
  if (!configObject.ok) {
    errors.push(dynamicConfigError(file, configObject.node));
    return;
  }
  const plugins = configObject.value.entries.get('plugins');
  if (!plugins) return;

  const pluginContext: VitePluginContext = {
    moduleSource: '@vitejs/plugin-vue',
    namespaceBindings,
    pluginBindings,
    referencePositions: [...pluginBindings, ...namespaceBindings].flatMap(
      (binding) =>
        binding.referencePaths
          .map((reference) => reference.node.start)
          .filter((position): position is number => position !== null)
    ),
  };
  const calls: ScopedPluginCall[] = [];
  const unresolved = collectActiveVuePluginCalls(
    plugins.node,
    plugins.scope,
    pluginContext,
    calls,
    new Set()
  );
  if (unresolved) {
    errors.push(dynamicConfigError(file, unresolved));
    return;
  }
  if (calls.length > 1) {
    errors.push(dynamicConfigError(file, calls[1]!.node));
    return;
  }
  const call = calls[0];
  if (call) {
    const argument = call.node.arguments[0];
    if (
      argument?.type === 'SpreadElement' ||
      argument?.type === 'ArgumentPlaceholder'
    ) {
      errors.push(dynamicConfigError(file, argument));
      return;
    }
    if (argument) {
      rejectCustomVueCompiler(argument, call.scope, file, errors);
      readNestedCompilerOptions(
        argument,
        call.scope,
        ['template', 'compilerOptions'],
        file,
        true,
        state,
        errors
      );
    }
  }

  const jsxPluginContext: VitePluginContext = {
    moduleSource: '@vitejs/plugin-vue-jsx',
    namespaceBindings: jsxNamespaceBindings,
    pluginBindings: jsxPluginBindings,
    referencePositions: [...jsxPluginBindings, ...jsxNamespaceBindings].flatMap(
      (binding) =>
        binding.referencePaths
          .map((reference) => reference.node.start)
          .filter((position): position is number => position !== null)
    ),
  };
  const jsxCalls: ScopedPluginCall[] = [];
  const unresolvedJSX = collectActiveVuePluginCalls(
    plugins.node,
    plugins.scope,
    jsxPluginContext,
    jsxCalls,
    new Set()
  );
  if (unresolvedJSX) {
    errors.push(dynamicVueJSXConfigError(file, unresolvedJSX));
    return;
  }
  if (jsxCalls.length > 1) {
    errors.push(dynamicVueJSXConfigError(file, jsxCalls[1]!.node));
    return;
  }
  if (jsxCalls[0]) readVueJSXPluginOptions(jsxCalls[0], file, errors);
}

/** Rejects Vite JSX options that can invalidate source-to-VNode parity. */
function readVueJSXPluginOptions(
  call: ScopedPluginCall,
  file: string,
  errors: string[]
): void {
  const argument = call.node.arguments[0];
  if (!argument) return;
  if (
    argument.type === 'SpreadElement' ||
    argument.type === 'ArgumentPlaceholder'
  ) {
    errors.push(dynamicVueJSXConfigError(file, argument));
    return;
  }
  const options = resolveStaticObject(argument, call.scope, new Set());
  if (!options.ok) {
    errors.push(dynamicVueJSXConfigError(file, options.node));
    return;
  }

  for (const [name, entry] of options.value.entries) {
    let supported = false;
    if (name === 'optimize') {
      // Optimization changes patch metadata only. The real dev/production
      // oracle proves both values preserve GT source data.
      supported =
        resolveStaticBoolean(entry.node, entry.scope, new Set()) !== undefined;
    } else if (name === 'transformOn') {
      supported =
        resolveStaticBoolean(entry.node, entry.scope, new Set()) === false;
    } else if (name === 'enableObjectSlots' || name === 'mergeProps') {
      supported =
        resolveStaticBoolean(entry.node, entry.scope, new Set()) === true;
    } else if (name === 'resolveType') {
      supported =
        resolveStaticBoolean(entry.node, entry.scope, new Set()) === false;
    } else if (name === 'pragma') {
      supported =
        resolveStaticString(entry.node, entry.scope, new Set()) === '';
    } else if (name === 'defineComponentName') {
      supported = isDefaultDefineComponentNames(
        entry.node,
        entry.scope,
        new Set()
      );
    } else if (name === 'babelPlugins') {
      supported = isDefinitelyEmptyArray(entry.node, entry.scope, new Set());
    } else if (name === 'tsPluginOptions') {
      const resolved = resolveStaticObject(entry.node, entry.scope, new Set());
      supported = resolved.ok && resolved.value.entries.size === 0;
    }
    if (supported) continue;
    errors.push(
      locatedOptionError(
        file,
        entry.node,
        `Found unsupported @vitejs/plugin-vue-jsx option "${name}"`,
        'Use default-equivalent Vue JSX options; only a static optimize value may differ in files containing gt-vue translations'
      )
    );
  }
}

/** Resolves an immutable boolean option without coercing another type. */
function resolveStaticBoolean(
  input: t.Node,
  scope: Scope,
  seen: Set<Binding>
): boolean | undefined {
  const node = unwrapExpression(input);
  if (node.type === 'BooleanLiteral') return node.value;
  if (node.type !== 'Identifier') return undefined;
  const binding = scope.getBinding(node.name);
  if (!binding?.constant || bindingHasMutation(binding) || seen.has(binding)) {
    return undefined;
  }
  const declaration = binding.path.node;
  if (declaration.type !== 'VariableDeclarator' || !declaration.init) {
    return undefined;
  }
  const nextSeen = new Set(seen);
  nextSeen.add(binding);
  return resolveStaticBoolean(declaration.init, binding.path.scope, nextSeen);
}

/** Proves the explicit component-name option equals the plugin default. */
function isDefaultDefineComponentNames(
  input: t.Node,
  scope: Scope,
  seen: Set<Binding>
): boolean {
  const node = unwrapExpression(input);
  if (node.type === 'ArrayExpression') {
    return (
      node.elements.length === 1 &&
      node.elements[0]?.type === 'StringLiteral' &&
      node.elements[0].value === 'defineComponent'
    );
  }
  if (node.type !== 'Identifier') return false;
  const binding = scope.getBinding(node.name);
  if (!binding?.constant || bindingHasMutation(binding) || seen.has(binding)) {
    return false;
  }
  const declaration = binding.path.node;
  if (declaration.type !== 'VariableDeclarator' || !declaration.init) {
    return false;
  }
  const nextSeen = new Set(seen);
  nextSeen.add(binding);
  return isDefaultDefineComponentNames(
    declaration.init,
    binding.path.scope,
    nextSeen
  );
}

/** Proves an immutable config value is an empty array. */
function isDefinitelyEmptyArray(
  input: t.Node,
  scope: Scope,
  seen: Set<Binding>
): boolean {
  const node = unwrapExpression(input);
  if (node.type === 'ArrayExpression') return node.elements.length === 0;
  if (node.type !== 'Identifier') return false;
  const binding = scope.getBinding(node.name);
  if (!binding?.constant || bindingHasMutation(binding) || seen.has(binding)) {
    return false;
  }
  const declaration = binding.path.node;
  if (declaration.type !== 'VariableDeclarator' || !declaration.init) {
    return false;
  }
  const nextSeen = new Set(seen);
  nextSeen.add(binding);
  return isDefinitelyEmptyArray(declaration.init, binding.path.scope, nextSeen);
}

/**
 * Rejects Vite's custom compiler override because source-file resolution can
 * only prove parity with that app's `vue/compiler-sfc` export.
 */
function rejectCustomVueCompiler(
  root: t.Node,
  scope: Scope,
  file: string,
  errors: string[]
): void {
  const rootObject = resolveStaticObject(root, scope, new Set());
  if (!rootObject.ok) return;
  const compiler = rootObject.value.entries.get('compiler');
  if (!compiler) return;
  errors.push(
    locatedOptionError(
      file,
      compiler.node,
      'Found a custom Vue compiler instance in the Vite plugin',
      "Remove the compiler override so extraction and Vite both use the app's vue/compiler-sfc version"
    )
  );
}

function readNuxtConfig(
  file: string,
  state: CompilerOptionState,
  errors: string[],
  sourceDiscoveryIsExplicit: boolean
): void {
  const ast = parseConfig(file, errors, sourceDiscoveryIsExplicit);
  if (!ast) return;

  const defineNuxtConfigBindings = new Set<Binding>();
  traverse(ast, {
    ImportDeclaration(importPath) {
      if (
        importPath.node.source.value !== 'nuxt/config' &&
        importPath.node.source.value !== 'nuxt' &&
        importPath.node.source.value !== '#imports'
      ) {
        return;
      }
      for (const specifierPath of importPath.get('specifiers')) {
        const specifier = specifierPath.node;
        if (
          specifier.type !== 'ImportSpecifier' ||
          (specifier.imported.type === 'Identifier'
            ? specifier.imported.name
            : specifier.imported.value) !== 'defineNuxtConfig'
        ) {
          continue;
        }
        const binding = specifierPath.scope.getBinding(specifier.local.name);
        if (binding) defineNuxtConfigBindings.add(binding);
      }
    },
  });

  const activeExport = findActiveConfigExport(ast, file, errors);
  if (!activeExport) return;
  const configRoot = resolveActiveConfigRoot(
    activeExport.node,
    activeExport.scope,
    collectFunctionReturns(ast),
    (callee, scope) =>
      resolveConfigHelperCall(
        callee,
        scope,
        defineNuxtConfigBindings,
        'defineNuxtConfig'
      ),
    new Set()
  );
  if (!configRoot.ok) {
    errors.push(dynamicConfigError(file, configRoot.node));
    return;
  }
  const configObject = resolveStaticObject(
    configRoot.value.node,
    configRoot.value.scope,
    new Set()
  );
  if (!configObject.ok) {
    errors.push(dynamicConfigError(file, configObject.node));
    return;
  }
  const extendsEntry = configObject.value.entries.get('extends');
  if (
    extendsEntry &&
    !isDefinitelyEmptyNuxtExtends(extendsEntry.node, extendsEntry.scope)
  ) {
    errors.push(
      locatedOptionError(
        file,
        extendsEntry.node,
        'Found Nuxt layer inheritance that could change Vue compiler options',
        'Run extraction from a Nuxt configuration without inherited layers until gt-vue can resolve the complete layer chain safely'
      )
    );
    return;
  }
  const unsupportedSourceLayout = sourceDiscoveryIsExplicit
    ? undefined
    : findUnsupportedNuxtSourceLayout(configObject.value);
  if (unsupportedSourceLayout) {
    errors.push(
      locatedOptionError(
        file,
        unsupportedSourceLayout,
        'Found custom Nuxt source directories that default Vue discovery cannot scan safely',
        'Use Nuxt source directories covered by the default app, src, pages, layouts, plugins, and related globs until custom directory discovery is supported'
      )
    );
    return;
  }
  readNestedCompilerOptions(
    configRoot.value.node,
    configRoot.value.scope,
    ['vue', 'compilerOptions'],
    file,
    true,
    state,
    errors
  );
}

/** Finds a Nuxt source-layout override not covered by default CLI globs. */
function findUnsupportedNuxtSourceLayout(
  config: StaticObject
): t.Node | undefined {
  const srcDir = config.entries.get('srcDir');
  if (srcDir) {
    const value = resolveStaticString(srcDir.node, srcDir.scope, new Set());
    const normalized = value
      ? path.posix.normalize(value.replaceAll('\\', '/')).replace(/\/+$/, '') ||
        '.'
      : undefined;
    if (!normalized || !['.', 'app', 'src'].includes(normalized)) {
      return srcDir.node;
    }
  }

  const directoryOptions = config.entries.get('dir');
  if (directoryOptions) {
    const resolved = resolveStaticObject(
      directoryOptions.node,
      directoryOptions.scope,
      new Set()
    );
    if (!resolved.ok || resolved.value.entries.size > 0) {
      return directoryOptions.node;
    }
  }
  return undefined;
}

/** Returns true only when a Nuxt extends value provably selects no layers. */
function isDefinitelyEmptyNuxtExtends(input: t.Node, scope: Scope): boolean {
  const node = unwrapExpression(input);
  if (node.type === 'NullLiteral') return true;
  if (node.type === 'ArrayExpression') return node.elements.length === 0;
  if (node.type !== 'Identifier') return false;
  if (node.name === 'undefined' && !scope.getBinding(node.name)) return true;
  const binding = scope.getBinding(node.name);
  const declaration = binding?.path.node;
  return !!(
    binding?.constant &&
    !bindingHasMutation(binding) &&
    declaration?.type === 'VariableDeclarator' &&
    declaration.init &&
    isDefinitelyEmptyNuxtExtends(declaration.init, binding.path.scope)
  );
}

/** Returns the one top-level export that the config loader evaluates. */
function findActiveConfigExport(
  ast: t.File,
  file: string,
  errors: string[]
): ObjectEntry | undefined {
  const esmExports: ObjectEntry[] = [];
  const commonJsExports = new Map<
    'exports-default' | 'module-exports',
    ObjectEntry[]
  >();

  traverse(ast, {
    ExportDefaultDeclaration(exportPath) {
      esmExports.push({
        node: exportPath.node.declaration,
        scope: exportPath.scope,
      });
    },
    AssignmentExpression(assignmentPath) {
      if (
        assignmentPath.node.operator !== '=' ||
        assignmentPath.getFunctionParent() ||
        !assignmentPath.parentPath.isExpressionStatement() ||
        !assignmentPath.parentPath.parentPath?.isProgram()
      ) {
        return;
      }
      const kind = readCommonJsConfigExportKind(
        assignmentPath.node.left,
        assignmentPath.scope
      );
      if (!kind) return;
      const entries = commonJsExports.get(kind) ?? [];
      entries.push({
        node: assignmentPath.node.right,
        scope: assignmentPath.scope,
      });
      commonJsExports.set(kind, entries);
    },
  });

  const commonJsKinds = [...commonJsExports.keys()];
  if (
    esmExports.length > 1 ||
    (esmExports.length > 0 && commonJsKinds.length > 0) ||
    commonJsKinds.length > 1
  ) {
    const node =
      esmExports[1]?.node ??
      commonJsExports.get(commonJsKinds[1]!)?.[0]?.node ??
      esmExports[0]?.node ??
      ast.program;
    errors.push(dynamicConfigError(file, node));
    return undefined;
  }
  if (esmExports[0]) return esmExports[0];
  const commonJs = commonJsExports.get(commonJsKinds[0]!);
  return commonJs?.[commonJs.length - 1];
}

/** Records return expressions by their immediately containing function. */
function collectFunctionReturns(ast: t.File): Map<t.Function, ObjectEntry[]> {
  const result = new Map<t.Function, ObjectEntry[]>();
  traverse(ast, {
    ReturnStatement(returnPath) {
      if (!returnPath.node.argument) return;
      const functionPath = returnPath.getFunctionParent();
      if (!functionPath) return;
      const entries = result.get(functionPath.node) ?? [];
      entries.push({ node: returnPath.node.argument, scope: returnPath.scope });
      result.set(functionPath.node, entries);
    },
  });
  return result;
}

/** Resolves an exported object or single-return config function statically. */
function resolveActiveConfigRoot(
  input: t.Node,
  scope: Scope,
  functionReturns: Map<t.Function, ObjectEntry[]>,
  resolveHelper: (input: t.Node, scope: Scope) => ConfigHelperResolution,
  seen: Set<t.Node>
): ActiveConfigResolution {
  const node = unwrapExpression(input);
  if (seen.has(node)) return { ok: false, node };
  const nextSeen = new Set(seen);
  nextSeen.add(node);

  if (node.type === 'ObjectExpression') {
    return { ok: true, value: { node, scope } };
  }
  if (node.type === 'Identifier') {
    const binding = scope.getBinding(node.name);
    if (!binding?.constant || bindingHasMutation(binding)) {
      return { ok: false, node };
    }
    if (binding.path.isFunctionDeclaration()) {
      return resolveActiveConfigRoot(
        binding.path.node,
        binding.path.scope,
        functionReturns,
        resolveHelper,
        nextSeen
      );
    }
    const declaration = binding.path.node;
    return declaration.type === 'VariableDeclarator' && declaration.init
      ? resolveActiveConfigRoot(
          declaration.init,
          binding.path.scope,
          functionReturns,
          resolveHelper,
          nextSeen
        )
      : { ok: false, node };
  }
  if (
    node.type === 'CallExpression' ||
    node.type === 'OptionalCallExpression'
  ) {
    const helper = resolveHelper(node.callee, scope);
    if (helper !== 'static') return { ok: false, node: node.callee };
    const argument = node.arguments[0];
    return argument &&
      argument.type !== 'SpreadElement' &&
      argument.type !== 'ArgumentPlaceholder'
      ? resolveActiveConfigRoot(
          argument,
          scope,
          functionReturns,
          resolveHelper,
          nextSeen
        )
      : { ok: false, node };
  }
  if (
    node.type === 'ArrowFunctionExpression' ||
    node.type === 'FunctionExpression' ||
    node.type === 'FunctionDeclaration'
  ) {
    if (
      node.type === 'ArrowFunctionExpression' &&
      node.body.type !== 'BlockStatement'
    ) {
      return resolveActiveConfigRoot(
        node.body,
        scope,
        functionReturns,
        resolveHelper,
        nextSeen
      );
    }
    const returns = functionReturns.get(node) ?? [];
    return returns.length === 1
      ? resolveActiveConfigRoot(
          returns[0]!.node,
          returns[0]!.scope,
          functionReturns,
          resolveHelper,
          nextSeen
        )
      : { ok: false, node };
  }
  if (node.type === 'ConditionalExpression') {
    const condition = resolveStaticTruthiness(node.test, scope, new Set());
    return condition === undefined
      ? { ok: false, node }
      : resolveActiveConfigRoot(
          condition ? node.consequent : node.alternate,
          scope,
          functionReturns,
          resolveHelper,
          nextSeen
        );
  }
  if (node.type === 'SequenceExpression') {
    const last = node.expressions[node.expressions.length - 1];
    return last
      ? resolveActiveConfigRoot(
          last,
          scope,
          functionReturns,
          resolveHelper,
          nextSeen
        )
      : { ok: false, node };
  }
  if (node.type === 'AwaitExpression') {
    return resolveActiveConfigRoot(
      node.argument,
      scope,
      functionReturns,
      resolveHelper,
      nextSeen
    );
  }
  return { ok: false, node };
}

/** Resolves imported/global config helpers and their immutable aliases. */
function resolveConfigHelperCall(
  input: t.Node,
  scope: Scope,
  knownBindings: Set<Binding>,
  globalName: string | undefined,
  seen: Set<Binding> = new Set()
): ConfigHelperResolution {
  const node = unwrapExpression(input);
  if (node.type !== 'Identifier') return undefined;
  const binding = scope.getBinding(node.name);
  if (!binding) return node.name === globalName ? 'static' : undefined;
  if (knownBindings.has(binding)) return 'static';
  if (seen.has(binding)) return undefined;
  const declaration = binding.path.node;
  if (declaration.type !== 'VariableDeclarator' || !declaration.init) {
    return undefined;
  }
  const nextSeen = new Set(seen);
  nextSeen.add(binding);
  const initialValue = resolveConfigHelperCall(
    declaration.init,
    binding.path.scope,
    knownBindings,
    globalName,
    nextSeen
  );
  return !binding.constant && initialValue ? 'dynamic' : initialValue;
}

/** Collects Vue plugin calls reachable through the active `plugins` value. */
function collectActiveVuePluginCalls(
  input: t.Node,
  scope: Scope,
  context: VitePluginContext,
  calls: ScopedPluginCall[],
  seen: Set<Binding>
): t.Node | undefined {
  const node = unwrapExpression(input);

  if (node.type === 'Identifier') {
    const value = resolvePluginVueValue(
      node,
      scope,
      context.pluginBindings,
      context.namespaceBindings,
      context.moduleSource,
      new Set()
    );
    if (value === 'dynamic' || value === 'default') return node;
    const binding = scope.getBinding(node.name);
    if (!binding || seen.has(binding)) {
      return mayReferenceVuePlugin(node, scope, context, new Set())
        ? node
        : undefined;
    }
    const declaration = binding.path.node;
    if (declaration.type !== 'VariableDeclarator' || !declaration.init) {
      return mayReferenceVuePlugin(node, scope, context, new Set())
        ? node
        : undefined;
    }
    if (bindingHasMutation(binding)) return node;
    if (!binding.constant) {
      return mayReferenceVuePlugin(
        declaration.init,
        binding.path.scope,
        context,
        new Set()
      )
        ? node
        : undefined;
    }
    const nextSeen = new Set(seen);
    nextSeen.add(binding);
    return collectActiveVuePluginCalls(
      declaration.init,
      binding.path.scope,
      context,
      calls,
      nextSeen
    );
  }
  if (node.type === 'ArrayExpression') {
    for (const element of node.elements) {
      if (!element) continue;
      const unresolved = collectActiveVuePluginCalls(
        element.type === 'SpreadElement' ? element.argument : element,
        scope,
        context,
        calls,
        seen
      );
      if (unresolved) return unresolved;
    }
    return undefined;
  }
  if (
    node.type === 'CallExpression' ||
    node.type === 'OptionalCallExpression'
  ) {
    const value = resolvePluginVueValue(
      node.callee,
      scope,
      context.pluginBindings,
      context.namespaceBindings,
      context.moduleSource,
      new Set()
    );
    if (value === 'dynamic') return node.callee;
    if (value === 'default') {
      calls.push({ node, scope });
      return undefined;
    }
    return mayReferenceVuePlugin(node, scope, context, new Set())
      ? node
      : undefined;
  }
  if (node.type === 'ConditionalExpression') {
    const condition = resolveStaticTruthiness(node.test, scope, new Set());
    if (condition !== undefined) {
      return collectActiveVuePluginCalls(
        condition ? node.consequent : node.alternate,
        scope,
        context,
        calls,
        seen
      );
    }
    return mayReferenceVuePlugin(node, scope, context, new Set())
      ? node
      : undefined;
  }
  if (node.type === 'LogicalExpression') {
    const left = resolveStaticTruthiness(node.left, scope, new Set());
    if (left !== undefined) {
      const selected =
        node.operator === '&&'
          ? left
            ? node.right
            : node.left
          : node.operator === '||'
            ? left
              ? node.left
              : node.right
            : undefined;
      if (selected) {
        return collectActiveVuePluginCalls(
          selected,
          scope,
          context,
          calls,
          seen
        );
      }
    }
    return mayReferenceVuePlugin(node, scope, context, new Set())
      ? node
      : undefined;
  }
  if (node.type === 'SequenceExpression') {
    const last = node.expressions[node.expressions.length - 1];
    return last
      ? collectActiveVuePluginCalls(last, scope, context, calls, seen)
      : undefined;
  }
  return mayReferenceVuePlugin(node, scope, context, new Set())
    ? node
    : undefined;
}

/** Conservatively follows wrapper bindings that reference the Vue plugin. */
function mayReferenceVuePlugin(
  input: t.Node,
  scope: Scope,
  context: VitePluginContext,
  seen: Set<Binding>
): boolean {
  const node = unwrapExpression(input);
  const start = node.start;
  const end = node.end;
  if (
    typeof start === 'number' &&
    typeof end === 'number' &&
    context.referencePositions.some(
      (position) => position >= start && position <= end
    )
  ) {
    return true;
  }
  const target =
    node.type === 'Identifier'
      ? node
      : node.type === 'CallExpression' || node.type === 'OptionalCallExpression'
        ? unwrapExpression(node.callee)
        : undefined;
  if (target?.type !== 'Identifier') return false;
  const binding = scope.getBinding(target.name);
  if (!binding) return false;
  if (
    context.pluginBindings.has(binding) ||
    context.namespaceBindings.has(binding)
  ) {
    return true;
  }
  if (seen.has(binding)) return false;
  const nextSeen = new Set(seen);
  nextSeen.add(binding);
  const declaration = binding.path.node;
  if (declaration.type === 'VariableDeclarator' && declaration.init) {
    return mayReferenceVuePlugin(
      declaration.init,
      binding.path.scope,
      context,
      nextSeen
    );
  }
  const declarationStart = declaration.start;
  const declarationEnd = declaration.end;
  return (
    typeof declarationStart === 'number' &&
    typeof declarationEnd === 'number' &&
    context.referencePositions.some(
      (position) => position >= declarationStart && position <= declarationEnd
    )
  );
}

/** Evaluates only primitive truthiness used to choose a static config branch. */
function resolveStaticTruthiness(
  input: t.Node,
  scope: Scope,
  seen: Set<Binding>
): boolean | undefined {
  const node = unwrapExpression(input);
  if (node.type === 'BooleanLiteral') return node.value;
  if (node.type === 'NullLiteral') return false;
  if (node.type === 'NumericLiteral') return !!node.value;
  if (node.type === 'BigIntLiteral') return node.value !== '0';
  if (node.type === 'StringLiteral') return node.value.length > 0;
  if (node.type === 'UnaryExpression' && node.operator === '!') {
    const value = resolveStaticTruthiness(node.argument, scope, seen);
    return value === undefined ? undefined : !value;
  }
  if (node.type !== 'Identifier') return undefined;
  if (node.name === 'undefined' && !scope.getBinding(node.name)) return false;
  const binding = scope.getBinding(node.name);
  if (!binding?.constant || bindingHasMutation(binding) || seen.has(binding)) {
    return undefined;
  }
  const declaration = binding.path.node;
  if (declaration.type !== 'VariableDeclarator' || !declaration.init) {
    return undefined;
  }
  const nextSeen = new Set(seen);
  nextSeen.add(binding);
  return resolveStaticTruthiness(
    declaration.init,
    binding.path.scope,
    nextSeen
  );
}

function readNestedCompilerOptions(
  root: t.Node,
  scope: Scope,
  keys: [string, string],
  file: string,
  failOnDynamicRoot: boolean,
  state: CompilerOptionState,
  errors: string[]
): void {
  const rootObject = resolveStaticObject(root, scope, new Set());
  if (!rootObject.ok) {
    if (failOnDynamicRoot)
      errors.push(dynamicConfigError(file, rootObject.node));
    return;
  }

  const parentEntry = rootObject.value.entries.get(keys[0]);
  if (!parentEntry) return;
  const parentObject = resolveStaticObject(
    parentEntry.node,
    parentEntry.scope,
    new Set()
  );
  if (!parentObject.ok) {
    errors.push(dynamicConfigError(file, parentObject.node));
    return;
  }

  const compilerEntry = parentObject.value.entries.get(keys[1]);
  if (!compilerEntry) return;
  const compilerObject = resolveStaticObject(
    compilerEntry.node,
    compilerEntry.scope,
    new Set()
  );
  if (!compilerObject.ok) {
    errors.push(dynamicConfigError(file, compilerObject.node));
    return;
  }

  readCompilerOptionsObject(compilerObject.value, file, state, errors);
}

function readCompilerOptionsObject(
  object: StaticObject,
  file: string,
  state: CompilerOptionState,
  errors: string[]
): void {
  for (const [key, entry] of object.entries) {
    if (key !== 'whitespace' && key !== 'delimiters') {
      errors.push(
        locatedOptionError(
          file,
          entry.node,
          `Found unsupported Vue compiler option "${key}"`,
          'gt-vue extraction currently supports only static whitespace and delimiters compiler options'
        )
      );
    }
  }

  const whitespaceEntry = object.entries.get('whitespace');
  if (whitespaceEntry) {
    const value = resolveStaticString(
      whitespaceEntry.node,
      whitespaceEntry.scope,
      new Set()
    );
    if (value !== 'condense' && value !== 'preserve') {
      errors.push(dynamicConfigError(file, whitespaceEntry.node));
    } else {
      mergeOption(
        state,
        'whitespace',
        value,
        { file, node: whitespaceEntry.node },
        errors
      );
    }
  }

  const delimitersEntry = object.entries.get('delimiters');
  if (delimitersEntry) {
    const value = resolveStaticDelimiters(
      delimitersEntry.node,
      delimitersEntry.scope,
      new Set()
    );
    if (!value) {
      errors.push(dynamicConfigError(file, delimitersEntry.node));
    } else {
      mergeOption(
        state,
        'delimiters',
        value,
        { file, node: delimitersEntry.node },
        errors
      );
    }
  }
}

function resolveStaticObject(
  input: t.Node,
  scope: Scope,
  seen: Set<t.Node>
): ObjectResolution {
  const node = unwrapExpression(input);
  if (seen.has(node)) return { ok: false, node };
  seen.add(node);

  if (node.type === 'Identifier') {
    const binding = scope.getBinding(node.name);
    const declaration = binding?.path.node;
    if (
      !binding?.constant ||
      bindingHasMutation(binding) ||
      declaration?.type !== 'VariableDeclarator' ||
      !declaration.init
    ) {
      return { ok: false, node };
    }
    return resolveStaticObject(declaration.init, binding.path.scope, seen);
  }
  if (node.type !== 'ObjectExpression') return { ok: false, node };

  const entries = new Map<string, ObjectEntry>();
  for (const property of node.properties) {
    if (property.type === 'SpreadElement') {
      const spread = resolveStaticObject(property.argument, scope, seen);
      if (!spread.ok) return { ok: false, node: spread.node };
      for (const [key, entry] of spread.value.entries) entries.set(key, entry);
      continue;
    }
    const key = readPropertyKey(property);
    if (!key) return { ok: false, node: property };
    if (property.type !== 'ObjectProperty') {
      entries.set(key, { node: property, scope });
      continue;
    }
    entries.set(key, { node: property.value, scope });
  }
  return { ok: true, value: { entries } };
}

function resolveStaticString(
  input: t.Node,
  scope: Scope,
  seen: Set<t.Node>
): string | undefined {
  const node = unwrapExpression(input);
  if (seen.has(node)) return undefined;
  seen.add(node);
  if (node.type === 'StringLiteral') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis
      .map((quasi) => quasi.value.cooked ?? quasi.value.raw)
      .join('');
  }
  if (node.type !== 'Identifier') return undefined;
  const binding = scope.getBinding(node.name);
  const declaration = binding?.path.node;
  return binding?.constant &&
    !bindingHasMutation(binding) &&
    declaration?.type === 'VariableDeclarator' &&
    declaration.init
    ? resolveStaticString(declaration.init, binding.path.scope, seen)
    : undefined;
}

function resolveStaticDelimiters(
  input: t.Node,
  scope: Scope,
  seen: Set<t.Node>
): [string, string] | undefined {
  const node = unwrapExpression(input);
  if (seen.has(node)) return undefined;
  seen.add(node);
  if (node.type === 'Identifier') {
    const binding = scope.getBinding(node.name);
    const declaration = binding?.path.node;
    return binding?.constant &&
      !bindingHasMutation(binding) &&
      declaration?.type === 'VariableDeclarator' &&
      declaration.init
      ? resolveStaticDelimiters(declaration.init, binding.path.scope, seen)
      : undefined;
  }
  if (node.type !== 'ArrayExpression' || node.elements.length !== 2) {
    return undefined;
  }
  const values = node.elements.map((element) =>
    element && element.type !== 'SpreadElement'
      ? resolveStaticString(element, scope, new Set())
      : undefined
  );
  return isDelimiterPair(values) ? values : undefined;
}

function unwrapExpression(input: t.Node): t.Node {
  let node = input;
  while (
    node.type === 'TSAsExpression' ||
    node.type === 'TSSatisfiesExpression' ||
    node.type === 'TSTypeAssertion' ||
    node.type === 'TSNonNullExpression' ||
    node.type === 'TypeCastExpression' ||
    node.type === 'ParenthesizedExpression'
  ) {
    node = node.expression;
  }
  return node;
}

function readPropertyKey(
  property: t.ObjectMethod | t.ObjectProperty
): string | undefined {
  if (!property.computed && property.key.type === 'Identifier') {
    return property.key.name;
  }
  if (property.key.type === 'StringLiteral') return property.key.value;
  return undefined;
}

function getPluginVueRequireKind(
  input: t.Expression | null | undefined,
  moduleSource: '@vitejs/plugin-vue' | '@vitejs/plugin-vue-jsx'
): 'default' | 'namespace' | undefined {
  if (!input) return undefined;
  const node = unwrapExpression(input);
  if (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'require' &&
    node.arguments[0]?.type === 'StringLiteral' &&
    node.arguments[0].value === moduleSource
  ) {
    return 'namespace';
  }
  if (
    (node.type === 'MemberExpression' ||
      node.type === 'OptionalMemberExpression') &&
    isDefaultMember(node)
  ) {
    return getPluginVueRequireKind(node.object as t.Expression, moduleSource)
      ? 'default'
      : undefined;
  }
  return undefined;
}

/** Resolves immutable aliases of the Vue Vite plugin without executing config. */
function resolvePluginVueValue(
  input: t.Node,
  scope: Scope,
  pluginBindings: Set<Binding>,
  namespaceBindings: Set<Binding>,
  moduleSource: '@vitejs/plugin-vue' | '@vitejs/plugin-vue-jsx',
  seen: Set<Binding>
): 'default' | 'dynamic' | 'namespace' | undefined {
  const node = unwrapExpression(input);
  const requireKind =
    node.type === 'CallExpression' ||
    node.type === 'MemberExpression' ||
    node.type === 'OptionalMemberExpression'
      ? getPluginVueRequireKind(node, moduleSource)
      : undefined;
  if (requireKind) return requireKind;

  if (node.type === 'Identifier') {
    const binding = scope.getBinding(node.name);
    if (!binding) return undefined;
    if (pluginBindings.has(binding)) return 'default';
    if (namespaceBindings.has(binding)) return 'namespace';
    if (seen.has(binding)) return undefined;
    const declaration = binding.path.node;
    if (declaration.type !== 'VariableDeclarator' || !declaration.init) {
      return undefined;
    }
    const nextSeen = new Set(seen);
    nextSeen.add(binding);
    const initialValue = resolvePluginVueValue(
      declaration.init,
      binding.path.scope,
      pluginBindings,
      namespaceBindings,
      moduleSource,
      nextSeen
    );
    return !binding.constant && initialValue ? 'dynamic' : initialValue;
  }
  if (
    (node.type === 'MemberExpression' ||
      node.type === 'OptionalMemberExpression') &&
    isDefaultMember(node)
  ) {
    const objectValue = resolvePluginVueValue(
      node.object,
      scope,
      pluginBindings,
      namespaceBindings,
      moduleSource,
      seen
    );
    if (objectValue === 'dynamic') return 'dynamic';
    if (objectValue === 'namespace') return 'default';
  }
  return undefined;
}

/** Recognizes every static spelling of a module namespace default export. */
function isDefaultMember(
  node: t.MemberExpression | t.OptionalMemberExpression
): boolean {
  return (
    (!node.computed &&
      node.property.type === 'Identifier' &&
      node.property.name === 'default') ||
    (node.computed &&
      node.property.type === 'StringLiteral' &&
      node.property.value === 'default')
  );
}

/** Classifies supported unshadowed CommonJS config exports. */
function readCommonJsConfigExportKind(
  node: t.Node,
  scope: Scope
): 'exports-default' | 'module-exports' | undefined {
  if (
    node.type !== 'MemberExpression' ||
    node.object.type !== 'Identifier' ||
    !(
      (!node.computed && node.property.type === 'Identifier') ||
      (node.computed && node.property.type === 'StringLiteral')
    )
  ) {
    return undefined;
  }
  const property =
    node.property.type === 'Identifier'
      ? node.property.name
      : node.property.value;
  if (
    node.object.name === 'module' &&
    property === 'exports' &&
    !scope.getBinding('module')
  ) {
    return 'module-exports';
  }
  return node.object.name === 'exports' &&
    property === 'default' &&
    !scope.getBinding('exports')
    ? 'exports-default'
    : undefined;
}

function readBindingIdentifier(node: t.Node): string | undefined {
  if (node.type === 'Identifier') return node.name;
  return node.type === 'AssignmentPattern' && node.left.type === 'Identifier'
    ? node.left.name
    : undefined;
}

const MUTATING_METHODS = new Set([
  'clear',
  'copyWithin',
  'delete',
  'fill',
  'pop',
  'push',
  'reverse',
  'set',
  'shift',
  'sort',
  'splice',
  'unshift',
]);

/** Detects property, collection, and alias mutations Babel does not mark constant. */
function bindingHasMutation(
  binding: Binding,
  seen: Set<Binding> = new Set()
): boolean {
  if (seen.has(binding)) return false;
  const nextSeen = new Set(seen);
  nextSeen.add(binding);

  for (const reference of binding.referencePaths) {
    let current = reference as NodePath<t.Node>;
    while (
      current.parentPath &&
      (current.parentPath.isMemberExpression() ||
        current.parentPath.isOptionalMemberExpression()) &&
      current.parentPath.node.object === current.node
    ) {
      current = current.parentPath as NodePath<t.Node>;
    }

    const parent = current.parentPath;
    if (
      (parent?.isAssignmentExpression() && parent.node.left === current.node) ||
      (parent?.isUpdateExpression() && parent.node.argument === current.node) ||
      (parent?.isUnaryExpression({ operator: 'delete' }) &&
        parent.node.argument === current.node)
    ) {
      return true;
    }

    if (parent?.isCallExpression() || parent?.isOptionalCallExpression()) {
      if (
        parent.node.callee === current.node &&
        (current.isMemberExpression() ||
          current.isOptionalMemberExpression()) &&
        MUTATING_METHODS.has(readStaticMemberName(current.node) ?? '')
      ) {
        return true;
      }
      if (
        parent.node.arguments[0] === current.node &&
        isGlobalMutationCall(parent.node.callee, parent.scope)
      ) {
        return true;
      }
      if (
        parent.node.arguments.some((argument) => argument === current.node) &&
        !isKnownReadOnlyConfigConsumer(parent.node, current.node, parent.scope)
      ) {
        return true;
      }
    }

    const aliasParent = reference.parentPath;
    if (
      aliasParent?.isVariableDeclarator() &&
      aliasParent.node.init === reference.node &&
      aliasParent.node.id.type === 'Identifier'
    ) {
      const alias = aliasParent.scope.getBinding(aliasParent.node.id.name);
      if (alias && bindingHasMutation(alias, nextSeen)) return true;
    }
    if (
      aliasParent?.isVariableDeclarator() &&
      aliasParent.node.init === reference.node &&
      aliasParent.node.id.type !== 'Identifier'
    ) {
      for (const name of collectBindingNames(aliasParent.node.id)) {
        const alias = aliasParent.scope.getBinding(name);
        if (alias && bindingHasMutation(alias, nextSeen)) return true;
      }
    }
    if (
      parent?.isAssignmentExpression({ operator: '=' }) &&
      parent.node.right === current.node
    ) {
      for (const name of collectBindingNames(parent.node.left)) {
        const alias = parent.scope.getBinding(name);
        if (alias && bindingHasMutation(alias, nextSeen)) return true;
      }
    }
  }
  return false;
}

function collectBindingNames(input: t.Node): string[] {
  if (input.type === 'Identifier') return [input.name];
  if (input.type === 'AssignmentPattern') {
    return collectBindingNames(input.left);
  }
  if (input.type === 'RestElement') return collectBindingNames(input.argument);
  if (input.type === 'ArrayPattern') {
    return input.elements.flatMap((element) =>
      element ? collectBindingNames(element) : []
    );
  }
  if (input.type === 'ObjectPattern') {
    return input.properties.flatMap((property) =>
      property.type === 'RestElement'
        ? collectBindingNames(property.argument)
        : collectBindingNames(property.value)
    );
  }
  return [];
}

function readStaticMemberName(
  node: t.MemberExpression | t.OptionalMemberExpression
): string | undefined {
  if (!node.computed && node.property.type === 'Identifier') {
    return node.property.name;
  }
  return node.computed && node.property.type === 'StringLiteral'
    ? node.property.value
    : undefined;
}

function isGlobalMutationCall(input: t.Node, scope: Scope): boolean {
  const node = unwrapExpression(input);
  if (
    node.type !== 'MemberExpression' &&
    node.type !== 'OptionalMemberExpression'
  ) {
    return false;
  }
  const method = readStaticMemberName(node);
  if (node.object.type !== 'Identifier' || scope.getBinding(node.object.name)) {
    return false;
  }
  return (
    (node.object.name === 'Object' &&
      (method === 'assign' ||
        method === 'defineProperty' ||
        method === 'defineProperties')) ||
    (node.object.name === 'Reflect' &&
      (method === 'set' || method === 'deleteProperty'))
  );
}

function isKnownReadOnlyConfigConsumer(
  call: t.CallExpression | t.OptionalCallExpression,
  argument: t.Node,
  scope: Scope
): boolean {
  if (resolveKnownConfigConsumer(call.callee, scope, new Set())) return true;
  const callee = unwrapExpression(call.callee);
  if (
    callee.type !== 'MemberExpression' &&
    callee.type !== 'OptionalMemberExpression'
  ) {
    return false;
  }
  const method = readStaticMemberName(callee);
  if (
    callee.object.type !== 'Identifier' ||
    scope.getBinding(callee.object.name)
  ) {
    return false;
  }
  const argumentIndex = call.arguments.findIndex(
    (candidate) => candidate === argument
  );
  if (callee.object.name === 'Object') {
    if (method === 'assign') return argumentIndex > 0;
    return new Set([
      'entries',
      'freeze',
      'getOwnPropertyDescriptor',
      'getOwnPropertyDescriptors',
      'getOwnPropertyNames',
      'getOwnPropertySymbols',
      'isExtensible',
      'isFrozen',
      'isSealed',
      'keys',
      'preventExtensions',
      'seal',
      'values',
    ]).has(method ?? '');
  }
  return (
    (callee.object.name === 'Array' && method === 'isArray') ||
    (callee.object.name === 'JSON' && method === 'stringify')
  );
}

function resolveKnownConfigConsumer(
  input: t.Node,
  scope: Scope,
  seen: Set<Binding>
): boolean {
  const node = unwrapExpression(input);
  if (node.type === 'Identifier') {
    const binding = scope.getBinding(node.name);
    if (!binding) return node.name === 'defineNuxtConfig';
    if (seen.has(binding)) return false;
    if (binding.path.isImportDefaultSpecifier()) {
      const declaration = binding.path.parentPath;
      return (
        declaration.isImportDeclaration() &&
        (declaration.node.source.value === '@vitejs/plugin-vue' ||
          declaration.node.source.value === '@vitejs/plugin-vue-jsx')
      );
    }
    if (binding.path.isImportSpecifier()) {
      const declaration = binding.path.parentPath;
      if (!declaration.isImportDeclaration()) return false;
      const imported = binding.path.node.imported;
      const name =
        imported.type === 'Identifier' ? imported.name : imported.value;
      const source = declaration.node.source.value;
      return (
        ((source === '@vitejs/plugin-vue' ||
          source === '@vitejs/plugin-vue-jsx') &&
          name === 'default') ||
        (source === 'vite' && name === 'defineConfig') ||
        ((source === 'nuxt' ||
          source === 'nuxt/config' ||
          source === '#imports') &&
          name === 'defineNuxtConfig')
      );
    }
    const declaration = binding.path.node;
    if (
      binding.constant &&
      declaration.type === 'VariableDeclarator' &&
      declaration.init
    ) {
      const nextSeen = new Set(seen);
      nextSeen.add(binding);
      return resolveKnownConfigConsumer(
        declaration.init,
        binding.path.scope,
        nextSeen
      );
    }
    return false;
  }
  return (
    (node.type === 'MemberExpression' ||
      node.type === 'OptionalMemberExpression') &&
    isDefaultMember(node) &&
    (getPluginVueRequireKind(node as t.Expression, '@vitejs/plugin-vue') ===
      'default' ||
      getPluginVueRequireKind(
        node as t.Expression,
        '@vitejs/plugin-vue-jsx'
      ) === 'default')
  );
}

/**
 * Parses one project config without executing it. Automatic discovery keeps
 * ignoring malformed configs that contain no Vue-relevant setting, while an
 * explicit config or source scope reports every syntax error.
 */
function parseConfig(
  file: string,
  errors: string[],
  reportAllSyntaxErrors: boolean
): t.File | undefined {
  let source: string;
  try {
    source = fs.readFileSync(file, 'utf8');
  } catch (error) {
    errors.push(
      configFileDiagnostic(
        'Could not read the Vue project config file',
        'Restore the config file and its read permissions, then try extraction again',
        file,
        error
      )
    );
    return undefined;
  }

  try {
    return parse(source, {
      sourceType: 'unambiguous',
      plugins: parserPlugins(file),
    });
  } catch (error) {
    if (
      !reportAllSyntaxErrors &&
      !/compilerOptions|whitespace|delimiters|@vitejs\/plugin-vue-jsx|babelPlugins|pragma/.test(
        source
      )
    ) {
      return undefined;
    }
    const syntaxError = error as SyntaxError & {
      loc?: { column: number; line: number };
    };
    errors.push(
      withLocation(
        file,
        createDiagnosticMessage({
          whatHappened: reportAllSyntaxErrors
            ? 'Could not parse the Vue project config file'
            : 'Could not parse a project configuration containing Vue compiler options',
          details: syntaxError.message,
          fix: 'Use a statically analyzable Vite or Nuxt configuration, or configure files.gt.parsingFlags.vueCompilerOptions explicitly',
        }),
        syntaxError.loc
          ? `${syntaxError.loc.line}:${syntaxError.loc.column + 1}`
          : undefined
      )
    );
    return undefined;
  }
}

function parserPlugins(file: string): ParserPlugin[] {
  const extension = path.extname(file).toLowerCase();
  const plugins: ParserPlugin[] = [];
  if (
    extension === '.ts' ||
    extension === '.mts' ||
    extension === '.cts' ||
    extension === '.tsx'
  ) {
    plugins.push('typescript', 'decorators-legacy');
  }
  if (extension === '.jsx' || extension === '.tsx') plugins.push('jsx');
  return plugins;
}

function mergeOption<K extends CompilerOptionName>(
  state: CompilerOptionState,
  key: K,
  value: Required<Pick<VueCompilerOptions, K>>[K],
  source: OptionSource,
  errors: string[]
): void {
  const existing = state.options[key];
  if (existing !== undefined && !sameOption(existing, value)) {
    errors.push(
      locatedOptionError(
        source.file,
        source.node,
        `Found conflicting Vue ${key} compiler options`,
        'Use the same Vue compiler options in the project configuration and files.gt.parsingFlags.vueCompilerOptions'
      )
    );
    return;
  }
  Object.assign(state.options, { [key]: value });
  state.sources[key] ??= source;
}

function sameOption(
  first: VueCompilerOptions[CompilerOptionName],
  second: VueCompilerOptions[CompilerOptionName]
): boolean {
  return Array.isArray(first) && Array.isArray(second)
    ? first[0] === second[0] && first[1] === second[1]
    : first === second;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isDelimiterPair(value: unknown): value is [string, string] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every(
      (delimiter) => typeof delimiter === 'string' && delimiter.length > 0
    )
  );
}

function dynamicConfigError(file: string, node: t.Node): string {
  return locatedOptionError(
    file,
    node,
    'Could not statically resolve Vue compiler options',
    'Use static object and string literals for Vue whitespace and delimiters compiler options so extraction hashes match the compiled app'
  );
}

function dynamicVueJSXConfigError(file: string, node: t.Node): string {
  return locatedOptionError(
    file,
    node,
    'Could not statically resolve @vitejs/plugin-vue-jsx options',
    'Use one statically configured Vue JSX plugin with the default VNode transform so extraction hashes match the compiled app'
  );
}

function locatedOptionError(
  file: string,
  node: t.Node | undefined,
  whatHappened: string,
  fix: string
): string {
  return withLocation(
    file,
    createDiagnosticMessage({ whatHappened, fix }),
    node?.loc
      ? `${node.loc.start.line}:${node.loc.start.column + 1}`
      : undefined
  );
}

function optionError(whatHappened: string, fix: string): string {
  return createDiagnosticMessage({ whatHappened, fix });
}

/** Formats a filesystem-backed config diagnostic without leaking an exception. */
function configFileDiagnostic(
  whatHappened: string,
  fix: string,
  file: string,
  error?: unknown
): string {
  const errorDetails =
    error === undefined ? undefined : formatDiagnosticErrorDetails(error);
  const details = [file, ...(errorDetails === undefined ? [] : [errorDetails])];
  return createDiagnosticMessage({ whatHappened, fix, details });
}

function withLocation(
  file: string,
  message: string,
  location?: string
): string {
  return `${file}${location ? ` (${location})` : ''}: ${message}`;
}
