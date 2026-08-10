import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import type { parse as parseVueTemplate } from '@vue/compiler-dom';
import type * as VueCompilerModule from '@vue/compiler-sfc';
import type { TemplateCompiler } from '@vue/compiler-sfc';
import { DecodingMode, decodeHTML } from 'entities/decode';
import type { VueCompiler } from '../types.js';

/** Whitespace test used by Vue when it constructs an implicit default slot. */
export type ImplicitSlotWhitespace = 'ecmascript' | 'html';

export type ResolvedVueCompiler = {
  compiler: ExactVueCompiler;
  implicitSlotWhitespace: ImplicitSlotWhitespace;
  parseTemplate?: typeof parseVueTemplate;
  templateCompiler?: TemplateCompiler;
  templateParseOptionsSupported: boolean;
  /** Whether a valued `v-is` replaces its source element at runtime. */
  valuedVIsReplacesElement: boolean;
  version: string;
};

type CompilerResolution =
  | { ok: true; value: ResolvedVueCompiler }
  | { ok: false; details: string };

const resolvedCompilers = new Map<string, CompilerResolution>();
const inspectedCompilers = new WeakMap<object, CompilerResolution>();

type ExactVueCompiler = Pick<
  typeof VueCompilerModule,
  'compileTemplate' | 'version'
> & {
  /** Newer SFC parser options accepted at runtime but absent in Vue 3.3 types. */
  parse: (
    source: string,
    options?: NonNullable<Parameters<typeof VueCompilerModule.parse>[1]> & {
      templateParseOptions?: Record<string, unknown>;
    }
  ) => ReturnType<typeof VueCompilerModule.parse>;
  parseTemplate?: typeof parseVueTemplate;
  /** Adjacent compiler-dom surface used to apply legacy parser options. */
  templateCompiler?: TemplateCompiler;
};

/**
 * Resolves the exact Vue compiler selected by the consuming source file.
 *
 * The `vue/compiler-sfc` export is version-locked to that installation's Vue
 * runtime. Resolving from the SFC first is important in workspaces where apps
 * intentionally use different Vue versions.
 */
export function resolveVueCompiler(
  file: string,
  projectRoot: string
): CompilerResolution {
  const absoluteFile = path.isAbsolute(file)
    ? file
    : path.resolve(projectRoot, file);
  const anchors = [absoluteFile, path.join(projectRoot, 'package.json')];

  for (const anchor of anchors) {
    const requireFromConsumer = createRequire(anchor);
    let vueManifestPath: string;
    try {
      vueManifestPath = requireFromConsumer.resolve('vue/package.json');
    } catch (error) {
      if (isMissingModule(error)) continue;
      return {
        ok: false,
        details: formatResolutionError(error),
      };
    }

    let compilerPath: string;
    try {
      compilerPath = requireFromConsumer.resolve('vue/compiler-sfc');
    } catch (error) {
      return {
        ok: false,
        details: `Resolved the app's Vue package at ${vueManifestPath}, but its compiler-sfc export could not be loaded: ${formatResolutionError(error)}`,
      };
    }

    const cached = resolvedCompilers.get(compilerPath);
    if (cached) return cached;

    const resolution = loadCompiler(
      requireFromConsumer,
      compilerPath,
      vueManifestPath,
      readVueVersion(requireFromConsumer, vueManifestPath)
    );
    resolvedCompilers.set(compilerPath, resolution);
    return resolution;
  }

  const declaredVersion = findDeclaredVueVersion(absoluteFile, projectRoot);
  if (declaredVersion) {
    return {
      ok: false,
      details: `The project declares Vue ${JSON.stringify(declaredVersion)} but vue/compiler-sfc could not be resolved from ${absoluteFile}.`,
    };
  }

  return {
    ok: false,
    details: `Could not resolve vue/compiler-sfc from ${absoluteFile}.`,
  };
}

/** Validates an explicitly supplied compiler before extraction uses it. */
export function inspectVueCompiler(compiler: VueCompiler): CompilerResolution {
  if (!compiler || typeof compiler !== 'object') {
    return {
      ok: false,
      details: 'The supplied Vue compiler is not an object.',
    };
  }
  const cached = inspectedCompilers.get(compiler);
  if (cached) return cached;
  const exactCompiler = compiler as ExactVueCompiler;
  const resolution = isVueCompiler(compiler)
    ? inspectCompiler(
        exactCompiler,
        exactCompiler.parseTemplate,
        exactCompiler.templateCompiler
      )
    : {
        ok: false as const,
        details:
          'The supplied object does not expose the Vue compiler-sfc API.',
      };
  inspectedCompilers.set(compiler, resolution);
  return resolution;
}

