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

// What the stable entry points export that formats or reads an ICU string
const ICU_STRING_APIS = new Set<string>([
  ...Object.values(GT_FUNCTIONS_WITH_CALLBACKS),
  GT_OTHER_FUNCTIONS.msg,
  GT_OTHER_FUNCTIONS.t,
  'tx',
  'useTranslations',
  'getTranslations',
  'decodeVars',
]);

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
 * module has none. The `/unstable` entry points format message trees.
 */
export function getIcuStringImportError(
  program: t.Program,
  filename: string
): string | undefined {
  for (const statement of program.body) {
    if (
      (!t.isImportDeclaration(statement) &&
        !t.isExportNamedDeclaration(statement)) ||
      !statement.source ||
      !isStableGTImportSource(statement.source.value) ||
      (t.isImportDeclaration(statement)
        ? statement.importKind === 'type'
        : statement.exportKind === 'type')
    ) {
      continue;
    }
    for (const specifier of statement.specifiers) {
      const imported = t.isImportSpecifier(specifier)
        ? specifier.imported
        : t.isExportSpecifier(specifier)
          ? specifier.local
          : undefined;
      const name = t.isIdentifier(imported) ? imported.name : imported?.value;
      if (
        name === undefined ||
        !ICU_STRING_APIS.has(name) ||
        (t.isImportSpecifier(specifier) && specifier.importKind === 'type')
      ) {
        continue;
      }
      return createDiagnosticMessage({
        source: '@generaltranslation/compiler',
        severity: 'Error',
        whatHappened: `${name} from "${statement.source.value}" works with ICU strings, but experimentalOmitIcuParser leaves the ICU parser out of this build`,
        fix: `Write these messages with the tagged templates of the /unstable entry point or with <T>, or turn off experimentalOmitIcuParser (${OMIT_ICU_PARSER_ENV_VAR})`,
        details: createErrorLocation(specifier)
          .trim()
          .replace('{filename}', filename),
      });
    }
  }
  return undefined;
}

function isStableGTImportSource(source: string): boolean {
  return (
    !isUnstableGTImportSource(source) &&
    Object.values(GT_IMPORT_SOURCES).some(
      (root) => source === root || source.startsWith(`${root}/`)
    )
  );
}
