import { existsSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import ts from 'typescript';

// Shared by the RSC and compat leak tests, which walk the source import graph.

/**
 * Specifiers of runtime imports, re-exports, side-effect imports, require()
 * calls and dynamic import(). Type-only imports and re-exports are skipped.
 * Parsed with TypeScript, so comments and strings never count as imports.
 */
export function getRuntimeImports(code: string): string[] {
  const sourceFile = ts.createSourceFile(
    'module.tsx',
    code,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TSX
  );
  const specifiers: string[] = [];
  const add = (node: ts.Node | undefined) => {
    if (node && ts.isStringLiteralLike(node)) specifiers.push(node.text);
  };
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) {
      if (!isTypeOnlyImport(node.importClause)) add(node.moduleSpecifier);
    } else if (ts.isExportDeclaration(node)) {
      if (!node.isTypeOnly) add(node.moduleSpecifier);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      !node.isTypeOnly &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      add(node.moduleReference.expression);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === 'require'))
    ) {
      add(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return specifiers;
}

/** Specifiers of `require()` calls, parsed with TypeScript like getRuntimeImports(). */
export function getRequireSpecifiers(code: string): string[] {
  const sourceFile = ts.createSourceFile(
    'module.tsx',
    code,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TSX
  );
  const specifiers: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return specifiers;
}

/** An import whose bindings are all types, so it is erased at runtime. */
function isTypeOnlyImport(clause: ts.ImportClause | undefined): boolean {
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  const bindings = clause.namedBindings;
  return (
    !clause.name &&
    !!bindings &&
    ts.isNamedImports(bindings) &&
    bindings.elements.length > 0 &&
    bindings.elements.every((element) => element.isTypeOnly)
  );
}

/**
 * Resolves a relative specifier to a repo-relative source file, or null.
 */
export function resolveRelative(
  repoRoot: string,
  specifier: string,
  fromFile: string
): string | null {
  const base = resolve(repoRoot, dirname(fromFile), specifier);
  for (const suffix of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const candidate = base + suffix;
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return relative(repoRoot, candidate).split('\\').join('/');
    }
  }
  return null;
}
