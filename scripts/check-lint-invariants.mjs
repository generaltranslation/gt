import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..');
const errors = [];

const allowedGtI18nImports = new Set([
  'gt-i18n/types',
  'gt-i18n/internal',
  'gt-i18n/internal/types',
]);

checkGtI18nImports();

if (errors.length > 0) {
  console.error('Lint invariant check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log('Lint invariants passed.');
}

function checkGtI18nImports() {
  const files = collectFiles(
    path.join(repoRoot, 'packages/react/src/i18n-context'),
    (file) => file.endsWith('.ts') || file.endsWith('.tsx')
  );

  for (const file of files) {
    const sourceFile = parseSourceFile(file);
    for (const specifier of getModuleSpecifiers(sourceFile)) {
      if (
        specifier.value === 'gt-i18n' ||
        specifier.value.startsWith('gt-i18n/')
      ) {
        if (!allowedGtI18nImports.has(specifier.value)) {
          errors.push(
            `${formatLocation(file, sourceFile, specifier.position)}: ` +
              `In i18n-context, only import from ${[
                ...allowedGtI18nImports,
              ].join(', ')}. Found "${specifier.value}".`
          );
        }
      }
    }
  }
}

function collectFiles(directory, matches) {
  if (!fs.existsSync(directory)) return [];

  const files = [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === 'coverage'
      ) {
        continue;
      }
      files.push(...collectFiles(absolutePath, matches));
      continue;
    }

    if (entry.isFile() && matches(absolutePath)) {
      files.push(absolutePath);
    }
  }

  return files;
}

function parseSourceFile(file) {
  const source = fs.readFileSync(file, 'utf8');
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
}

function getModuleSpecifiers(sourceFile) {
  const specifiers = [];

  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push({
        value: node.moduleSpecifier.text,
        position: node.moduleSpecifier.getStart(sourceFile),
      });
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push({
        value: node.arguments[0].text,
        position: node.arguments[0].getStart(sourceFile),
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

function formatLocation(file, sourceFile, position) {
  const relativePath = path.relative(repoRoot, file);
  const { line, character } =
    sourceFile.getLineAndCharacterOfPosition(position);
  return `${relativePath}:${line + 1}:${character + 1}`;
}
