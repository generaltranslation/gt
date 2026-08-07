import fs from 'node:fs';
import path from 'node:path';
import traverseModule, {
  type Binding,
  type NodePath,
  type Scope,
} from '@babel/traverse';
import type * as t from '@babel/types';
import { parseScriptAst } from '../script/parser.js';
import {
  readJavaScriptPackageManifest,
  type JavaScriptPackageManifest,
} from './manifest.js';
import { DEFAULT_VUE_SOURCE_DIRECTORIES } from './sourcePatterns.js';
import {
  readPublicGTImports,
  readPublicImportEntries,
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
  manifest: JavaScriptPackageManifest
): boolean {
  const packageName = readPackageName(manifest);
  if (!packageName) return false;
  const publicImports = readPublicGTImports(packageDirectory, manifest).map(
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
  return consumerSourceUsesGT(consumerDirectory, importsBySpecifier);
}

/** Scans one package boundary for static imports of its dependency's GT API. */
function consumerSourceUsesGT(
  consumerDirectory: string,
  importsBySpecifier: ReadonlyMap<string, ReadonlySet<string>>
): boolean {
  const root = resolveRealPath(consumerDirectory);
  const pending = DEFAULT_VUE_SOURCE_DIRECTORIES.map((directory) =>
    path.join(root, directory)
  )
    .filter((directory) => isContainedPhysicalDirectory(root, directory))
    .reverse();
  const sourceFileQueue = new Set<string>();
  const consumerManifest = readJavaScriptPackageManifest(
    path.join(root, 'package.json')
  );
  if (consumerManifest) {
    for (const { entry } of readPublicImportEntries(root, consumerManifest)) {
      if (!isIgnoredConsumerPath(root, entry)) sourceFileQueue.add(entry);
    }
  }
  try {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.vue') {
        sourceFileQueue.add(path.join(root, entry.name));
      }
    }
  } catch {
    // Public entries may still establish usage when the root cannot be listed.
  }
  let sourceFiles = 0;

  for (const file of sourceFileQueue) {
    sourceFiles += 1;
    if (sourceFiles > MAX_CONSUMER_SOURCE_FILES) return false;
    if (sourceFileUsesGT(file, importsBySpecifier)) return true;
  }

  while (pending.length > 0) {
    const current = pending.pop()!;
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
    for (const entry of entries) {
      if (shouldIgnoreConsumerEntry(entry)) continue;
      const candidate = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(candidate);
        continue;
      }
      if (
        !entry.isFile() ||
        !CONSUMER_SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
      ) {
        continue;
      }
      sourceFiles += 1;
      if (sourceFiles > MAX_CONSUMER_SOURCE_FILES) return false;
      if (
        !sourceFileQueue.has(candidate) &&
        sourceFileUsesGT(candidate, importsBySpecifier)
      ) {
        return true;
      }
    }
  }
  return false;
}

function sourceFileUsesGT(
  file: string,
  importsBySpecifier: ReadonlyMap<string, ReadonlySet<string>>
): boolean {
  for (const consumerImport of readConsumerImports(file)) {
    const gtExportNames = importsBySpecifier.get(consumerImport.source);
    if (!gtExportNames) continue;
    if (
      consumerImport.importedNames === '*' ||
      [...consumerImport.importedNames].some((name) => gtExportNames.has(name))
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
  const expression = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  for (const match of source.matchAll(expression)) {
    const attributes = match[1] ?? '';
    const quotedLanguage = /\blang\s*=\s*(["'])([^"']+)\1/i.exec(
      attributes
    )?.[2];
    const bareLanguage = /\blang\s*=\s*([^\s>]+)/i.exec(attributes)?.[1];
    blocks.push({
      language: quotedLanguage ?? bareLanguage,
      source: match[2] ?? '',
    });
  }
  const templateSource = [
    ...source.matchAll(/<template\b[^>]*>([\s\S]*?)<\/template\s*>/gi),
  ]
    .map((match) => match[1] ?? '')
    .join('\n');
  return { blocks, templateSource };
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
          importedNames.add('default');
        } else if (specifier.type === 'ImportNamespaceSpecifier') {
          for (const name of readUsedNamespaceMembers(
            programScope,
            specifier.local.name,
            templateSource
          )) {
            importedNames.add(name);
          }
        } else if (
          specifier.importKind !== 'type' &&
          specifier.importKind !== 'typeof'
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

/** Returns only statically named namespace members used by source or template. */
function readUsedNamespaceMembers(
  scope: Scope,
  localName: string,
  templateSource?: string
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
  if (templateSource) {
    for (const templateName of templateNames) {
      for (const name of readTemplateNamespaceMembers(
        templateSource,
        templateName
      )) {
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

/** Reads namespace members only from component tags and executable markup. */
function readTemplateNamespaceMembers(
  templateSource: string,
  localName: string
): Set<string> {
  const names = new Set<string>();
  const source = templateSource.replace(/<!--[\s\S]*?-->/g, '');
  const memberPattern = `${escapeRegularExpression(localName)}\\s*\\.\\s*([A-Za-z_$][\\w$]*)`;
  const tagExpression = new RegExp(`<\\/?\\s*${memberPattern}(?=[\\s/>])`, 'g');
  for (const match of source.matchAll(tagExpression)) {
    if (match[1]) names.add(match[1]);
  }

  const executableExpressions = [
    ...source.matchAll(/{{([\s\S]*?)}}/g),
    ...source.matchAll(
      /(?:^|\s)(?:[:@#][^\s=]+|v-[^\s=]+)\s*=\s*(["'])([\s\S]*?)\1/g
    ),
  ];
  const memberExpression = new RegExp(`\\b${memberPattern}`, 'g');
  for (const executable of executableExpressions) {
    const value = executable[2] ?? executable[1] ?? '';
    for (const match of value.matchAll(memberExpression)) {
      if (match[1]) names.add(match[1]);
    }
  }
  return names;
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
