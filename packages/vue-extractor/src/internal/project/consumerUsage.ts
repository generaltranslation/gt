import fs from 'node:fs';
import path from 'node:path';
import traverseModule, {
  type Binding,
  type NodePath,
  type Scope,
} from '@babel/traverse';
import * as t from '@babel/types';
import { parseScriptAst } from '../script/parser.js';
import {
  readJavaScriptPackageManifest,
  type JavaScriptPackageManifest,
} from './manifest.js';
import { DEFAULT_VUE_SOURCE_DIRECTORIES } from './sourcePatterns.js';
import {
  readPublicGTImports,
  readPublicImportEntries,
  type PublicGTImport,
} from './wrapperProvenance.js';
import { classifyVueSource } from './vueSourceClassification.js';

const traverse = traverseModule.default || traverseModule;

const CONSUMER_SOURCE_EXTENSIONS = new Set([
  '.cjs',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
  '.vue',
]);

const IGNORED_CONSUMER_DIRECTORIES = new Set([
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'storybook-static',
  'target',
  'temp',
  'tmp',
]);

const GENERATED_CONSUMER_ROOT_DIRECTORIES = new Set([
  'cjs',
  'es',
  'esm',
  'generated',
  'lib',
  'lib-esm',
]);

/** Prevents wrapper-use detection from walking an unbounded package tree. */
const MAX_CONSUMER_SOURCE_FILES = 20_000;

type ConsumerImport = {
  importedNames: ReadonlySet<string> | '*';
  source: string;
};

type ConsumerImportIndex = Map<string, ReadonlySet<string> | '*'>;

type ConsumerSourceIndex = {
  exhausted: boolean;
  importsBySpecifier: ConsumerImportIndex;
  pendingDirectories: string[];
  pendingFiles: string[];
  root: string;
  seenFiles: Set<string>;
  sourceFiles: number;
};

/** Per-inspection state that prevents repeated wrapper provenance scans. */
export type ConsumerUsageCache = {
  consumers: Map<string, ConsumerSourceIndex>;
  publicImports: Map<string, PublicGTImport[]>;
  queries: Map<string, boolean>;
};

/** Creates an edit-fresh cache for one project detection or inspection. */
export function createConsumerUsageCache(): ConsumerUsageCache {
  return {
    consumers: new Map(),
    publicImports: new Map(),
    queries: new Map(),
  };
}

/**
 * Returns whether consumer source actually imports a wrapper's public GT API.
 *
 * A dependency can expose separate React and Vue entrypoints. Package
 * metadata alone cannot tell which one an application uses, so Vue ownership
 * propagates only through a static value import or re-export of the exact
 * public subpath and export name. The dependency binding name is kept
 * separate from the package's declared name so npm/workspace aliases retain
 * their consumer-visible specifiers.
 */
export function packageConsumesPublicGT(
  consumerDirectory: string,
  dependencyName: string,
  packageDirectory: string,
  manifest: JavaScriptPackageManifest,
  cache: ConsumerUsageCache = createConsumerUsageCache()
): boolean {
  const packageName = readPackageName(manifest);
  if (!packageName) return false;
  const consumerRoot = resolveRealPath(consumerDirectory);
  const packageRoot = resolveRealPath(packageDirectory);
  const queryKey = `${consumerRoot}\0${dependencyName}\0${packageRoot}`;
  const cachedQuery = cache.queries.get(queryKey);
  if (cachedQuery !== undefined) return cachedQuery;

  let packagePublicImports = cache.publicImports.get(packageRoot);
  if (!packagePublicImports) {
    packagePublicImports = readPublicGTImports(packageDirectory, manifest);
    cache.publicImports.set(packageRoot, packagePublicImports);
  }
  const publicImports = packagePublicImports.map(
    ({ entry: _entry, exportNames, specifier }) => ({
      exportNames,
      specifier: `${dependencyName}${specifier.slice(packageName.length)}`,
    })
  );
  if (publicImports.length === 0) return false;

  const importsBySpecifier = new Map<string, ReadonlySet<string>>();
  for (const { exportNames, specifier } of publicImports) {
    const existing = importsBySpecifier.get(specifier);
    importsBySpecifier.set(
      specifier,
      existing ? new Set([...existing, ...exportNames]) : exportNames
    );
  }
  const result = consumerSourceUsesGT(consumerRoot, importsBySpecifier, cache);
  cache.queries.set(queryKey, result);
  return result;
}

/** Returns whether a wrapper exposes any public gt-vue-derived value. */
export function packageExposesPublicGT(
  packageDirectory: string,
  manifest: JavaScriptPackageManifest,
  cache: ConsumerUsageCache
): boolean {
  const packageRoot = resolveRealPath(packageDirectory);
  let publicImports = cache.publicImports.get(packageRoot);
  if (!publicImports) {
    publicImports = readPublicGTImports(packageDirectory, manifest);
    cache.publicImports.set(packageRoot, publicImports);
  }
  return publicImports.length > 0;
}

/** Scans one package boundary for static imports of its dependency's GT API. */
function consumerSourceUsesGT(
  consumerDirectory: string,
  importsBySpecifier: ReadonlyMap<string, ReadonlySet<string>>,
  cache: ConsumerUsageCache
): boolean {
  let consumer = cache.consumers.get(consumerDirectory);
  if (!consumer) {
    consumer = createConsumerSourceIndex(consumerDirectory);
    cache.consumers.set(consumerDirectory, consumer);
  }
  if (
    consumerImportIndexMatches(consumer.importsBySpecifier, importsBySpecifier)
  ) {
    return true;
  }
  while (!consumer.exhausted) {
    const file = readNextConsumerSourceFile(consumer);
    if (!file) break;
    mergeConsumerImports(
      consumer.importsBySpecifier,
      readConsumerImports(file)
    );
    if (
      consumerImportIndexMatches(
        consumer.importsBySpecifier,
        importsBySpecifier
      )
    ) {
      return true;
    }
  }
  return false;
}

/** Creates a lazy, single-pass source index for one consumer package. */
function createConsumerSourceIndex(root: string): ConsumerSourceIndex {
  const pendingFiles = new Set<string>();
  const consumerManifest = readJavaScriptPackageManifest(
    path.join(root, 'package.json')
  );
  if (consumerManifest) {
    for (const { entry } of readPublicImportEntries(root, consumerManifest)) {
      if (isConsumerSourceFile(entry) && !isIgnoredConsumerPath(root, entry)) {
        pendingFiles.add(entry);
      }
    }
  }
  try {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.vue') {
        pendingFiles.add(path.join(root, entry.name));
      }
    }
  } catch {
    // Public entries may still establish usage when the root cannot be listed.
  }
  return {
    exhausted: false,
    importsBySpecifier: new Map(),
    pendingDirectories: DEFAULT_VUE_SOURCE_DIRECTORIES.map((directory) =>
      path.join(root, directory)
    )
      .filter((directory) => isContainedPhysicalDirectory(root, directory))
      .reverse(),
    pendingFiles: [...pendingFiles].reverse(),
    root,
    seenFiles: new Set(),
    sourceFiles: 0,
  };
}

/** Returns each consumer source file at most once across every wrapper query. */
function readNextConsumerSourceFile(
  consumer: ConsumerSourceIndex
): string | undefined {
  while (true) {
    const pendingFile = consumer.pendingFiles.pop();
    if (pendingFile) {
      const file = resolveRealPath(pendingFile);
      if (consumer.seenFiles.has(file) || !isConsumerSourceFile(file)) continue;
      consumer.seenFiles.add(file);
      consumer.sourceFiles += 1;
      if (consumer.sourceFiles > MAX_CONSUMER_SOURCE_FILES) {
        consumer.exhausted = true;
        return undefined;
      }
      return file;
    }

    const current = consumer.pendingDirectories.pop();
    if (!current) {
      consumer.exhausted = true;
      return undefined;
    }
    if (fs.existsSync(path.join(current, 'package.json'))) {
      // Nested workspace packages establish their own ownership. Their imports
      // must never promote an aggregator or sibling package.
      continue;
    }

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    const sourceFiles: string[] = [];
    for (const entry of entries) {
      if (shouldIgnoreConsumerEntry(entry)) continue;
      const candidate = path.join(current, entry.name);
      if (entry.isDirectory()) {
        consumer.pendingDirectories.push(candidate);
      } else if (entry.isFile() && isConsumerSourceFile(candidate)) {
        sourceFiles.push(candidate);
      }
    }
    // The stack remains lazy while preserving the historical readdir order,
    // including which files fall inside the finite source budget.
    consumer.pendingFiles.push(...sourceFiles.reverse());
  }
}

function mergeConsumerImports(
  importsBySpecifier: ConsumerImportIndex,
  imports: readonly ConsumerImport[]
): void {
  for (const consumerImport of imports) {
    const existing = importsBySpecifier.get(consumerImport.source);
    if (existing === '*' || consumerImport.importedNames === '*') {
      importsBySpecifier.set(consumerImport.source, '*');
      continue;
    }
    importsBySpecifier.set(
      consumerImport.source,
      new Set([...(existing ?? []), ...consumerImport.importedNames])
    );
  }
}

function consumerImportIndexMatches(
  consumerImports: ReadonlyMap<string, ReadonlySet<string> | '*'>,
  gtImports: ReadonlyMap<string, ReadonlySet<string>>
): boolean {
  for (const [specifier, gtExportNames] of gtImports) {
    const importedNames = consumerImports.get(specifier);
    if (
      importedNames === '*' ||
      (importedNames &&
        [...importedNames].some((name) => gtExportNames.has(name)))
    ) {
      return true;
    }
  }
  return false;
}