function loadCompiler(
  requireFromConsumer: NodeRequire,
  compilerPath: string,
  vueManifestPath: string,
  vueVersion: string | undefined
): CompilerResolution {
  try {
    const loaded = requireFromConsumer(compilerPath) as unknown;
    const defaultExport = readDefaultExport(loaded);
    const compiler = isVueCompiler(loaded)
      ? (loaded as ExactVueCompiler)
      : isVueCompiler(defaultExport)
        ? (defaultExport as ExactVueCompiler)
        : undefined;
    if (!compiler) {
      return {
        ok: false,
        details: `The module at ${compilerPath} does not expose the Vue compiler-sfc API.`,
      };
    }
    if (vueVersion && compiler.version !== vueVersion) {
      return {
        ok: false,
        details: `The app resolves Vue ${vueVersion} but vue/compiler-sfc ${compiler.version}. Install one matching Vue package version.`,
      };
    }
    if (!isSupportedVueVersion(compiler.version)) {
      return {
        ok: false,
        details: `Resolved Vue compiler version ${JSON.stringify(compiler.version)}; gt-vue supports Vue 3.3 through Vue 3.x.`,
      };
    }
    const requireFromCompiler = createRequire(compilerPath);
    const compilerDomPath = requireFromCompiler.resolve('@vue/compiler-dom');
    const compilerDom = requireFromCompiler(compilerDomPath) as {
      compile?: TemplateCompiler['compile'];
      parse?: typeof parseVueTemplate;
    };
    const compilerDomVersion = readVueVersion(
      requireFromCompiler,
      requireFromCompiler.resolve('@vue/compiler-dom/package.json')
    );
    if (compilerDomVersion !== compiler.version) {
      return {
        ok: false,
        details: `vue/compiler-sfc ${compiler.version} resolves @vue/compiler-dom ${String(compilerDomVersion)}. Install matching Vue compiler packages.`,
      };
    }
    if (typeof compilerDom.parse !== 'function') {
      return {
        ok: false,
        details: `The template compiler at ${compilerDomPath} does not expose parse().`,
      };
    }
    if (typeof compilerDom.compile !== 'function') {
      return {
        ok: false,
        details: `The template compiler at ${compilerDomPath} does not expose compile().`,
      };
    }
    return inspectCompiler(compiler, compilerDom.parse, {
      compile: compilerDom.compile,
      parse: compilerDom.parse,
    });
  } catch (error) {
    const bunResolution = loadBunCompiler(
      requireFromConsumer,
      vueManifestPath,
      vueVersion
    );
    if (bunResolution) return bunResolution;
    return { ok: false, details: formatResolutionError(error) };
  }
}

/** Loads exact, self-contained Vue browser compilers in a compiled Bun CLI. */
function loadBunCompiler(
  requireFromConsumer: NodeRequire,
  vueManifestPath: string,
  vueVersion: string | undefined
): CompilerResolution | undefined {
  if (typeof process.versions.bun !== 'string') return undefined;

  try {
    const compilerSfcRoot = findInstalledPackageRoot(
      vueManifestPath,
      '@vue/compiler-sfc'
    );
    const compilerDomRoot = findInstalledPackageRoot(
      vueManifestPath,
      '@vue/compiler-dom'
    );
    if (!compilerSfcRoot || !compilerDomRoot) {
      return {
        ok: false,
        details:
          'The Vue installation does not contain its compiler-sfc and compiler-dom dependencies.',
      };
    }

    const compilerPath = path.join(
      compilerSfcRoot,
      'dist/compiler-sfc.esm-browser.js'
    );
    const compilerDomPath = path.join(
      compilerDomRoot,
      'dist/compiler-dom.esm-browser.js'
    );
    const loaded = requireFromConsumer(compilerPath) as unknown;
    const defaultExport = readDefaultExport(loaded);
    const compiler = isVueCompiler(loaded)
      ? (loaded as ExactVueCompiler)
      : isVueCompiler(defaultExport)
        ? (defaultExport as ExactVueCompiler)
        : undefined;
    if (!compiler) {
      return {
        ok: false,
        details: `The module at ${compilerPath} does not expose the Vue compiler-sfc API.`,
      };
    }
    if (vueVersion && compiler.version !== vueVersion) {
      return {
        ok: false,
        details: `The app resolves Vue ${vueVersion} but vue/compiler-sfc ${compiler.version}. Install one matching Vue package version.`,
      };
    }
    if (!isSupportedVueVersion(compiler.version)) {
      return {
        ok: false,
        details: `Resolved Vue compiler version ${JSON.stringify(compiler.version)}; gt-vue supports Vue 3.3 through Vue 3.x.`,
      };
    }

    const compilerDom = requireFromConsumer(compilerDomPath) as {
      compile?: TemplateCompiler['compile'];
      parse?: typeof parseVueTemplate;
    };
    const compilerDomVersion = readPackageVersion(compilerDomRoot);
    if (compilerDomVersion !== compiler.version) {
      return {
        ok: false,
        details: `vue/compiler-sfc ${compiler.version} resolves @vue/compiler-dom ${String(compilerDomVersion)}. Install matching Vue compiler packages.`,
      };
    }
    if (typeof compilerDom.parse !== 'function') {
      return {
        ok: false,
        details: `The template compiler at ${compilerDomPath} does not expose parse().`,
      };
    }
    if (typeof compilerDom.compile !== 'function') {
      return {
        ok: false,
        details: `The template compiler at ${compilerDomPath} does not expose compile().`,
      };
    }
    const templateCompiler = createHeadlessBrowserTemplateCompiler(
      compilerDom.parse,
      compilerDom.compile
    );
    return inspectCompiler(compiler, templateCompiler.parse, templateCompiler);
  } catch (error) {
    return { ok: false, details: formatResolutionError(error) };
  }
}

