/**
 * Shared helpers for the jsxParsing tests.
 *
 * Test files that use `mockFiles` must declare the mocks themselves, because
 * `vi.mock` is hoisted per test file:
 *
 *   vi.mock('node:fs');
 *   vi.mock('../../resolveImportPath.js');
 */
import nodePath from 'node:path';
import fs from 'node:fs';
import { vi } from 'vitest';
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverseModule, { NodePath } from '@babel/traverse';
import generateModule from '@babel/generator';
import { parseTranslationComponent } from '../parseJsx.js';
import { resolveImportPath } from '../../resolveImportPath.js';
import { getPathsAndAliases } from '../../getPathsAndAliases.js';
import {
  ensureTAndVarImported,
  autoInsertJsxComponents,
} from '../autoInsertion.js';
import {
  INTERNAL_TRANSLATION_COMPONENT,
  INTERNAL_VAR_COMPONENT,
} from '../../constants.js';
import { ParsingConfigOptions } from '../../../../../types/parsing.js';
import { Updates } from '../../../../../types/index.js';
import { Libraries, type GTLibrary } from '../../../../../types/libraries.js';

const traverse = traverseModule.default || traverseModule;
const generate = generateModule.default || generateModule;

type ExtractConfig = Omit<
  Parameters<typeof parseTranslationComponent>[0]['config'],
  'importAliases' | 'parsingOptions' | 'pkgs' | 'file'
>;

export type Extraction = {
  updates: Updates;
  errors: string[];
  warnings: Set<string>;
};

export const parsingOptions: ParsingConfigOptions = {
  conditionNames: ['import', 'require'],
};

const GT_SOURCES = ['gt-next', 'gt-react'];
const AUTO_PKGS: GTLibrary[] = [Libraries.GT_NEXT, Libraries.GT_REACT];

export function parseCode(code: string) {
  return parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
}

/** Sources of all updates, in extraction order. */
export function sources(result: { updates: Updates }) {
  return result.updates.map((update) => update.source);
}

