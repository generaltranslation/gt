import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import * as t from '@babel/types';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { isUnstableGTImportSource } from 'generaltranslation/internal';
import {
  GT_FUNCTIONS_WITH_CALLBACKS,
  GT_IMPORT_SOURCES,
  GT_OTHER_FUNCTIONS,
} from '../../utils/constants/gt/constants';
import { createErrorLocation } from '../../utils/errors';
import { readBooleanEnv } from '../../utils/readBooleanEnv';

/**
 * Environment variable read when the `experimentalOmitIcuParser` option is not
 * set, so a build script can turn it on.
 */
export const OMIT_ICU_PARSER_ENV_VAR = 'GT_OMIT_ICU_PARSER';

/** The subpath GT packages import the ICU string parser from. */
export const ICU_PARSER_SPECIFIER = '@generaltranslation/icu/parser';

// The export condition under which that subpath has no parser
const OMIT_ICU_PARSER_CONDITION = 'gt-omit-icu-parser';

const ICU_PACKAGE_NAME = '@generaltranslation/icu';

// Entry points an app imports GT's string APIs from; their /unstable
// subpaths format message trees
const FRAMEWORK_ROOTS: readonly string[] = [
  ...Object.values(GT_IMPORT_SOURCES),
  'gt-node',
  'gt-react-native',
  '@generaltranslation/react-core',
];

// The packages those are built on
const LIBRARY_ROOTS: readonly string[] = [
  'generaltranslation',
  '@generaltranslation/format',
];

/** By entry point, the exports that format or read an ICU string. */
const ICU_STRING_EXPORTS: readonly (readonly [
  roots: readonly string[],
  names: ReadonlySet<string>,
])[] = [
  [
    FRAMEWORK_ROOTS,
    new Set<string>([
      ...Object.values(GT_FUNCTIONS_WITH_CALLBACKS),
      GT_OTHER_FUNCTIONS.msg,
      GT_OTHER_FUNCTIONS.t,
      GT_OTHER_FUNCTIONS.GtInternalRuntimeTranslateString,
      'tx',
      'gtFallback',
      'mFallback',
      'useTranslations',
      'getTranslations',
      'decodeVars',
    ]),
  ],
  [
    LIBRARY_ROOTS,
    new Set([
      'formatMessage',
      'decodeVars',
      'indexVars',
      'extractVars',
      'condenseVars',
    ]),
  ],
  [[ICU_PARSER_SPECIFIER], new Set(['formatIcu', 'parse', 'printAST'])],
];

/**
 * Whether this build leaves out the ICU string parser: the
 * `experimentalOmitIcuParser` option, else the `GT_OMIT_ICU_PARSER`
 * environment variable.
 */
export function getOmitIcuParser(option: boolean | undefined): boolean {
  return option ?? readBooleanEnv(OMIT_ICU_PARSER_ENV_VAR) ?? false;
}

/**
 * The file `@generaltranslation/icu/parser` resolves to without the parser,
 * for the copy of the package `importer` sees, or the compiler's own copy
 * without an importer; undefined when that copy has none, so the import
 * resolves as usual.
 */
export function resolveOmittedIcuParser(importer?: string): string | undefined {
  const importerFile = importer?.split('?')[0];
  const from =
    importerFile && path.isAbsolute(importerFile) ? importerFile : __filename;
  let directory: string;
  try {
    directory = path.dirname(createRequire(from).resolve(ICU_PARSER_SPECIFIER));
  } catch {
    return undefined;
  }
  while (!fs.existsSync(path.join(directory, 'package.json'))) {
    const parent = path.dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
  const { name, exports } = JSON.parse(
    fs.readFileSync(path.join(directory, 'package.json'), 'utf8')
  ) as {
    name?: string;
    exports?: Record<
      string,
      Record<string, Record<string, { default?: string }>>
    >;
  };
  const targets = exports?.['./parser']?.[OMIT_ICU_PARSER_CONDITION];
  const target = (from.endsWith('.cjs') ? targets?.require : targets?.import)
    ?.default;
  return name === ICU_PACKAGE_NAME && typeof target === 'string'
    ? path.join(directory, target)
    : undefined;
}

export const OMITTED_ICU_PARSER_UNAVAILABLE_WARNING = createDiagnosticMessage({
  source: '@generaltranslation/compiler',
  severity: 'Warning',
  whatHappened:
    'experimentalOmitIcuParser is set, but the installed @generaltranslation/icu has no build without the parser',
  reassurance: 'The build continues with the parser',
  fix: 'Update the General Translation packages, or turn off experimentalOmitIcuParser',
});

/**
 * An error for the first import in `program` of something that formats an ICU
 * string, which a build without the parser cannot do; undefined when the
 * module has none, or belongs to a GT package, whose own code is what the
 * build without the parser is for. The `/unstable` entry points format
 * message trees.
 *
 * An import by name fails when the name is one of those exports. An import
 * that takes a whole entry point (a namespace or default import, `export *`,
 * `import()` or `require()`) fails whatever the module does with it, since
 * the compiler does not follow what is read from it.
 */
export function getIcuStringImportError(
  program: t.Program,
  filename: string
): string | undefined {
  const found = findIcuStringImport(program);
  if (!found || isGTPackageModule(filename)) return undefined;
  const turnOff = `turn off experimentalOmitIcuParser (${OMIT_ICU_PARSER_ENV_VAR})`;
  return createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Error',
    whatHappened:
      found.name === undefined
        ? `${found.form} "${found.source}" can reach what works with ICU strings there, but experimentalOmitIcuParser leaves the ICU parser out of this build`
        : `${found.name} from "${found.source}" works with ICU strings, but experimentalOmitIcuParser leaves the ICU parser out of this build`,
    fix:
      found.name === undefined
        ? `Import what this module uses from "${found.source}" by name, or ${turnOff}`
        : `Write these messages with the tagged templates of the /unstable entry point or with <T>, or ${turnOff}`,
    details: createErrorLocation(found.node)
      .trim()
      .replace('{filename}', filename),
  });
}