/** Replaces compiler-dom's browser-only DOM entity decoder. */
function createHeadlessBrowserTemplateCompiler(
  browserParse: typeof parseVueTemplate,
  browserCompile: TemplateCompiler['compile']
): TemplateCompiler & { parse: typeof parseVueTemplate } {
  const decodeEntities = (raw: string, asAttribute = false) =>
    decodeHTML(raw, asAttribute ? DecodingMode.Attribute : DecodingMode.Legacy);
  const parse: typeof parseVueTemplate = (source, options) =>
    browserParse(source, {
      ...options,
      decodeEntities,
    } as NonNullable<Parameters<typeof browserParse>[1]>);
  const compile: TemplateCompiler['compile'] = (source, options) =>
    browserCompile(source, {
      ...options,
      decodeEntities,
    } as NonNullable<Parameters<typeof browserCompile>[1]>);
  return { compile, parse };
}

/** Finds one dependency relative to the physical Vue installation on disk. */
function findInstalledPackageRoot(
  vueManifestPath: string,
  packageName: string
): string | undefined {
  const packageSegments = packageName.split('/');
  let directory = path.dirname(vueManifestPath);
  while (true) {
    const candidate =
      path.basename(directory) === 'node_modules'
        ? path.join(directory, ...packageSegments)
        : path.join(directory, 'node_modules', ...packageSegments);
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
    const parent = path.dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

function readPackageVersion(packageRoot: string): string | undefined {
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')
    ) as { version?: unknown };
    return typeof manifest.version === 'string' ? manifest.version : undefined;
  } catch {
    return undefined;
  }
}

function readVueVersion(
  requireFromConsumer: NodeRequire,
  manifestPath: string
): string | undefined {
  try {
    const manifest = requireFromConsumer(manifestPath) as { version?: unknown };
    return typeof manifest.version === 'string' ? manifest.version : undefined;
  } catch {
    return undefined;
  }
}

/** Finds an installed-but-missing declaration that bundled fallback could hide. */
function findDeclaredVueVersion(
  absoluteFile: string,
  projectRoot: string
): string | undefined {
  const stop = path.resolve(projectRoot);
  let directory = path.dirname(absoluteFile);
  while (true) {
    const version = readDeclaredVueVersion(
      path.join(directory, 'package.json')
    );
    if (version) return version;
    if (directory === stop || directory === path.dirname(directory)) break;
    directory = path.dirname(directory);
  }
  return readDeclaredVueVersion(path.join(stop, 'package.json'));
}

function readDeclaredVueVersion(manifestPath: string): string | undefined {
  try {
    const manifest = JSON.parse(
      fs.readFileSync(manifestPath, 'utf8')
    ) as Record<string, unknown>;
    for (const section of [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ]) {
      const dependencies = manifest[section];
      if (
        dependencies &&
        typeof dependencies === 'object' &&
        'vue' in dependencies
      ) {
        const version = (dependencies as Record<string, unknown>).vue;
        return typeof version === 'string' ? version : 'an unknown version';
      }
    }
  } catch (error) {
    if (
      !error ||
      typeof error !== 'object' ||
      !('code' in error) ||
      error.code !== 'ENOENT'
    ) {
      throw error;
    }
  }
  return undefined;
}