const GT_NAMES =
  /<(T|Var|Num|Currency|DateTime|RelativeTime|Branch|Plural|Derive)\b|\b(derive)\(/g;

/**
 * Builds a module whose Page component returns `jsx`. `body` goes inside the
 * component, `outer` at module level. The GT components (and derive()) that
 * the code uses are imported from gt-next.
 */
export function page(jsx: string, { body = '', outer = '' } = {}): string {
  const used = new Set(
    [...(outer + body + jsx).matchAll(GT_NAMES)].map((m) => m[1] ?? m[2])
  );
  return [
    used.size ? `import { ${[...used].join(', ')} } from "gt-next";` : '',
    outer,
    `export default function Page() { ${body} return ${jsx}; }`,
  ]
    .filter(Boolean)
    .join('\n');
}

let projectCount = 0;

/**
 * Serves a virtual project through the mocked fs / resolveImportPath.
 * Keys are paths relative to the project root; imports resolve relative to
 * the importing file, trying `.ts`, `.tsx` and `/index.ts`.
 * Every call gets a fresh root because parseJsx caches by file path.
 * Returns the root, to be used as the directory of the page under test.
 */
export function mockFiles(files: Record<string, string>): string {
  const root = `/test/project-${++projectCount}`;
  const project = new Map(
    Object.entries(files).map(([name, code]) => [`${root}/${name}`, code])
  );
  vi.mocked(fs.readFileSync).mockImplementation((file) => {
    const code = project.get(String(file));
    if (code === undefined) throw new Error(`File not found: ${file}`);
    return code;
  });
  vi.mocked(resolveImportPath).mockImplementation((currentFile, importPath) => {
    const base = nodePath.posix.resolve(
      nodePath.posix.dirname(currentFile),
      importPath
    );
    return (
      [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find((candidate) =>
        project.has(candidate)
      ) ?? null
    );
  });
  return root;
}

/**
 * Extracts user-written <T> components (the only pass when auto JSX injection
 * is off).
 */
export function extractUserT(
  code: string,
  { file = '/test/page.tsx', ...config }: { file?: string } & ExtractConfig = {}
): Extraction {
  const result: Extraction = { updates: [], errors: [], warnings: new Set() };
  const ast = parseCode(code);
  const importAliases: Record<string, string> = {};
  let tLocalName = '';
  traverse(ast, {
    ImportDeclaration(path) {
      if (!GT_SOURCES.includes(path.node.source.value)) return;
      for (const spec of path.node.specifiers) {
        if (!t.isImportSpecifier(spec) || !t.isIdentifier(spec.imported)) {
          continue;
        }
        importAliases[spec.local.name] = spec.imported.name;
        if (spec.imported.name === 'T') tLocalName = spec.local.name;
      }
    },
  });
  if (!tLocalName) return result;
  traverse(ast, {
    Program(programPath) {
      const binding = programPath.scope.getBinding(tLocalName);
      if (!binding) return;
      parseTranslationComponent({
        originalName: 'T',
        localName: tLocalName,
        path: binding.path,
        updates: result.updates,
        config: {
          importAliases,
          parsingOptions,
          pkgs: [Libraries.GT_NEXT],
          file,
          ...config,
        },
        output: {
          errors: result.errors,
          warnings: result.warnings,
          unwrappedExpressions: [],
        },
      });
    },
  });
  return result;
}

/** Collects the aliases autoInsertJsxComponents needs, including user T. */
export function collectAliases(ast: t.File) {
  const paths = getPathsAndAliases(ast, AUTO_PKGS);
  const importAliases = { ...paths.importAliases };
  for (const { localName, originalName } of paths.translationComponentPaths) {
    importAliases[localName] = originalName;
  }
  return { importAliases, paths };
}

/** Runs only the injection pass and reports what was inserted. */
export function inject(code: string) {
  const ast = parseCode(code);
  const { importAliases } = collectAliases(ast);
  ensureTAndVarImported(ast, importAliases);
  autoInsertJsxComponents(ast, importAliases);
  const output = generate(ast).code;

  let tCount = 0;
  let varCount = 0;
  const imports: string[] = [];
  traverse(parseCode(output), {
    JSXOpeningElement(path) {
      const name = path.node.name;
      if (!t.isJSXIdentifier(name)) return;
      if (name.name === INTERNAL_TRANSLATION_COMPONENT) tCount++;
      if (name.name === INTERNAL_VAR_COMPONENT) varCount++;
    },
    ImportDeclaration(path) {
      imports.push(path.node.source.value);
    },
  });
  return { code: output, tCount, varCount, imports };
}

/**
 * Mirrors the two passes of createInlineUpdates with enableAutoJsxInjection:
 * pass 1 extracts user-written <T>, pass 2 injects T/Var and extracts from
 * the injected components. Updates that pass 2 re-extracts are dropped.
 */
export function extractWithAutoInjection(
  code: string,
  file = '/test/page.tsx'
): Extraction {
  const result: Extraction = { updates: [], errors: [], warnings: new Set() };
  const output = {
    errors: result.errors,
    warnings: result.warnings,
    unwrappedExpressions: [],
  };
  const config = {
    parsingOptions,
    pkgs: AUTO_PKGS,
    file,
    includeSourceCodeContext: false,
  };
  const ast = parseCode(code);
  const { importAliases, paths } = collectAliases(ast);

  for (const { localName, path } of paths.translationComponentPaths) {
    parseTranslationComponent({
      originalName: localName,
      localName,
      path,
      updates: result.updates,
      config: { ...config, importAliases },
      output,
    });
  }
  const pass1Count = result.updates.length;

  ensureTAndVarImported(ast, importAliases);
  autoInsertJsxComponents(ast, importAliases);

  // Re-parse the modified AST to get fresh scope/bindings
  traverse(parseCode(generate(ast).code), {
    Program(programPath) {
      const binding = programPath.scope.getBinding(
        INTERNAL_TRANSLATION_COMPONENT
      );
      if (!binding) return;
      // Add JSX usages that scope analysis did not register as references
      const known = new Set(binding.referencePaths.map((ref) => ref.node));
      programPath.traverse({
        JSXIdentifier(idPath: NodePath<t.JSXIdentifier>) {
          if (
            idPath.node.name === INTERNAL_TRANSLATION_COMPONENT &&
            idPath.parentPath?.isJSXOpeningElement() &&
            !known.has(idPath.node)
          ) {
            binding.referencePaths.push(idPath);
          }
        },
      });
      parseTranslationComponent({
        originalName: INTERNAL_TRANSLATION_COMPONENT,
        localName: INTERNAL_TRANSLATION_COMPONENT,
        path: binding.path,
        updates: result.updates,
        config: {
          ...config,
          importAliases: {
            ...importAliases,
            [INTERNAL_TRANSLATION_COMPONENT]: INTERNAL_TRANSLATION_COMPONENT,
            [INTERNAL_VAR_COMPONENT]: INTERNAL_VAR_COMPONENT,
          },
          enableAutoJsxInjection: true,
        },
        output,
      });
    },
  });

  const pass1Sources = new Set(
    result.updates.slice(0, pass1Count).map((u) => JSON.stringify(u.source))
  );
  result.updates = result.updates.filter(
    (u, index) =>
      index < pass1Count || !pass1Sources.has(JSON.stringify(u.source))
  );
  return result;
}
