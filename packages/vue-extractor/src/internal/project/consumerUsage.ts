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
  'lib',
  'node_modules',
  'out',
  'storybook-static',
  'target',
  'temp',
  'tmp',
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
  return relative
    .split(path.sep)
    .slice(0, -1)
    .some(
      (segment) =>
        segment.startsWith('.') || IGNORED_CONSUMER_DIRECTORIES.has(segment)
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
    const { blocks, templateSource } = readVueScriptBlocks(source);
    return blocks.flatMap(({ language, source }) =>
      readScriptImports(source, language, templateSource)
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
  blocks: Array<{ language: string | undefined; source: string }>;
  templateSource: string;
} {
  const blocks: Array<{ language: string | undefined; source: string }> = [];
  const templateSources: string[] = [];
  for (const block of readTopLevelSfcBlocks(source)) {
    if (block.name === 'template') {
      templateSources.push(block.source);
      continue;
    }
    if (block.name !== 'script') continue;
    const attributes = block.attributes;
    const quotedLanguage = /\blang\s*=\s*(["'])([^"']+)\1/i.exec(
      attributes
    )?.[2];
    const bareLanguage = /\blang\s*=\s*([^\s>]+)/i.exec(attributes)?.[1];
    blocks.push({
      language: quotedLanguage ?? bareLanguage,
      source: block.source,
    });
  }
  return { blocks, templateSource: templateSources.join('\n') };
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
  declaredLanguage: string | undefined,
  templateSource?: string
): ConsumerImport[] {
  const languages = new Set<string | undefined>([declaredLanguage]);
  languages.add('tsx');
  if (declaredLanguage === 'js' || declaredLanguage === 'jsx') {
    languages.add('flow');
  }

  for (const language of languages) {
    try {
      return collectStaticImports(
        parseScriptAst(source, language),
        templateSource
      );
    } catch {
      // Try the next syntax accepted by source extraction.
    }
  }
  return [];
}

function collectStaticImports(
  ast: t.File,
  templateSource?: string
): ConsumerImport[] {
  let programScope: Scope | undefined;
  traverse(ast, {
    Program(programPath) {
      programScope = programPath.scope;
      programPath.stop();
    },
  });
  if (!programScope) return [];
  const templateUsage = templateSource
    ? readTemplateUsage(templateSource)
    : undefined;

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
              templateUsage
            )
          ) {
            importedNames.add('default');
          }
        } else if (specifier.type === 'ImportNamespaceSpecifier') {
          for (const name of readUsedNamespaceMembers(
            programScope,
            specifier.local.name,
            templateUsage
          )) {
            importedNames.add(name);
          }
        } else if (
          specifier.importKind !== 'type' &&
          specifier.importKind !== 'typeof' &&
          bindingHasRuntimeUsage(
            programScope,
            specifier.local.name,
            templateUsage
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
  templateUsage: TemplateUsage | undefined
): boolean {
  const binding = scope.getBinding(localName);
  return Boolean(
    binding?.referencePaths.some(
      (reference) => !isTypeOnlyReference(reference)
    ) || templateUsage?.identifiers.has(localName)
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
  templateUsage?: TemplateUsage
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
  if (templateUsage) {
    for (const templateName of templateNames) {
      for (const name of templateUsage.namespaceMembers.get(templateName) ??
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
  identifiers: Set<string>;
  namespaceMembers: Map<string, Set<string>>;
};

const VUE_BUILTIN_TEMPLATE_TAGS = new Set([
  'BaseTransition',
  'KeepAlive',
  'Suspense',
  'Teleport',
  'Transition',
  'TransitionGroup',
  'base-transition',
  'keep-alive',
  'slot',
  'suspense',
  'teleport',
  'template',
  'transition',
  'transition-group',
]);

const VUE_RAW_TEXT_TEMPLATE_TAGS = new Set([
  'script',
  'style',
  'textarea',
  'title',
]);

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
function readTemplateUsage(templateSource: string): TemplateUsage {
  const usage: TemplateUsage = {
    identifiers: new Set(),
    namespaceMembers: new Map(),
  };
  const activeBindings = new Map<string, number>();
  const elementStack: Array<{ bindings: Set<string>; name: string }> = [];
  let index = 0;
  while (index < templateSource.length) {
    if (templateSource.startsWith('<!--', index)) {
      index = readHtmlCommentEnd(templateSource, index);
      continue;
    }
    if (templateSource.startsWith('{{', index)) {
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
    recordTemplateTagUsage(tag.name, usage);
    if (tag.closing) {
      closeTemplateElementScope(tag.name, elementStack, activeBindings);
      index = tag.end;
      continue;
    }
    const declaredBindings = collectTemplateDirectiveUsage(
      tag.attributes,
      usage,
      activeBindings
    );
    const rawTextClosingTag =
      !tag.selfClosing && VUE_RAW_TEXT_TEMPLATE_TAGS.has(tag.name)
        ? findRawBlockClosingTag(templateSource, tag.name, tag.end)
        : undefined;
    if (rawTextClosingTag) {
      index = rawTextClosingTag.end;
      continue;
    }
    if (!tag.selfClosing && !VUE_VOID_TEMPLATE_TAGS.has(tag.name)) {
      elementStack.push({ bindings: declaredBindings, name: tag.name });
      for (const binding of declaredBindings) {
        activeBindings.set(binding, (activeBindings.get(binding) ?? 0) + 1);
      }
    }
    index = tag.end;
  }
  return usage;
}

function closeTemplateElementScope(
  name: string,
  elementStack: Array<{ bindings: Set<string>; name: string }>,
  activeBindings: Map<string, number>
): void {
  let matchingIndex = -1;
  for (let index = elementStack.length - 1; index >= 0; index -= 1) {
    if (elementStack[index]?.name === name) {
      matchingIndex = index;
      break;
    }
  }
  if (matchingIndex < 0) return;
  while (elementStack.length > matchingIndex) {
    const element = elementStack.pop()!;
    for (const binding of element.bindings) {
      const remaining = (activeBindings.get(binding) ?? 1) - 1;
      if (remaining > 0) activeBindings.set(binding, remaining);
      else activeBindings.delete(binding);
    }
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

function recordTemplateTagUsage(tag: string, usage: TemplateUsage): void {
  const member = /^([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)$/.exec(tag);
  if (member?.[1] && member[2]) {
    usage.identifiers.add(member[1]);
    addTemplateNamespaceMember(usage, member[1], member[2]);
    return;
  }
  if (VUE_BUILTIN_TEMPLATE_TAGS.has(tag) || VUE_NATIVE_TEMPLATE_TAGS.has(tag)) {
    return;
  }
  for (const name of normalizeTemplateBindingNames(tag)) {
    usage.identifiers.add(name);
  }
}

/** Collects dynamic directive arguments and executable directive values. */
function collectTemplateDirectiveUsage(
  attributes: string,
  usage: TemplateUsage,
  shadowedBindings: ReadonlyMap<string, number>
): Set<string> {
  const directives = readTemplateDirectives(attributes);
  const declaredBindings = new Set<string>();
  for (const directive of directives.filter(({ name }) =>
    isTemplateForDirective(name)
  )) {
    for (const binding of collectTemplateDirective(
      directive.name,
      directive.value,
      usage,
      shadowedBindings
    )) {
      declaredBindings.add(binding);
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
  for (const binding of declaredBindings) {
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
      declaredBindings.add(binding);
    }
  }
  return declaredBindings;
}

type TemplateDirective = {
  name: string;
  value: string | undefined;
};

function readTemplateDirectives(attributes: string): TemplateDirective[] {
  const directives: TemplateDirective[] = [];
  let index = 0;
  while (index < attributes.length) {
    while (/\s/.test(attributes[index] ?? '')) index += 1;
    if (index >= attributes.length || attributes[index] === '/') {
      return directives;
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
    if (/^[:@#]|^v-/.test(name)) directives.push({ name, value });
  }
  return directives;
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
  if (!/^[:@#]|^v-/.test(name)) return new Set();
  const argument = readDynamicDirectiveArgument(name);
  if (argument) {
    collectTemplateExpressionUsage(argument, usage, shadowedBindings);
  }
  if (value === undefined) {
    if (name.startsWith(':') && !argument) {
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
  const bindings = collectTemplateBindingUsage(left, usage, shadowedBindings);
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
  shadowedBindings: ReadonlyMap<string, number>
): void {
  traverse(ast, {
    ReferencedIdentifier(path) {
      if (
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
    MemberExpression(path) {
      collectTemplateMemberUsage(path, usage, shadowedBindings);
    },
    OptionalMemberExpression(path) {
      collectTemplateMemberUsage(path, usage, shadowedBindings);
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