function inspectCompiler(
  compiler: ExactVueCompiler,
  parseTemplate?: typeof parseVueTemplate,
  templateCompiler?: TemplateCompiler
): CompilerResolution {
  const version = compiler.version;
  if (!isSupportedVueVersion(version)) {
    return {
      ok: false,
      details: `Resolved Vue compiler version ${JSON.stringify(version)}; gt-vue supports Vue 3.3 through Vue 3.x.`,
    };
  }

  try {
    const templateParseOptionsSupported =
      supportsTemplateParseOptions(compiler);
    if (!parseTemplate && !templateParseOptionsSupported) {
      return {
        ok: false,
        details:
          'The supplied compiler does not expose exact template parser options. Let the extractor resolve vue/compiler-sfc from the consuming app instead.',
      };
    }
    const compilerBehavior = detectTemplateCompilerBehavior(compiler);
    return {
      ok: true,
      value: {
        compiler,
        implicitSlotWhitespace: compilerBehavior.implicitSlotWhitespace,
        parseTemplate,
        templateCompiler,
        templateParseOptionsSupported,
        valuedVIsReplacesElement: compilerBehavior.valuedVIsReplacesElement,
        version,
      },
    };
  } catch (error) {
    return { ok: false, details: formatResolutionError(error) };
  }
}

/** Detects the SFC parser option added after Vue 3.4. */
function supportsTemplateParseOptions(compiler: ExactVueCompiler): boolean {
  const source = '<template><Probe>First\n  second</Probe></template>';
  const parseText = (whitespace: 'condense' | 'preserve') => {
    const result = compiler.parse(source, {
      templateParseOptions: { whitespace },
    });
    return collectText(result.descriptor.template?.ast);
  };
  return parseText('condense') !== parseText('preserve');
}

function collectText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  let output = '';
  if ('type' in value && value.type === 2 && 'content' in value) {
    output += String(value.content);
  }
  if ('children' in value && Array.isArray(value.children)) {
    for (const child of value.children) output += collectText(child);
  }
  return output;
}

/**
 * Detects version-sensitive template semantics instead of inferring them from
 * a semver range. Vue 3.3/3.4 use ECMAScript `trim()` for slot whitespace,
 * while Vue 3.5 uses the HTML parser's ASCII set. Vue 3.3 also compiles valued
 * `v-is` as a dynamic selector, while newer Vue releases retain the source
 * element. One behavior probe remains exact if either behavior is backported.
 */
function detectTemplateCompilerBehavior(compiler: ExactVueCompiler): {
  implicitSlotWhitespace: ImplicitSlotWhitespace;
  valuedVIsReplacesElement: boolean;
} {
  const result = compiler.compileTemplate({
    filename: 'gt-vue-compiler-probe.vue',
    id: 'gt-vue-compiler-probe',
    source:
      '<Probe><template #named>x</template>&nbsp;</Probe><div v-is="Probe" />',
  });
  if (result.errors.length > 0) {
    throw new Error(
      `The Vue compiler compatibility probe failed: ${result.errors.map(String).join('; ')}`
    );
  }

  const component = result.ast?.children.find(
    (node) =>
      typeof node === 'object' &&
      node !== null &&
      'tag' in node &&
      node.tag === 'Probe'
  );
  const codegen =
    component && 'codegenNode' in component ? component.codegenNode : undefined;
  const children =
    codegen &&
    typeof codegen === 'object' &&
    'children' in codegen &&
    codegen.children &&
    typeof codegen.children === 'object'
      ? codegen.children
      : undefined;
  const properties =
    children && 'properties' in children && Array.isArray(children.properties)
      ? children.properties
      : undefined;
  if (!properties) {
    throw new Error(
      'The Vue compiler compatibility probe returned an unknown slot AST.'
    );
  }

  const hasImplicitDefault = properties.some((property) => {
    if (!property || typeof property !== 'object' || !('key' in property)) {
      return false;
    }
    const key = property.key;
    return (
      key != null &&
      typeof key === 'object' &&
      'content' in key &&
      key.content === 'default'
    );
  });
  const vIsElement = result.ast?.children.find(
    (node) =>
      typeof node === 'object' &&
      node !== null &&
      'tag' in node &&
      node.tag === 'div'
  );
  return {
    implicitSlotWhitespace: hasImplicitDefault ? 'html' : 'ecmascript',
    valuedVIsReplacesElement: Boolean(
      vIsElement && 'tagType' in vIsElement && vIsElement.tagType === 1
    ),
  };
}

function isVueCompiler(value: unknown): value is VueCompiler {
  if (!value || typeof value !== 'object') return false;
  return (
    'compileTemplate' in value &&
    typeof value.compileTemplate === 'function' &&
    'parse' in value &&
    typeof value.parse === 'function' &&
    'version' in value &&
    typeof value.version === 'string'
  );
}

/** Reads a possible CommonJS-interoperability default export. */
function readDefaultExport(value: unknown): unknown {
  return value && typeof value === 'object' && 'default' in value
    ? value.default
    : undefined;
}

function isSupportedVueVersion(version: string): boolean {
  const match = /^(\d+)\.(\d+)(?:\.|$)/.exec(version);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major === 3 && minor >= 3;
}

function isMissingModule(error: unknown): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'MODULE_NOT_FOUND'
  );
}

function formatResolutionError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