type IcuStringImport = {
  source: string;
  node: t.Node;
} & (
  | { name: string; form?: undefined }
  // How the module takes the whole entry point
  | { name?: undefined; form: string }
);

function findIcuStringImport(program: t.Program): IcuStringImport | undefined {
  for (const statement of program.body) {
    if (
      (!t.isImportDeclaration(statement) &&
        !t.isExportNamedDeclaration(statement) &&
        !t.isExportAllDeclaration(statement)) ||
      !statement.source ||
      (t.isImportDeclaration(statement)
        ? statement.importKind === 'type'
        : statement.exportKind === 'type')
    ) {
      continue;
    }
    const source = statement.source.value;
    const names = getIcuStringExports(source);
    if (!names) continue;
    if (t.isExportAllDeclaration(statement)) {
      return { source, node: statement, form: 'export * from' };
    }
    for (const specifier of statement.specifiers) {
      if (t.isImportNamespaceSpecifier(specifier)) {
        return { source, node: specifier, form: 'A namespace import of' };
      }
      if (t.isExportNamespaceSpecifier(specifier)) {
        return { source, node: specifier, form: 'export * from' };
      }
      if (t.isImportDefaultSpecifier(specifier)) {
        return { source, node: specifier, form: 'A default import of' };
      }
      if (t.isImportSpecifier(specifier) && specifier.importKind === 'type') {
        continue;
      }
      const imported = t.isImportSpecifier(specifier)
        ? specifier.imported
        : t.isExportSpecifier(specifier)
          ? specifier.local
          : undefined;
      const name = t.isIdentifier(imported) ? imported.name : imported?.value;
      if (name === 'default') {
        return { source, node: specifier, form: 'A default import of' };
      }
      if (name !== undefined && names.has(name)) {
        return { source, node: specifier, name };
      }
    }
  }

  let dynamic: IcuStringImport | undefined;
  t.traverseFast(program, (node) => {
    if (dynamic) return;
    const [form, argument] = t.isImportExpression(node)
      ? ['import() of', node.source]
      : t.isCallExpression(node) && t.isImport(node.callee)
        ? ['import() of', node.arguments[0]]
        : t.isCallExpression(node) &&
            t.isIdentifier(node.callee, { name: 'require' })
          ? ['require() of', node.arguments[0]]
          : [];
    const source = t.isStringLiteral(argument)
      ? argument.value
      : t.isTemplateLiteral(argument) && argument.expressions.length === 0
        ? argument.quasis[0].value.cooked
        : undefined;
    if (form && source != null && getIcuStringExports(source)) {
      dynamic = { source, node, form };
    }
  });
  return dynamic;
}

/** The exports of an entry point that work with ICU strings, if it has any. */
function getIcuStringExports(source: string): ReadonlySet<string> | undefined {
  if (isUnstableGTImportSource(source)) return undefined;
  return ICU_STRING_EXPORTS.find(([roots]) =>
    roots.some((root) => source === root || source.startsWith(`${root}/`))
  )?.[1];
}

const gtPackageDirectories = new Map<string, boolean>();

/** Whether a module is part of a GT package, installed or linked from a workspace. */
function isGTPackageModule(filename: string): boolean {
  const file = filename.split('?')[0];
  if (!path.isAbsolute(file)) return false;
  const visited: string[] = [];
  let directory = path.dirname(file);
  let result: boolean | undefined;
  while (result === undefined) {
    result = gtPackageDirectories.get(directory);
    if (result !== undefined) break;
    visited.push(directory);
    const manifest = path.join(directory, 'package.json');
    if (fs.existsSync(manifest)) {
      result = isGTPackageName(readPackageName(manifest));
      break;
    }
    const parent = path.dirname(directory);
    if (parent === directory) result = false;
    directory = parent;
  }
  for (const visitedDirectory of visited) {
    gtPackageDirectories.set(visitedDirectory, result);
  }
  return result;
}

function readPackageName(manifest: string): string | undefined {
  try {
    const { name } = JSON.parse(fs.readFileSync(manifest, 'utf8')) as {
      name?: unknown;
    };
    return typeof name === 'string' ? name : undefined;
  } catch {
    return undefined;
  }
}

function isGTPackageName(name: string | undefined): boolean {
  return (
    name !== undefined &&
    (name.startsWith('@generaltranslation/') ||
      FRAMEWORK_ROOTS.includes(name) ||
      LIBRARY_ROOTS.includes(name))
  );
}