function shouldIgnoreConsumerEntry(entry: fs.Dirent): boolean {
  return (
    entry.isSymbolicLink() ||
    (entry.isDirectory() &&
      (entry.name.startsWith('.') ||
        IGNORED_CONSUMER_DIRECTORIES.has(entry.name)))
  );
}

/** Accepts executable source while rejecting ambient declaration artifacts. */
function isConsumerSourceFile(file: string): boolean {
  const fileName = path.basename(file).toLowerCase();
  if (/\.d\.(?:c|m)?ts$/.test(fileName)) return false;
  return CONSUMER_SOURCE_EXTENSIONS.has(path.extname(fileName));
}

/** Rejects public entries that resolve only into generated package output. */
function isIgnoredConsumerPath(root: string, file: string): boolean {
  const relative = path.relative(root, file);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return true;
  }
  const directories = relative.split(path.sep).slice(0, -1);
  const rootDirectory = directories[0]?.toLowerCase();
  return Boolean(
    (rootDirectory && GENERATED_CONSUMER_ROOT_DIRECTORIES.has(rootDirectory)) ||
    directories.some((segment) => {
      const normalized = segment.toLowerCase();
      return (
        segment.startsWith('.') || IGNORED_CONSUMER_DIRECTORIES.has(normalized)
      );
    })
  );
}

/** Parses regular modules and the executable script blocks of Vue SFCs. */
function readConsumerImports(file: string): ConsumerImport[] {
  let source: string;
  try {
    source = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const extension = path.extname(file).toLowerCase();
  if (extension === '.vue') {
    if (classifyVueSource(source) === 'non-sfc') {
      return readScriptImports(source, 'tsx');
    }
    const { blocks, templateSource } = readVueScriptBlocks(source);
    const parsedBlocks = blocks.map((block) => ({
      ...block,
      ast: parseConsumerScript(block.source, block.language),
    }));
    const hasScriptSetup = parsedBlocks.some(
      ({ ast, setup, source }) =>
        setup && Boolean(ast) && Boolean(source.trim())
    );
    const templateBindings = hasScriptSetup
      ? readTemplateBindingMetadata(parsedBlocks)
      : undefined;
    const siblingExternalUsage = readSiblingExternalUsage(parsedBlocks);
    return parsedBlocks.flatMap(({ ast, setup }) =>
      ast
        ? collectStaticImports(ast, {
            externalUsage: siblingExternalUsage.get(ast.program),
            scriptSetup: setup,
            templateBindings,
            templateSource: hasScriptSetup ? templateSource : undefined,
          })
        : []
    );
  }
  const language =
    extension === '.mjs' || extension === '.cjs'
      ? 'js'
      : extension === '.mts' || extension === '.cts'
        ? 'ts'
        : extension.slice(1);
  return readScriptImports(source, language);
}

/** Reads SFC script blocks without loading a project Vue compiler. */
function readVueScriptBlocks(source: string): {
  blocks: ConsumerScriptBlock[];
  templateSource: string;
} {
  const blocks: ConsumerScriptBlock[] = [];
  const templateSources: string[] = [];
  for (const block of readTopLevelSfcBlocks(source)) {
    if (block.name === 'template') {
      templateSources.push(block.source);
      continue;
    }
    if (block.name !== 'script') continue;
    const attributes = readTemplateAttributes(block.attributes);
    blocks.push({
      language: attributes.find(({ name }) => name === 'lang')?.value,
      setup: attributes.some(({ name }) => name === 'setup'),
      source: block.source,
    });
  }
  return { blocks, templateSource: templateSources.join('\n') };
}

type ConsumerScriptBlock = {
  language: string | undefined;
  setup: boolean;
  source: string;
};

type ParsedConsumerScriptBlock = ConsumerScriptBlock & {
  ast: t.File | undefined;
};

/** Collects unresolved runtime references made from every sibling SFC block. */
function readSiblingExternalUsage(
  blocks: readonly ParsedConsumerScriptBlock[]
): Map<t.Program, TemplateUsage> {
  const usages = new Map<t.Program, TemplateUsage>();
  const parsedBlocks = blocks.filter(
    (block): block is ParsedConsumerScriptBlock & { ast: t.File } =>
      Boolean(block.ast)
  );
  for (const target of parsedBlocks) {
    const usage = createTemplateUsage();
    let hasSibling = false;
    for (const source of parsedBlocks) {
      if (source.ast.program === target.ast.program) continue;
      hasSibling = true;
      collectTemplateAstUsage(source.ast, usage, new Map(), source.setup);
    }
    if (hasSibling) usages.set(target.ast.program, usage);
  }
  return usages;
}

type SfcBlock = {
  attributes: string;
  name: string;
  source: string;
};

type MarkupTag = {
  attributes: string;
  closing: boolean;
  end: number;
  name: string;
  selfClosing: boolean;
  start: number;
};

/** Reads real top-level SFC blocks without loading the Vue compiler. */
function readTopLevelSfcBlocks(source: string): SfcBlock[] {
  const blocks: SfcBlock[] = [];
  let index = 0;
  while (index < source.length) {
    if (source.startsWith('<!--', index)) {
      index = readHtmlCommentEnd(source, index);
      continue;
    }
    if (source[index] !== '<') {
      index += 1;
      continue;
    }
    const tag = readMarkupTag(source, index);
    if (!tag) {
      index += 1;
      continue;
    }
    index = tag.end;
    if (tag.closing || tag.selfClosing) continue;

    const closingTag =
      tag.name === 'script' || tag.name === 'style'
        ? findRawBlockClosingTag(source, tag.name, tag.end)
        : findStructuredBlockClosingTag(source, tag.name, tag.end);
    if (!closingTag) continue;
    if (tag.name === 'script' || tag.name === 'template') {
      blocks.push({
        attributes: tag.attributes,
        name: tag.name,
        source: source.slice(tag.end, closingTag.start),
      });
    }
    index = closingTag.end;
  }
  return blocks;
}

/** Reads one quote-aware markup tag at an exact source offset. */
function readMarkupTag(source: string, start: number): MarkupTag | undefined {
  if (source[start] !== '<' || source.startsWith('<!--', start)) {
    return undefined;
  }
  let cursor = start + 1;
  const closing = source[cursor] === '/';
  if (closing) cursor += 1;
  const nameStart = cursor;
  while (cursor < source.length && /[A-Za-z0-9:_-]/.test(source[cursor]!)) {
    cursor += 1;
  }
  if (cursor === nameStart) return undefined;
  const name = source.slice(nameStart, cursor).toLowerCase();
  const attributesStart = cursor;
  let quote: string | undefined;
  while (cursor < source.length) {
    const character = source[cursor]!;
    if (quote) {
      if (character === quote) quote = undefined;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '>') {
      const attributes = source.slice(attributesStart, cursor);
      return {
        attributes,
        closing,
        end: cursor + 1,
        name,
        selfClosing: !closing && /\/\s*$/.test(attributes),
        start,
      };
    }
    cursor += 1;
  }
  return undefined;
}

/** Finds a raw-text script/style closing tag using HTML parsing semantics. */
function findRawBlockClosingTag(
  source: string,
  name: string,
  start: number
): MarkupTag | undefined {
  const expression = new RegExp(
    `<\\/\\s*${escapeRegularExpression(name)}\\s*>`,
    'gi'
  );
  expression.lastIndex = start;
  const match = expression.exec(source);
  return match ? readMarkupTag(source, match.index) : undefined;
}

/** Finds a matching structured block while respecting comments and nesting. */
function findStructuredBlockClosingTag(
  source: string,
  name: string,
  start: number
): MarkupTag | undefined {
  let depth = 1;
  let index = start;
  while (index < source.length) {
    if (source.startsWith('<!--', index)) {
      index = readHtmlCommentEnd(source, index);
      continue;
    }
    if (source[index] !== '<') {
      index += 1;
      continue;
    }
    const tag = readMarkupTag(source, index);
    if (!tag) {
      index += 1;
      continue;
    }
    index = tag.end;
    if (tag.name !== name) continue;
    if (tag.closing) {
      depth -= 1;
      if (depth === 0) return tag;
    } else if (!tag.selfClosing) {
      depth += 1;
    }
  }
  return undefined;
}

function readHtmlCommentEnd(source: string, start: number): number {
  const end = source.indexOf('-->', start + 4);
  return end < 0 ? source.length : end + 3;
}

/** Accepts project-compatible syntax while extracting only static ESM edges. */
function readScriptImports(
  source: string,
  declaredLanguage: string | undefined
): ConsumerImport[] {
  const ast = parseConsumerScript(source, declaredLanguage);
  return ast ? collectStaticImports(ast) : [];
}

/** Parses syntax accepted by consumer discovery without requiring Vue. */
function parseConsumerScript(
  source: string,
  declaredLanguage: string | undefined
): t.File | undefined {
  const languages = new Set<string | undefined>([declaredLanguage]);
  languages.add('tsx');
  if (
    declaredLanguage === 'js' ||
    declaredLanguage === 'jsx' ||
    declaredLanguage === 'tsx'
  ) {
    languages.add('flow');
  }

  for (const language of languages) {
    try {
      return parseScriptAst(source, language);
    } catch {
      // Try the next syntax accepted by source extraction.
    }
  }
  return undefined;
}

type TemplateBindingType =
  | 'setup-const'
  | 'setup-reactive-const'
  | 'literal-const'
  | 'setup-let'
  | 'setup-ref'
  | 'setup-maybe-ref'
  | 'props';

type TemplateBinding = {
  owner: t.Program;
  type: TemplateBindingType;
};

const TEMPLATE_BINDING_RESOLUTION_ORDER: readonly TemplateBindingType[] = [
  'setup-const',
  'setup-reactive-const',
  'literal-const',
  'setup-let',
  'setup-ref',
  'setup-maybe-ref',
  'props',
];

/**
 * Reproduces the binding metadata needed by Vue's component-tag resolver.
 *
 * Project detection cannot load a consumer's Vue compiler before ownership is
 * proven. This self-contained model lets the detector choose one setup binding
 * with Vue's type and spelling precedence without introducing a compiler
 * dependency into the lightweight entrypoint. Where supported Vue versions or
 * compiler options differ, the stronger local binding wins so ambiguous source
 * cannot activate Vue in an existing non-Vue project.
 */
function readTemplateBindingMetadata(
  blocks: readonly ParsedConsumerScriptBlock[]
): Map<string, TemplateBinding> {
  const bindings = new Map<string, TemplateBinding>();
  const normalBlocks = blocks.filter(({ setup }) => !setup);
  const setupBlocks = blocks.filter(({ setup }) => setup);
  const vueImportAliases = new Map<string, string>();

  for (const block of [...normalBlocks, ...setupBlocks]) {
    if (!block.ast) continue;
    registerTemplateImportBindings(block.ast, bindings, vueImportAliases);
  }
  for (const block of normalBlocks) {
    if (!block.ast) continue;
    registerOptionsApiSetupBindings(block.ast, bindings);
  }
  for (const block of normalBlocks) {
    if (!block.ast) continue;
    registerTemplateDeclarationBindings(
      block.ast,
      bindings,
      vueImportAliases,
      'script',
      true
    );
  }
  for (const block of setupBlocks) {
    if (!block.ast) continue;
    registerTemplateDeclarationBindings(
      block.ast,
      bindings,
      vueImportAliases,
      'script-setup',
      normalBlocks.length === 0
    );
  }
  return bindings;
}

/** Adds statically named Options API setup-return bindings used by templates. */
function registerOptionsApiSetupBindings(
  ast: t.File,
  bindings: Map<string, TemplateBinding>
): void {
  for (const statement of ast.program.body) {
    if (
      statement.type !== 'ExportDefaultDeclaration' ||
      statement.declaration.type !== 'ObjectExpression'
    ) {
      continue;
    }
    for (const property of statement.declaration.properties) {
      if (
        property.type !== 'ObjectMethod' ||
        property.computed ||
        property.key.type !== 'Identifier' ||
        property.key.name !== 'setup'
      ) {
        continue;
      }
      for (const bodyItem of property.body.body) {
        if (
          bodyItem.type !== 'ReturnStatement' ||
          bodyItem.argument?.type !== 'ObjectExpression'
        ) {
          continue;
        }
        for (const returnedProperty of bodyItem.argument.properties) {
          if (returnedProperty.type === 'SpreadElement') continue;
          const name = readStaticObjectKey(returnedProperty);
          if (name && !bindings.has(name)) {
            setTemplateBinding(bindings, name, 'setup-maybe-ref', ast.program);
          }
        }
      }
    }
  }
}

/** Mirrors compiler-sfc's static Options API object-key resolution. */
function readStaticObjectKey(
  property: t.ObjectMethod | t.ObjectProperty
): string | undefined {
  const key = property.key;
  if (key.type === 'Identifier' && !property.computed) return key.name;
  if (key.type === 'StringLiteral' || key.type === 'NumericLiteral') {
    return String(key.value);
  }
  if (key.type === 'TemplateLiteral' && key.expressions.length === 0) {
    return key.quasis.map((quasi) => quasi.value.cooked ?? '').join('');
  }
  return undefined;
}

function registerTemplateImportBindings(
  ast: t.File,
  bindings: Map<string, TemplateBinding>,
  vueImportAliases: Map<string, string>
): void {
  for (const statement of ast.program.body) {
    if (
      statement.type !== 'ImportDeclaration' ||
      statement.importKind === 'type' ||
      statement.importKind === 'typeof'
    ) {
      continue;
    }
    const source = statement.source.value;
    for (const specifier of statement.specifiers) {
      if (
        specifier.type === 'ImportSpecifier' &&
        (specifier.importKind === 'type' || specifier.importKind === 'typeof')
      ) {
        continue;
      }
      const imported =
        specifier.type === 'ImportDefaultSpecifier'
          ? 'default'
          : specifier.type === 'ImportNamespaceSpecifier'
            ? '*'
            : readModuleName(specifier.imported);
      if (source === 'vue') {
        vueImportAliases.set(imported, specifier.local.name);
      }
      if (!bindings.has(specifier.local.name)) {
        setTemplateBinding(
          bindings,
          specifier.local.name,
          imported === '*' ||
            (imported === 'default' && source.endsWith('.vue')) ||
            source === 'vue'
            ? 'setup-const'
            : 'setup-maybe-ref',
          ast.program
        );
      }
    }
  }
}

/** Adds script declarations after imports in compiler-sfc's merge order. */
function registerTemplateDeclarationBindings(
  ast: t.File,
  bindings: Map<string, TemplateBinding>,
  vueImportAliases: ReadonlyMap<string, string>,
  source: 'script' | 'script-setup',
  hoistStatic: boolean
): void {
  for (const statement of ast.program.body) {
    const declaration =
      statement.type === 'ExportNamedDeclaration' && statement.declaration
        ? statement.declaration
        : statement;
    if (
      (declaration.type === 'VariableDeclaration' ||
        declaration.type === 'FunctionDeclaration' ||
        declaration.type === 'ClassDeclaration' ||
        declaration.type === 'TSEnumDeclaration') &&
      !declaration.declare
    ) {
      walkTemplateDeclaration(
        declaration,
        bindings,
        vueImportAliases,
        ast.program,
        source,
        hoistStatic
      );
    }
  }
}

type TemplateDeclaration =
  | t.VariableDeclaration
  | t.FunctionDeclaration
  | t.ClassDeclaration
  | t.TSEnumDeclaration;

/** Mirrors compiler-sfc's binding-type analysis used by component lookup. */
function walkTemplateDeclaration(
  declaration: TemplateDeclaration,
  bindings: Map<string, TemplateBinding>,
  vueImportAliases: ReadonlyMap<string, string>,
  owner: t.Program,
  source: 'script' | 'script-setup',
  hoistStatic: boolean
): void {
  if (declaration.type === 'VariableDeclaration') {
    const isConst = declaration.kind === 'const';
    const isAllLiteral =
      isConst &&
      declaration.declarations.every(
        ({ id, init }) =>
          id.type === 'Identifier' && isStaticTemplateBinding(init)
      );
    for (const { id, init: wrappedInitializer } of declaration.declarations) {
      const initializer = unwrapTemplateBindingExpression(wrappedInitializer);
      const isConstMacroCall =
        isConst &&
        isTemplateCallOf(initializer, [
          'defineProps',
          'defineEmits',
          'defineSlots',
          'withDefaults',
        ]);
      if (id.type === 'Identifier') {
        let type: TemplateBindingType;
        const reactiveImport = vueImportAliases.get('reactive');
        if (
          (hoistStatic || source === 'script') &&
          (isAllLiteral || (isConst && isStaticTemplateBinding(initializer)))
        ) {
          type = 'literal-const';
        } else if (isTemplateCallOf(initializer, reactiveImport)) {
          type = isConst ? 'setup-reactive-const' : 'setup-let';
        } else if (
          isConstMacroCall ||
          (isConst && canNeverBeTemplateRef(initializer, reactiveImport))
        ) {
          type = isTemplateCallOf(initializer, 'defineProps')
            ? 'setup-reactive-const'
            : 'setup-const';
        } else if (isConst) {
          type = isTemplateCallOf(initializer, [
            vueImportAliases.get('ref'),
            vueImportAliases.get('computed'),
            vueImportAliases.get('shallowRef'),
            vueImportAliases.get('customRef'),
            vueImportAliases.get('toRef'),
            vueImportAliases.get('useTemplateRef'),
            'defineModel',
          ])
            ? 'setup-ref'
            : 'setup-maybe-ref';
        } else {
          type = 'setup-let';
        }
        setTemplateBinding(bindings, id.name, type, owner);
        continue;
      }
      if (
        id.type === 'ObjectPattern' &&
        isTemplateCallOf(initializer, 'defineProps')
      ) {
        registerTemplatePropsDestructure(id, bindings, owner);
      } else {
        walkTemplateBindingPattern(
          id,
          bindings,
          owner,
          isConst,
          isConstMacroCall
        );
      }
    }
    return;
  }
  if (declaration.type === 'TSEnumDeclaration') {
    const isAllLiteral = declaration.members.every(
      ({ initializer }) => !initializer || isStaticTemplateBinding(initializer)
    );
    setTemplateBinding(
      bindings,
      declaration.id.name,
      isAllLiteral ? 'literal-const' : 'setup-const',
      owner
    );
    return;
  }
  if (declaration.id) {
    setTemplateBinding(bindings, declaration.id.name, 'setup-const', owner);
  }
}

/**
 * Registers the conservative union of reactive and legacy prop destructuring.
 *
 * Vue 3.3/3.5 and `propsDestructure: false` disagree about these local binding
 * types. Compiler configuration cannot be loaded safely before Vue ownership
 * is established, so a local destructure takes the strongest possible type.
 * This may defer an ambiguous wrapper-only project, but it cannot make that
 * ambiguity poison an otherwise valid React extraction.
 */
function registerTemplatePropsDestructure(
  pattern: t.ObjectPattern,
  bindings: Map<string, TemplateBinding>,
  owner: t.Program
): void {
  for (const property of pattern.properties) {
    if (property.type === 'RestElement') {
      for (const identifier of Object.values(
        t.getBindingIdentifiers(property.argument)
      )) {
        setTemplateBinding(
          bindings,
          identifier.name,
          'setup-reactive-const',
          owner
        );
      }
      continue;
    }
    const publicName = readStaticPatternPropertyName(property);
    if (!publicName) continue;
    setTemplateBinding(bindings, publicName, 'props', owner);
    const value =
      property.value.type === 'AssignmentPattern'
        ? property.value.left
        : property.value;
    if (value.type === 'Identifier') {
      setTemplateBinding(bindings, value.name, 'setup-const', owner);
    }
  }
}

function readStaticPatternPropertyName(
  property: t.ObjectProperty
): string | undefined {
  if (property.computed) return undefined;
  if (property.key.type === 'Identifier') return property.key.name;
  if (
    property.key.type === 'StringLiteral' ||
    property.key.type === 'NumericLiteral'
  ) {
    return String(property.key.value);
  }
  return undefined;
}

function walkTemplateBindingPattern(
  pattern: t.VariableDeclarator['id'],
  bindings: Map<string, TemplateBinding>,
  owner: t.Program,
  isConst: boolean,
  isDefineCall = false
): void {
  if (pattern.type === 'ObjectPattern') {
    for (const property of pattern.properties) {
      if (property.type === 'RestElement') {
        registerTemplatePatternIdentifiers(
          property.argument,
          bindings,
          owner,
          isConst ? 'setup-const' : 'setup-let'
        );
      } else if (
        property.key.type === 'Identifier' &&
        property.shorthand &&
        property.value.type === 'Identifier'
      ) {
        setTemplateBinding(
          bindings,
          property.value.name,
          isDefineCall
            ? 'setup-const'
            : isConst
              ? 'setup-maybe-ref'
              : 'setup-let',
          owner
        );
      } else {
        walkTemplatePattern(
          property.value,
          bindings,
          owner,
          isConst,
          isDefineCall
        );
      }
    }
    return;
  }
  if (pattern.type === 'ArrayPattern') {
    for (const element of pattern.elements) {
      if (element) {
        walkTemplatePattern(element, bindings, owner, isConst, isDefineCall);
      }
    }
  }
}

/** Applies compiler-sfc's recursive destructuring binding classification. */
function walkTemplatePattern(
  pattern: t.Node,
  bindings: Map<string, TemplateBinding>,
  owner: t.Program,
  isConst: boolean,
  isDefineCall = false
): void {
  if (pattern.type === 'Identifier') {
    setTemplateBinding(
      bindings,
      pattern.name,
      isDefineCall ? 'setup-const' : isConst ? 'setup-maybe-ref' : 'setup-let',
      owner
    );
  } else if (pattern.type === 'RestElement') {
    registerTemplatePatternIdentifiers(
      pattern.argument,
      bindings,
      owner,
      isConst ? 'setup-const' : 'setup-let'
    );
  } else if (
    pattern.type === 'ObjectPattern' ||
    pattern.type === 'ArrayPattern'
  ) {
    walkTemplateBindingPattern(pattern, bindings, owner, isConst);
  } else if (pattern.type === 'AssignmentPattern') {
    walkTemplatePattern(pattern.left, bindings, owner, isConst, isDefineCall);
  }
}

function registerTemplatePatternIdentifiers(
  pattern: t.LVal,
  bindings: Map<string, TemplateBinding>,
  owner: t.Program,
  type: TemplateBindingType
): void {
  for (const identifier of Object.values(t.getBindingIdentifiers(pattern))) {
    setTemplateBinding(bindings, identifier.name, type, owner);
  }
}

function setTemplateBinding(
  bindings: Map<string, TemplateBinding>,
  name: string,
  type: TemplateBindingType,
  owner: t.Program
): void {
  bindings.set(name, { owner, type });
}

function unwrapTemplateBindingExpression(
  input: t.Node | null | undefined
): t.Node | undefined {
  let current = input ?? undefined;
  while (
    current &&
    (current.type === 'TSAsExpression' ||
      current.type === 'TSTypeAssertion' ||
      current.type === 'TSNonNullExpression' ||
      current.type === 'TSSatisfiesExpression' ||
      current.type === 'TSInstantiationExpression' ||
      current.type === 'TypeCastExpression' ||
      current.type === 'ParenthesizedExpression')
  ) {
    current = current.expression;
  }
  return current;
}

/** Matches direct compiler macros and locally aliased Vue helper calls. */
function isTemplateCallOf(
  node: t.Node | null | undefined,
  names: string | readonly (string | undefined)[] | undefined
): boolean {
  if (!node || !names || node.type !== 'CallExpression') return false;
  const callee = unwrapTemplateBindingExpression(node.callee);
  if (callee?.type !== 'Identifier') return false;
  return typeof names === 'string'
    ? callee.name === names
    : names.some((name) => Boolean(name) && name === callee.name);
}

/** Returns whether compiler-sfc can prove that a value will never be a ref. */
function canNeverBeTemplateRef(
  node: t.Node | null | undefined,
  reactiveImport: string | undefined
): boolean {
  const expression = unwrapTemplateBindingExpression(node);
  if (!expression) return false;
  if (isTemplateCallOf(expression, reactiveImport)) return true;
  if (
    expression.type === 'UnaryExpression' ||
    expression.type === 'BinaryExpression' ||
    expression.type === 'ArrayExpression' ||
    expression.type === 'ObjectExpression' ||
    expression.type === 'FunctionExpression' ||
    expression.type === 'ArrowFunctionExpression' ||
    expression.type === 'UpdateExpression' ||
    expression.type === 'ClassExpression' ||
    expression.type === 'TaggedTemplateExpression'
  ) {
    return true;
  }
  if (expression.type === 'SequenceExpression') {
    return canNeverBeTemplateRef(expression.expressions.at(-1), reactiveImport);
  }
  return expression.type.endsWith('Literal');
}

/** Reproduces compiler-sfc's static-expression predicate for hoisted bindings. */
function isStaticTemplateBinding(node: t.Node | null | undefined): boolean {
  const expression = unwrapTemplateBindingExpression(node);
  if (!expression) return false;
  if (expression.type === 'UnaryExpression') {
    return isStaticTemplateBinding(expression.argument);
  }
  if (
    expression.type === 'LogicalExpression' ||
    expression.type === 'BinaryExpression'
  ) {
    return (
      isStaticTemplateBinding(expression.left) &&
      isStaticTemplateBinding(expression.right)
    );
  }
  if (expression.type === 'ConditionalExpression') {
    return (
      isStaticTemplateBinding(expression.test) &&
      isStaticTemplateBinding(expression.consequent) &&
      isStaticTemplateBinding(expression.alternate)
    );
  }
  if (
    expression.type === 'SequenceExpression' ||
    expression.type === 'TemplateLiteral'
  ) {
    return expression.expressions.every(isStaticTemplateBinding);
  }
  return (
    expression.type === 'StringLiteral' ||
    expression.type === 'NumericLiteral' ||
    expression.type === 'BooleanLiteral' ||
    expression.type === 'NullLiteral' ||
    expression.type === 'BigIntLiteral'
  );
}

type StaticImportUsageOptions = {
  externalUsage?: TemplateUsage;
  scriptSetup?: boolean;
  templateBindings?: ReadonlyMap<string, TemplateBinding>;
  templateSource?: string;
};

function collectStaticImports(
  ast: t.File,
  options: StaticImportUsageOptions = {}
): ConsumerImport[] {
  let programScope: Scope | undefined;
  traverse(ast, {
    Program(programPath) {
      programScope = programPath.scope;
      programPath.stop();
    },
  });
  if (!programScope) return [];
  const templateUsage =
    options.templateSource && options.templateBindings
      ? readTemplateUsage(options.templateSource, options.templateBindings)
      : undefined;
  const runtimeUsages = [templateUsage, options.externalUsage].filter(
    (usage): usage is TemplateUsage => Boolean(usage)
  );

  const imports: ConsumerImport[] = [];
  for (const statement of ast.program.body) {
    if (
      statement.type === 'ImportDeclaration' &&
      statement.importKind !== 'type' &&
      statement.importKind !== 'typeof'
    ) {
      const importedNames = new Set<string>();
      for (const specifier of statement.specifiers) {
        if (specifier.type === 'ImportDefaultSpecifier') {
          if (
            bindingHasRuntimeUsage(
              programScope,
              specifier.local.name,
              runtimeUsages,
              ast.program,
              options.scriptSetup
            )
          ) {
            importedNames.add('default');
          }
        } else if (specifier.type === 'ImportNamespaceSpecifier') {
          for (const name of readUsedNamespaceMembers(
            programScope,
            specifier.local.name,
            runtimeUsages,
            ast.program
          )) {
            importedNames.add(name);
          }
        } else if (
          specifier.importKind !== 'type' &&
          specifier.importKind !== 'typeof' &&
          bindingHasRuntimeUsage(
            programScope,
            specifier.local.name,
            runtimeUsages,
            ast.program,
            options.scriptSetup
          )
        ) {
          importedNames.add(readModuleName(specifier.imported));
        }
      }
      if (importedNames.size > 0) {
        imports.push({ importedNames, source: statement.source.value });
      }
      continue;
    }

    if (
      statement.type === 'ExportAllDeclaration' &&
      statement.exportKind !== 'type'
    ) {
      imports.push({ importedNames: '*', source: statement.source.value });
      continue;
    }

    if (
      statement.type !== 'ExportNamedDeclaration' ||
      statement.exportKind === 'type' ||
      !statement.source
    ) {
      continue;
    }
    const importedNames = new Set<string>();
    for (const specifier of statement.specifiers) {
      if (
        specifier.type === 'ExportSpecifier' &&
        specifier.exportKind !== 'type'
      ) {
        importedNames.add(readModuleName(specifier.local));
      }
    }
    if (importedNames.size > 0) {
      imports.push({
        importedNames,
        source: statement.source.value,
      });
    }
  }
  return imports;
}

function readModuleName(node: t.Identifier | t.StringLiteral): string {
  return node.type === 'Identifier' ? node.name : node.value;
}

/** Requires a named/default import to participate in executable source. */
function bindingHasRuntimeUsage(
  scope: Scope,
  localName: string,
  runtimeUsages: readonly TemplateUsage[],
  owner: t.Program,
  scriptSetup = false
): boolean {
  const binding = scope.getBinding(localName);
  return Boolean(
    binding?.referencePaths.some(
      (reference) =>
        !isTypeOnlyReference(reference) &&
        !(scriptSetup && isCompilerConsumedSetupMacroReference(reference))
    ) ||
    runtimeUsages.some((usage) =>
      templateUsageMatchesBinding(usage, localName, owner)
    )
  );
}

const VALUE_SETUP_COMPILER_MACROS = new Set([
  'defineEmits',
  'defineProps',
  'defineSlots',
  'withDefaults',
]);

const EXPRESSION_SETUP_COMPILER_MACROS = new Set([
  ...VALUE_SETUP_COMPILER_MACROS,
  'defineExpose',
  'defineOptions',
]);

/**
 * Returns whether compiler-sfc removes this setup-only macro reference.
 *
 * Vue 3.3 and 3.5 agree on these direct top-level forms. `defineModel` is
 * deliberately absent because Vue 3.3 only consumes it behind an experimental
 * option, and nested calls remain ordinary runtime JavaScript in both lines.
 */
function isCompilerConsumedSetupMacroReference(
  reference: NodePath<t.Node>
): boolean {
  if (reference.node.type !== 'Identifier') return false;
  const macro = reference.node.name;
  if (!EXPRESSION_SETUP_COMPILER_MACROS.has(macro)) return false;
  const call = reference.parentPath;
  if (!call?.isCallExpression() || call.node.callee !== reference.node) {
    return false;
  }

  let consumedCall = call;
  if (macro === 'defineProps') {
    const parentCall = call.parentPath;
    if (
      parentCall?.isCallExpression() &&
      parentCall.node.arguments[0] === call.node &&
      parentCall.node.callee.type === 'Identifier' &&
      parentCall.node.callee.name === 'withDefaults'
    ) {
      consumedCall = parentCall;
    }
  }

  const parent = consumedCall.parentPath;
  if (parent?.isExpressionStatement() && parent.parentPath?.isProgram()) {
    return true;
  }
  return Boolean(
    VALUE_SETUP_COMPILER_MACROS.has(macro) &&
    parent?.isVariableDeclarator() &&
    parent.node.init === consumedCall.node &&
    parent.parentPath?.isVariableDeclaration() &&
    parent.parentPath.parentPath?.isProgram()
  );
}

function isTypeOnlyReference(reference: NodePath<t.Node>): boolean {
  if (
    reference.findParent(
      (parent) => t.isTSType(parent.node) || t.isFlow(parent.node)
    )
  ) {
    return true;
  }
  const exportSpecifier = reference.findParent((parent) =>
    parent.isExportSpecifier()
  );
  return Boolean(
    exportSpecifier?.isExportSpecifier() &&
    (exportSpecifier.node.exportKind === 'type' ||
      (exportSpecifier.parentPath?.isExportNamedDeclaration() &&
        exportSpecifier.parentPath.node.exportKind === 'type'))
  );
}

/** Returns only statically named namespace members used by source or template. */
function readUsedNamespaceMembers(
  scope: Scope,
  localName: string,
  runtimeUsages: readonly TemplateUsage[],
  owner: t.Program
): Set<string> {
  const names = new Set<string>();
  const bindings = new Set<Binding>();
  const collectImmutableAliases = (binding: Binding | undefined): void => {
    if (!binding?.constant || bindings.has(binding)) return;
    bindings.add(binding);
    for (const reference of binding.referencePaths) {
      const declarator = reference.parentPath;
      if (
        !declarator?.isVariableDeclarator() ||
        declarator.node.init !== reference.node ||
        declarator.node.id.type !== 'Identifier' ||
        !declarator.parentPath?.isVariableDeclaration() ||
        declarator.parentPath.node.kind !== 'const'
      ) {
        continue;
      }
      const alias = declarator.scope.getBinding(declarator.node.id.name);
      if (alias?.path.node === declarator.node) collectImmutableAliases(alias);
    }
  };
  collectImmutableAliases(scope.getBinding(localName));

  const writtenMembers = new Set<string>();
  for (const binding of bindings) {
    for (const reference of binding.referencePaths) {
      const member = readNamespaceMemberPath(reference);
      if (!member) continue;
      const name = readStaticPropertyName(member.node);
      if (name && isMemberWrite(member)) writtenMembers.add(name);
    }
  }

  const templateNames = new Set<string>();
  for (const binding of bindings) {
    if (binding.scope === scope) templateNames.add(binding.identifier.name);
    for (const reference of binding.referencePaths) {
      const member = readNamespaceMemberPath(reference);
      if (member) {
        const name = readStaticPropertyName(member.node);
        if (name && !writtenMembers.has(name)) names.add(name);
        continue;
      }
      const jsxMember = reference.parentPath;
      if (
        jsxMember?.isJSXMemberExpression() &&
        jsxMember.node.object === reference.node &&
        jsxMember.node.property.type === 'JSXIdentifier' &&
        !writtenMembers.has(jsxMember.node.property.name)
      ) {
        names.add(jsxMember.node.property.name);
        continue;
      }
      const parent = reference.parent;
      if (
        parent?.type !== 'VariableDeclarator' ||
        parent.init !== reference.node ||
        parent.id.type !== 'ObjectPattern'
      ) {
        continue;
      }
      for (const property of parent.id.properties) {
        if (property.type !== 'ObjectProperty' || property.computed) continue;
        const name =
          property.key.type === 'Identifier'
            ? property.key.name
            : property.key.type === 'StringLiteral'
              ? property.key.value
              : undefined;
        if (name && !writtenMembers.has(name)) names.add(name);
      }
    }
  }
  for (const runtimeUsage of runtimeUsages) {
    for (const templateName of templateNames) {
      if (!templateUsageMatchesBinding(runtimeUsage, templateName, owner)) {
        continue;
      }
      for (const name of runtimeUsage.namespaceMembers.get(templateName) ??
        []) {
        if (!writtenMembers.has(name)) names.add(name);
      }
    }
  }
  return names;
}

function readNamespaceMemberPath(
  reference: NodePath<t.Node>
): NodePath<t.MemberExpression | t.OptionalMemberExpression> | undefined {
  const member = reference.parentPath;
  if (
    (member?.isMemberExpression() || member?.isOptionalMemberExpression()) &&
    member.node.object === reference.node
  ) {
    return member;
  }
  return undefined;
}

function isMemberWrite(
  member: NodePath<t.MemberExpression | t.OptionalMemberExpression>
): boolean {
  const parent = member.parentPath?.node;
  return Boolean(
    (parent?.type === 'AssignmentExpression' && parent.left === member.node) ||
    (parent?.type === 'UpdateExpression' && parent.argument === member.node) ||
    (parent?.type === 'UnaryExpression' &&
      parent.operator === 'delete' &&
      parent.argument === member.node) ||
    ((parent?.type === 'ForInStatement' || parent?.type === 'ForOfStatement') &&
      parent.left === member.node)
  );
}

type TemplateUsage = {
  bindingOwners?: ReadonlyMap<string, t.Program>;
  identifiers: Set<string>;
  namespaceMembers: Map<string, Set<string>>;
};

function createTemplateUsage(
  bindingOwners?: ReadonlyMap<string, t.Program>
): TemplateUsage {
  return {
    bindingOwners,
    identifiers: new Set(),
    namespaceMembers: new Map(),
  };
}

function templateUsageMatchesBinding(
  usage: TemplateUsage,
  name: string,
  owner: t.Program
): boolean {
  if (!usage.identifiers.has(name)) return false;
  const expectedOwner = usage.bindingOwners?.get(name);
  return !expectedOwner || expectedOwner === owner;
}

const VUE_CORE_COMPONENT_TEMPLATE_TAGS = new Set([
  'BaseTransition',
  'KeepAlive',
  'Suspense',
  'Teleport',
  'Transition',
  'TransitionGroup',
  'base-transition',
  'keep-alive',
  'suspense',
  'teleport',
  'transition',
  'transition-group',
]);

const VUE_BUILTIN_TEMPLATE_TAGS = new Set([
  ...VUE_CORE_COMPONENT_TEMPLATE_TAGS,
  'slot',
  'template',
]);

const VUE_RAW_TEXT_TEMPLATE_TAGS = new Set(['script', 'style']);

const VUE_RCDATA_TEMPLATE_TAGS = new Set(['textarea', 'title']);

const VUE_VOID_TEMPLATE_TAGS = new Set(
  'area,base,br,col,embed,hr,img,input,link,meta,param,source,track,wbr'.split(
    ','
  )
);

/**
 * Native platform tags recognized by Vue templates.
 *
 * Detection deliberately keeps this list local instead of importing
 * `@vue/shared`: `/detect` runs for every CLI extraction and must not load a
 * Vue runtime dependency before a project has proven Vue ownership.
 */
const VUE_NATIVE_TEMPLATE_TAGS = new Set(
  (
    'html,body,base,head,link,meta,style,title,address,article,aside,footer,' +
    'header,hgroup,h1,h2,h3,h4,h5,h6,nav,section,div,dd,dl,dt,figcaption,' +
    'figure,picture,hr,img,li,main,ol,p,pre,ul,a,b,abbr,bdi,bdo,br,cite,' +
    'code,data,dfn,em,i,kbd,mark,q,rp,rt,ruby,s,samp,small,span,strong,sub,' +
    'sup,time,u,var,wbr,area,audio,map,track,video,embed,object,param,source,' +
    'canvas,script,noscript,del,ins,caption,col,colgroup,table,thead,tbody,td,' +
    'th,tr,button,datalist,fieldset,form,input,label,legend,meter,optgroup,' +
    'option,output,progress,select,textarea,details,dialog,menu,summary,' +
    'template,blockquote,iframe,tfoot,svg,animate,animateMotion,' +
    'animateTransform,circle,clipPath,color-profile,defs,desc,discard,ellipse,' +
    'feBlend,feColorMatrix,feComponentTransfer,feComposite,feConvolveMatrix,' +
    'feDiffuseLighting,feDisplacementMap,feDistantLight,feDropShadow,' +
    'feFlood,feFuncA,feFuncB,feFuncG,feFuncR,feGaussianBlur,feImage,' +
    'feMerge,feMergeNode,feMorphology,feOffset,fePointLight,' +
    'feSpecularLighting,feSpotLight,feTile,feTurbulence,filter,foreignObject,' +
    'g,hatch,hatchpath,image,line,linearGradient,marker,mask,mesh,' +
    'meshgradient,meshpatch,meshrow,metadata,mpath,path,pattern,polygon,' +
    'polyline,radialGradient,rect,set,solidcolor,stop,switch,symbol,text,' +
    'textPath,tspan,unknown,use,view,annotation,annotation-xml,maction,' +
    'maligngroup,malignmark,math,menclose,merror,mfenced,mfrac,mfraction,' +
    'mglyph,mi,mlabeledtr,mlongdiv,mmultiscripts,mn,mo,mover,mpadded,' +
    'mphantom,mprescripts,mroot,mrow,ms,mscarries,mscarry,msgroup,msline,' +
    'mspace,msqrt,msrow,mstack,mstyle,msub,msubsup,msup,mtable,mtd,mtext,' +
    'mtr,munder,munderover,none,semantics'
  ).split(',')
);

/** Parses component tags and executable expressions without raw-text guesses. */
function readTemplateUsage(
  templateSource: string,
  scriptBindings: ReadonlyMap<string, TemplateBinding>
): TemplateUsage {
  const usage = createTemplateUsage(
    new Map([...scriptBindings].map(([name, binding]) => [name, binding.owner]))
  );
  const activeBindings = new Map<string, number>();
  const elementStack: TemplateElementScope[] = [];
  let vPreDepth = 0;
  let index = 0;
  while (index < templateSource.length) {
    if (templateSource.startsWith('<!--', index)) {
      index = readHtmlCommentEnd(templateSource, index);
      continue;
    }
    if (templateSource.startsWith('{{', index)) {
      if (vPreDepth > 0) {
        index += 2;
        continue;
      }
      const interpolation = readTemplateInterpolation(templateSource, index);
      if (interpolation.ast) {
        collectTemplateAstUsage(interpolation.ast, usage, activeBindings);
      }
      index = interpolation.end;
      continue;
    }
    if (templateSource[index] !== '<') {
      index += 1;
      continue;
    }
    const tag = readTemplateMarkupTag(templateSource, index);
    if (!tag) {
      index += 1;
      continue;
    }
    const normalizedTagName = tag.name.toLowerCase();
    if (tag.closing) {
      vPreDepth = Math.max(
        0,
        vPreDepth -
          closeTemplateElementScope(
            normalizedTagName,
            elementStack,
            activeBindings
          )
      );
      index = tag.end;
      continue;
    }
    const attributes = readTemplateAttributes(tag.attributes);
    const introducesVPre = attributes.some(({ name }) =>
      isTemplateVPreDirective(name)
    );
    const suppressUsage = vPreDepth > 0 || introducesVPre;
    let descendantBindings = new Set<string>();
    if (!suppressUsage) {
      const directiveUsage = collectTemplateDirectiveUsage(
        attributes,
        usage,
        activeBindings
      );
      descendantBindings = directiveUsage.descendantBindings;
      const elementBindings = new Map(activeBindings);
      for (const binding of directiveUsage.elementBindings) {
        elementBindings.set(binding, (elementBindings.get(binding) ?? 0) + 1);
      }
      recordTemplateTagUsage(
        tag.name,
        usage,
        elementBindings,
        attributes,
        scriptBindings
      );
    }
    const rawTextClosingTag =
      !tag.selfClosing && VUE_RAW_TEXT_TEMPLATE_TAGS.has(tag.name)
        ? findRawBlockClosingTag(templateSource, tag.name, tag.end)
        : undefined;
    if (rawTextClosingTag) {
      index = rawTextClosingTag.end;
      continue;
    }
    const rcdataClosingTag =
      !tag.selfClosing && VUE_RCDATA_TEMPLATE_TAGS.has(tag.name)
        ? findRawBlockClosingTag(templateSource, tag.name, tag.end)
        : undefined;
    if (rcdataClosingTag) {
      if (!suppressUsage) {
        const rcdataBindings = new Map(activeBindings);
        for (const binding of descendantBindings) {
          rcdataBindings.set(binding, (rcdataBindings.get(binding) ?? 0) + 1);
        }
        collectTemplateRcdataUsage(
          templateSource.slice(tag.end, rcdataClosingTag.start),
          usage,
          rcdataBindings
        );
      }
      index = rcdataClosingTag.end;
      continue;
    }
    if (!tag.selfClosing && !VUE_VOID_TEMPLATE_TAGS.has(tag.name)) {
      elementStack.push({
        bindings: descendantBindings,
        name: normalizedTagName,
        vPre: introducesVPre,
      });
      for (const binding of descendantBindings) {
        activeBindings.set(binding, (activeBindings.get(binding) ?? 0) + 1);
      }
      if (introducesVPre) vPreDepth += 1;
    }
    index = tag.end;
  }
  return usage;
}

type TemplateElementScope = {
  bindings: Set<string>;
  name: string;
  vPre: boolean;
};

function closeTemplateElementScope(
  name: string,
  elementStack: TemplateElementScope[],
  activeBindings: Map<string, number>
): number {
  let matchingIndex = -1;
  for (let index = elementStack.length - 1; index >= 0; index -= 1) {
    if (elementStack[index]?.name === name) {
      matchingIndex = index;
      break;
    }
  }
  if (matchingIndex < 0) return 0;
  let closedVPreScopes = 0;
  while (elementStack.length > matchingIndex) {
    const element = elementStack.pop()!;
    if (element.vPre) closedVPreScopes += 1;
    for (const binding of element.bindings) {
      const remaining = (activeBindings.get(binding) ?? 1) - 1;
      if (remaining > 0) activeBindings.set(binding, remaining);
      else activeBindings.delete(binding);
    }
  }
  return closedVPreScopes;
}

/** Records executable Vue interpolations while keeping RCDATA tags opaque. */
function collectTemplateRcdataUsage(
  source: string,
  usage: TemplateUsage,
  shadowedBindings: ReadonlyMap<string, number>
): void {
  let index = source.indexOf('{{');
  while (index >= 0) {
    const interpolation = readTemplateInterpolation(source, index);
    if (interpolation.ast) {
      collectTemplateAstUsage(interpolation.ast, usage, shadowedBindings);
    }
    if (interpolation.end >= source.length) return;
    index = source.indexOf('{{', interpolation.end);
  }
}

type TemplateMarkupTag = {
  attributes: string;
  closing: boolean;
  end: number;
  name: string;
  selfClosing: boolean;
};

/** Reads one real template tag while keeping quoted attribute data opaque. */
function readTemplateMarkupTag(
  source: string,
  start: number
): TemplateMarkupTag | undefined {
  if (source[start] !== '<' || source.startsWith('<!--', start)) {
    return undefined;
  }
  let cursor = start + 1;
  const closing = source[cursor] === '/';
  if (closing) cursor += 1;
  const nameStart = cursor;
  while (cursor < source.length && /[A-Za-z0-9_$.:?-]/.test(source[cursor]!)) {
    cursor += 1;
  }
  if (cursor === nameStart || !/[A-Za-z_$]/.test(source[nameStart]!)) {
    return undefined;
  }
  const name = source.slice(nameStart, cursor);
  const attributesStart = cursor;
  let quote: string | undefined;
  while (cursor < source.length) {
    const character = source[cursor]!;
    if (quote) {
      if (character === quote) quote = undefined;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '>') {
      return {
        attributes: source.slice(attributesStart, cursor),
        closing,
        end: cursor + 1,
        name,
        selfClosing:
          !closing && /\/\s*$/.test(source.slice(attributesStart, cursor)),
      };
    }
    cursor += 1;
  }
  return undefined;
}

function recordTemplateTagUsage(
  sourceTag: string,
  usage: TemplateUsage,
  shadowedBindings: ReadonlyMap<string, number>,
  attributes: readonly TemplateAttribute[],
  scriptBindings: ReadonlyMap<string, TemplateBinding>
): void {
  if (isDynamicComponentTag(sourceTag, attributes)) return;
  const valuedVIs = readValuedVIsDirective(attributes);
  if (valuedVIs) {
    recordVersionStableVIsUsage(
      sourceTag,
      valuedVIs,
      usage,
      shadowedBindings,
      attributes,
      scriptBindings
    );
    return;
  }

  const staticVueIsTarget = readStaticVueIsTarget(attributes);
  let tag = sourceTag;
  if (staticVueIsTarget !== undefined) {
    if (!hasStableStaticVueIsSemantics(sourceTag)) return;
    tag = staticVueIsTarget;
  }
  const member = /^([A-Za-z_$][\w$-]*)\.([A-Za-z_$][\w$]*)$/.exec(tag);
  if (member?.[1] && member[2]) {
    const namespace = resolveTemplateTagBinding(
      member[1],
      shadowedBindings,
      scriptBindings
    );
    if (namespace) {
      usage.identifiers.add(namespace);
      addTemplateNamespaceMember(usage, namespace, member[2]);
    }
    return;
  }
  if (
    staticVueIsTarget !== undefined
      ? VUE_CORE_COMPONENT_TEMPLATE_TAGS.has(tag)
      : VUE_BUILTIN_TEMPLATE_TAGS.has(tag) || VUE_NATIVE_TEMPLATE_TAGS.has(tag)
  ) {
    return;
  }
  const name = resolveTemplateTagBinding(tag, shadowedBindings, scriptBindings);
  if (name) usage.identifiers.add(name);
}

/** Reads the component target of Vue's static `is="vue:..."` syntax. */
function readStaticVueIsTarget(
  attributes: readonly TemplateAttribute[]
): string | undefined {
  const value = attributes.find(({ name }) => name === 'is')?.value;
  return value?.startsWith('vue:') ? value.slice(4) : undefined;
}

/**
 * Limits static `vue:` rewriting to tags whose parser classification is known.
 *
 * Project-level custom-element options are unavailable until Vue ownership is
 * established. Unknown component/custom-element tags therefore cannot safely
 * prove that the `vue:` target executes. `slot`, `template`, and dynamic
 * `component` also differ from ordinary elements (and `template` differs
 * between supported Vue 3.3/3.5 lines), so they remain conservative.
 */
function hasStableStaticVueIsSemantics(tag: string): boolean {
  if (
    tag === 'component' ||
    tag === 'Component' ||
    tag === 'slot' ||
    tag === 'template'
  ) {
    return false;
  }
  return (
    VUE_NATIVE_TEMPLATE_TAGS.has(tag) || VUE_BUILTIN_TEMPLATE_TAGS.has(tag)
  );
}

/** Reads a valued `v-is` whose meaning differs across supported Vue lines. */
function readValuedVIsDirective(
  attributes: readonly TemplateAttribute[]
): TemplateAttribute | undefined {
  return attributes.find(
    ({ name, value }) => value !== undefined && /^v-is(?:$|[:.])/.test(name)
  );
}

/**
 * Retains only wrapper bindings used by both meanings of valued `v-is`.
 *
 * Vue 3.3 evaluates the directive expression and replaces the source tag;
 * Vue 3.5 removes the directive and renders the source tag. Intersecting both
 * usage sets avoids false ownership on either version while preserving a
 * wrapper deliberately referenced on both sides.
 */
function recordVersionStableVIsUsage(
  sourceTag: string,
  directive: TemplateAttribute,
  usage: TemplateUsage,
  shadowedBindings: ReadonlyMap<string, number>,
  attributes: readonly TemplateAttribute[],
  scriptBindings: ReadonlyMap<string, TemplateBinding>
): void {
  const sourceUsage = createTemplateUsage();
  recordTemplateTagUsage(
    sourceTag,
    sourceUsage,
    shadowedBindings,
    attributes.filter((attribute) => attribute !== directive),
    scriptBindings
  );
  const directiveUsage = createTemplateUsage();
  collectTemplateExpressionUsage(
    directive.value ?? '',
    directiveUsage,
    shadowedBindings
  );

  for (const identifier of sourceUsage.identifiers) {
    if (directiveUsage.identifiers.has(identifier)) {
      usage.identifiers.add(identifier);
    }
  }
  for (const [namespace, sourceMembers] of sourceUsage.namespaceMembers) {
    const directiveMembers = directiveUsage.namespaceMembers.get(namespace);
    if (!directiveMembers) continue;
    for (const member of sourceMembers) {
      if (directiveMembers.has(member)) {
        addTemplateNamespaceMember(usage, namespace, member);
      }
    }
  }
}

/** Selects the first lexical or setup binding in Vue's tag lookup order. */
function resolveTemplateTagBinding(
  sourceName: string,
  shadowedBindings: ReadonlyMap<string, number>,
  scriptBindings: ReadonlyMap<string, TemplateBinding>
): string | undefined {
  const candidates = [...normalizeTemplateBindingNames(sourceName)];
  for (const bindingType of TEMPLATE_BINDING_RESOLUTION_ORDER) {
    for (const candidate of candidates) {
      if (scriptBindings.get(candidate)?.type !== bindingType) continue;
      return shadowedBindings.has(candidate) ? undefined : candidate;
    }
  }
  return undefined;
}

function isDynamicComponentTag(
  tag: string,
  attributes: readonly TemplateAttribute[]
): boolean {
  if (tag !== 'component' && tag !== 'Component') return false;
  return attributes.some(({ name, value }) => {
    // No-value bind shorthand resolves differently in Vue 3.3 and 3.5. Keep
    // the static tag candidate as well as collecting the shorthand expression,
    // so neither supported runtime can silently lose real wrapper usage.
    if (value === undefined) return false;
    const baseName = name.split('.')[0];
    return (
      baseName === 'is' ||
      baseName === ':is' ||
      baseName === 'v-bind:is' ||
      name === '.is' ||
      name.startsWith('.is.')
    );
  });
}

/** Collects dynamic directive arguments and executable directive values. */
function collectTemplateDirectiveUsage(
  attributes: readonly TemplateAttribute[],
  usage: TemplateUsage,
  shadowedBindings: ReadonlyMap<string, number>
): TemplateDirectiveUsage {
  const directives = attributes.filter(({ name }) =>
    isTemplateDirectiveName(name)
  );
  const elementBindings = new Set<string>();
  const descendantBindings = new Set<string>();
  for (const directive of directives.filter(({ name }) =>
    isTemplateForDirective(name)
  )) {
    for (const binding of collectTemplateDirective(
      directive.name,
      directive.value,
      usage,
      shadowedBindings
    )) {
      elementBindings.add(binding);
      descendantBindings.add(binding);
    }
  }
  for (const directive of directives.filter(({ name }) =>
    isTemplateConditionalDirective(name)
  )) {
    collectTemplateDirective(
      directive.name,
      directive.value,
      usage,
      shadowedBindings
    );
  }
  const loopBindings = new Map(shadowedBindings);
  for (const binding of elementBindings) {
    loopBindings.set(binding, (loopBindings.get(binding) ?? 0) + 1);
  }
  for (const directive of directives) {
    if (
      isTemplateForDirective(directive.name) ||
      isTemplateConditionalDirective(directive.name)
    ) {
      continue;
    }
    for (const binding of collectTemplateDirective(
      directive.name,
      directive.value,
      usage,
      loopBindings
    )) {
      descendantBindings.add(binding);
    }
  }
  return { descendantBindings, elementBindings };
}

type TemplateDirectiveUsage = {
  descendantBindings: Set<string>;
  elementBindings: Set<string>;
};

type TemplateAttribute = {
  name: string;
  value: string | undefined;
};

function readTemplateAttributes(attributes: string): TemplateAttribute[] {
  const parsedAttributes: TemplateAttribute[] = [];
  let index = 0;
  while (index < attributes.length) {
    while (/\s/.test(attributes[index] ?? '')) index += 1;
    if (index >= attributes.length || attributes[index] === '/') {
      return parsedAttributes;
    }
    const nameStart = index;
    while (index < attributes.length && !/[\s=]/.test(attributes[index]!)) {
      index += 1;
    }
    const name = attributes.slice(nameStart, index);
    while (/\s/.test(attributes[index] ?? '')) index += 1;

    let value: string | undefined;
    if (attributes[index] === '=') {
      index += 1;
      while (/\s/.test(attributes[index] ?? '')) index += 1;
      const quote = attributes[index];
      if (quote === '"' || quote === "'") {
        index += 1;
        const valueStart = index;
        while (index < attributes.length && attributes[index] !== quote) {
          index += 1;
        }
        value = attributes.slice(valueStart, index);
        if (attributes[index] === quote) index += 1;
      } else {
        const valueStart = index;
        while (index < attributes.length && !/[\s>]/.test(attributes[index]!)) {
          index += 1;
        }
        value = attributes.slice(valueStart, index);
      }
    }
    parsedAttributes.push({ name, value });
  }
  return parsedAttributes;
}

function isTemplateDirectiveName(name: string): boolean {
  return /^[.:@#]|^v-/.test(name);
}

function isTemplateVPreDirective(name: string): boolean {
  return /^v-pre(?:$|[:.])/.test(name);
}

function isTemplateForDirective(name: string): boolean {
  return /^v-for(?::|$)/.test(name);
}

function isTemplateConditionalDirective(name: string): boolean {
  return /^v-(?:if|else-if)(?::|$)/.test(name);
}

function collectTemplateDirective(
  name: string,
  value: string | undefined,
  usage: TemplateUsage,
  shadowedBindings: ReadonlyMap<string, number>
): Set<string> {
  if (!/^[.:@#]|^v-/.test(name)) return new Set();
  // Vue consumes the complete compatibility directive. Its dynamic argument
  // is never a runtime expression; valued forms are intersected with source
  // tag usage separately because Vue 3.3 and 3.5 interpret them differently.
  if (/^v-is(?:$|[:.])/.test(name)) return new Set();
  const argument = readDynamicDirectiveArgument(name);
  if (argument) {
    collectTemplateExpressionUsage(argument, usage, shadowedBindings);
  }
  if (value === undefined) {
    if ((name.startsWith(':') || name.startsWith('.')) && !argument) {
      collectTemplateExpressionUsage(
        name.slice(1).split('.')[0] ?? '',
        usage,
        shadowedBindings
      );
    }
    return new Set();
  }
  if (/^(?:#|v-slot(?::|$))/.test(name)) {
    return collectTemplateBindingUsage(value, usage, shadowedBindings);
  } else if (/^v-for(?::|$)/.test(name)) {
    return collectTemplateForUsage(value, usage, shadowedBindings);
  } else {
    collectTemplateExpressionUsage(value, usage, shadowedBindings);
  }
  return new Set();
}

function readDynamicDirectiveArgument(name: string): string | undefined {
  const start = name.indexOf('[');
  const end = name.lastIndexOf(']');
  return start >= 0 && end > start ? name.slice(start + 1, end) : undefined;
}

function collectTemplateExpressionUsage(
  source: string,
  usage: TemplateUsage,
  shadowedBindings: ReadonlyMap<string, number>
): void {
  const ast = parseTemplateExpression(source);
  if (ast) collectTemplateAstUsage(ast, usage, shadowedBindings);
}

function collectTemplateBindingUsage(
  source: string,
  usage: TemplateUsage,
  shadowedBindings: ReadonlyMap<string, number>
): Set<string> {
  try {
    const ast = parseScriptAst(`((${source}) => {})`, 'tsx');
    collectTemplateAstUsage(ast, usage, shadowedBindings);
    const statement = ast.program.body[0];
    if (
      statement?.type !== 'ExpressionStatement' ||
      statement.expression.type !== 'ArrowFunctionExpression'
    ) {
      return new Set();
    }
    return new Set(
      statement.expression.params.flatMap((parameter) =>
        Object.keys(t.getBindingIdentifiers(parameter))
      )
    );
  } catch {
    // Invalid bindings are diagnosed by the owning Vue compiler later.
    return new Set();
  }
}

function collectTemplateForUsage(
  source: string,
  usage: TemplateUsage,
  shadowedBindings: ReadonlyMap<string, number>
): Set<string> {
  const separator = /\s+(?:in|of)\s+/.exec(source);
  if (!separator || separator.index === undefined) {
    collectTemplateExpressionUsage(source, usage, shadowedBindings);
    return new Set();
  }
  const left = source.slice(0, separator.index).trim();
  const right = source.slice(separator.index + separator[0].length).trim();
  const unwrappedLeft =
    left.startsWith('(') && left.endsWith(')') ? left.slice(1, -1) : left;
  const bindings = collectTemplateBindingUsage(
    unwrappedLeft,
    usage,
    shadowedBindings
  );
  collectTemplateExpressionUsage(right, usage, shadowedBindings);
  return bindings;
}

/** Finds the first syntactically complete interpolation closing delimiter. */
function readTemplateInterpolation(
  source: string,
  start: number
): { ast?: t.File; end: number } {
  let closing = source.indexOf('}}', start + 2);
  while (closing >= 0) {
    const ast = parseTemplateExpression(source.slice(start + 2, closing));
    if (ast) return { ast, end: closing + 2 };
    closing = source.indexOf('}}', closing + 1);
  }
  return { end: source.length };
}

/** Accepts expression, binding-pattern, and event-statement template syntax. */
function parseTemplateExpression(source: string): t.File | undefined {
  for (const candidate of [
    `(${source})`,
    `((${source}) => {})`,
    `function __gt_template_expression__() { ${source} }`,
  ]) {
    try {
      return parseScriptAst(candidate, 'tsx');
    } catch {
      // Try the next executable wrapper.
    }
  }
  return undefined;
}

/** Records only unshadowed runtime identifiers and static namespace members. */
function collectTemplateAstUsage(
  ast: t.File,
  usage: TemplateUsage,
  shadowedBindings: ReadonlyMap<string, number>,
  scriptSetup = false
): void {
  traverse(ast, {
    ReferencedIdentifier(path) {
      if (
        (scriptSetup && isCompilerConsumedSetupMacroReference(path)) ||
        shadowedBindings.has(path.node.name) ||
        path.scope.getBinding(path.node.name) ||
        path.findParent(
          (parent) => t.isTSType(parent.node) || t.isFlow(parent.node)
        )
      ) {
        return;
      }
      usage.identifiers.add(path.node.name);
    },
    JSXIdentifier(path) {
      if (
        !/^[A-Z_$]/.test(path.node.name) ||
        path.parentPath?.isJSXMemberExpression() ||
        !(
          (path.parentPath?.isJSXOpeningElement() &&
            path.parentPath.node.name === path.node) ||
          (path.parentPath?.isJSXClosingElement() &&
            path.parentPath.node.name === path.node)
        ) ||
        shadowedBindings.has(path.node.name) ||
        path.scope.getBinding(path.node.name)
      ) {
        return;
      }
      usage.identifiers.add(path.node.name);
    },
    MemberExpression(path) {
      collectTemplateMemberUsage(path, usage, shadowedBindings);
    },
    OptionalMemberExpression(path) {
      collectTemplateMemberUsage(path, usage, shadowedBindings);
    },
    JSXMemberExpression(path) {
      const object = path.node.object;
      if (
        object.type !== 'JSXIdentifier' ||
        shadowedBindings.has(object.name) ||
        path.scope.getBinding(object.name) ||
        path.node.property.type !== 'JSXIdentifier'
      ) {
        return;
      }
      usage.identifiers.add(object.name);
      addTemplateNamespaceMember(usage, object.name, path.node.property.name);
    },
  });
}

function collectTemplateMemberUsage(
  path: NodePath<t.MemberExpression | t.OptionalMemberExpression>,
  usage: TemplateUsage,
  shadowedBindings: ReadonlyMap<string, number>
): void {
  const object = path.node.object;
  if (
    object.type !== 'Identifier' ||
    shadowedBindings.has(object.name) ||
    path.scope.getBinding(object.name) ||
    path.findParent(
      (parent) => t.isTSType(parent.node) || t.isFlow(parent.node)
    )
  ) {
    return;
  }
  const member = readStaticPropertyName(path.node);
  if (member) addTemplateNamespaceMember(usage, object.name, member);
}

function addTemplateNamespaceMember(
  usage: TemplateUsage,
  namespace: string,
  member: string
): void {
  const members = usage.namespaceMembers.get(namespace) ?? new Set<string>();
  members.add(member);
  usage.namespaceMembers.set(namespace, members);
}

/** Mirrors Vue's kebab/camel/Pascal lookup for setup template bindings. */
function normalizeTemplateBindingNames(sourceName: string): Set<string> {
  const camelized = sourceName.replace(/-(\w)/g, (_match, letter: string) =>
    letter.toUpperCase()
  );
  const pascalized = camelized
    ? camelized[0]!.toUpperCase() + camelized.slice(1)
    : camelized;
  return new Set([sourceName, camelized, pascalized]);
}

function readStaticPropertyName(
  member: t.MemberExpression | t.OptionalMemberExpression
): string | undefined {
  if (!member.computed && member.property.type === 'Identifier') {
    return member.property.name;
  }
  if (member.computed && member.property.type === 'StringLiteral') {
    return member.property.value;
  }
  return undefined;
}

function readPackageName(
  manifest: JavaScriptPackageManifest
): string | undefined {
  return typeof manifest.name === 'string' && manifest.name
    ? manifest.name
    : undefined;
}

function resolveRealPath(file: string): string {
  try {
    return fs.realpathSync(file);
  } catch {
    return path.resolve(file);
  }
}

/** Keeps a package's default source roots from following external symlinks. */
function isContainedPhysicalDirectory(
  root: string,
  directory: string
): boolean {
  try {
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) return false;
    const realDirectory = fs.realpathSync(directory);
    const relative = path.relative(root, realDirectory);
    return (
      relative !== '' &&
      !relative.startsWith(`..${path.sep}`) &&
      relative !== '..' &&
      !path.isAbsolute(relative)
    );
  } catch {
    return false;
  }
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
