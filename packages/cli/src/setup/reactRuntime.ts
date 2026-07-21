import generateModule from '@babel/generator';
import { parse } from '@babel/parser';
import traverseModule, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import fs from 'node:fs';
import path from 'node:path';
import type { SupportedReactFrameworks } from '../types/index.js';

const generate = generateModule.default || generateModule;
const traverse = traverseModule.default || traverseModule;

const REACT_QUICKSTART_URL =
  'https://generaltranslation.com/docs/react/react-quickstart';
const REACT_ROUTER_CONFIG_FILES = [
  'react-router.config.ts',
  'react-router.config.js',
  'react-router.config.mts',
  'react-router.config.mjs',
  'react-router.config.cts',
  'react-router.config.cjs',
];
const REACT_ROUTER_ROOT_FILES = [
  'app/root.tsx',
  'app/root.jsx',
  'app/root.ts',
  'app/root.js',
];
const CUSTOM_SSR_ENTRY_FILES = [
  'entry.server.tsx',
  'entry.server.jsx',
  'entry-server.tsx',
  'entry-server.jsx',
  'src/entry.server.tsx',
  'src/entry.server.jsx',
  'src/entry-server.tsx',
  'src/entry-server.jsx',
  'app/entry.server.tsx',
  'app/entry.server.jsx',
];

type ReactRuntimeDetection =
  | { kind: 'spa' }
  | { kind: 'ssr'; framework: 'react-router'; rootPath: string }
  | { kind: 'unsupported-ssr'; reason: string }
  | { kind: 'unknown' };

export type SetupReactRuntimeResult = {
  filesUpdated: string[];
  warnings: string[];
};

function hasPackage(
  packageJson: Record<string, unknown>,
  packageName: string
): boolean {
  const dependencies = {
    ...(packageJson.dependencies as Record<string, string> | undefined),
    ...(packageJson.devDependencies as Record<string, string> | undefined),
  };
  return packageName in dependencies;
}

function findExistingFile(cwd: string, candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(cwd, candidate))) return candidate;
  }
  return null;
}

function getTranslationStorageMode(
  configPath: string
): 'local' | 'remote' | 'unknown' {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
      files?: { gt?: { output?: unknown } };
    };
    return typeof config.files?.gt?.output === 'string' ? 'local' : 'remote';
  } catch {
    return 'unknown';
  }
}

function getConfiguredReactRouterMode(
  configPath: string
): 'ssr' | 'spa' | 'default' | 'unknown' {
  let code: string;
  try {
    code = fs.readFileSync(configPath, 'utf8');
  } catch {
    return 'unknown';
  }

  try {
    const ast = parse(code, {
      sourceType: 'unambiguous',
      plugins: ['typescript'],
    });
    let mode: 'ssr' | 'spa' | 'default' | 'unknown' = 'default';
    traverse(ast, {
      ObjectProperty(propertyPath) {
        const key = propertyPath.node.key;
        const isSsrKey =
          (t.isIdentifier(key) && key.name === 'ssr') ||
          (t.isStringLiteral(key) && key.value === 'ssr');
        if (!isSsrKey) return;
        mode = t.isBooleanLiteral(propertyPath.node.value)
          ? propertyPath.node.value.value
            ? 'ssr'
            : 'spa'
          : 'unknown';
        propertyPath.stop();
      },
    });
    return mode;
  } catch {
    return 'unknown';
  }
}

export function detectReactRuntime(
  framework: SupportedReactFrameworks,
  packageJson: Record<string, unknown>,
  cwd: string = process.cwd()
): ReactRuntimeDetection {
  if (framework === 'next-app' || framework === 'next-pages') {
    return { kind: 'unknown' };
  }

  if (framework === 'gatsby') {
    return {
      kind: 'unsupported-ssr',
      reason:
        'Gatsby splits server and browser setup across framework-specific APIs that cannot be updated reliably without inspecting the application lifecycle.',
    };
  }
  if (framework === 'redwood') {
    return {
      kind: 'unsupported-ssr',
      reason:
        'RedwoodJS owns request loading and application hydration through framework-specific roots that the setup wizard cannot update reliably.',
    };
  }
  if (hasPackage(packageJson, '@remix-run/react')) {
    return {
      kind: 'unsupported-ssr',
      reason:
        'Remix loader composition varies by route and version, so adding request-locale data to an existing root loader is not safe to automate.',
    };
  }

  if (hasPackage(packageJson, '@react-router/dev')) {
    const config = findExistingFile(cwd, REACT_ROUTER_CONFIG_FILES);
    if (config) {
      const configuredMode = getConfiguredReactRouterMode(
        path.join(cwd, config)
      );
      if (configuredMode === 'spa') return { kind: 'spa' };
      if (configuredMode === 'unknown') {
        return {
          kind: 'unsupported-ssr',
          reason:
            'The React Router config determines ssr dynamically, so the setup wizard cannot tell whether the application renders on the server or only in the browser.',
        };
      }
    }

    const rootPath = findExistingFile(cwd, REACT_ROUTER_ROOT_FILES);
    return rootPath
      ? { kind: 'ssr', framework: 'react-router', rootPath }
      : {
          kind: 'unsupported-ssr',
          reason:
            'React Router framework mode is server-rendered by default, but no standard app/root file was found.',
        };
  }

  if (findExistingFile(cwd, CUSTOM_SSR_ENTRY_FILES)) {
    return {
      kind: 'unsupported-ssr',
      reason:
        'A server entry point was found, but custom SSR loaders and hydration entry points do not have a standard shape the setup wizard can update safely.',
    };
  }

  return framework === 'vite' ? { kind: 'spa' } : { kind: 'unknown' };
}

function toImportSpecifier(fromFile: string, targetFile: string): string {
  let relativePath = path
    .relative(path.dirname(fromFile), targetFile)
    .split(path.sep)
    .join(path.posix.sep);
  if (!relativePath.startsWith('.')) relativePath = `./${relativePath}`;
  return relativePath;
}

function addNamedImports(
  program: t.Program,
  source: string,
  importedNames: string[]
): void {
  const existingImport = program.body.find(
    (node): node is t.ImportDeclaration =>
      t.isImportDeclaration(node) &&
      node.source.value === source &&
      !node.specifiers.some((specifier) =>
        t.isImportNamespaceSpecifier(specifier)
      )
  );
  const existingNames = new Set(
    existingImport?.specifiers.flatMap((specifier) =>
      t.isImportSpecifier(specifier) &&
      t.isIdentifier(specifier.imported) &&
      specifier.local.name === specifier.imported.name
        ? [specifier.local.name]
        : []
    ) ?? []
  );
  const newSpecifiers = importedNames
    .filter((name) => !existingNames.has(name))
    .map((name) => t.importSpecifier(t.identifier(name), t.identifier(name)));

  if (existingImport) {
    existingImport.specifiers.push(...newSpecifiers);
    return;
  }
  program.body.unshift(
    t.importDeclaration(newSpecifiers, t.stringLiteral(source))
  );
}

function hasExportedLoader(program: t.Program): boolean {
  return program.body.some((node) => {
    if (!t.isExportNamedDeclaration(node)) return false;
    if (
      (t.isFunctionDeclaration(node.declaration) ||
        t.isVariableDeclaration(node.declaration)) &&
      node.declaration
    ) {
      if (t.isFunctionDeclaration(node.declaration)) {
        return node.declaration.id?.name === 'loader';
      }
      return node.declaration.declarations.some(
        (declaration) =>
          t.isIdentifier(declaration.id) && declaration.id.name === 'loader'
      );
    }
    return node.specifiers.some(
      (specifier) =>
        t.isExportSpecifier(specifier) &&
        t.isIdentifier(specifier.exported) &&
        specifier.exported.name === 'loader'
    );
  });
}

function hasGtSsrMarker(ast: t.File): boolean {
  let found = false;
  traverse(ast, {
    Identifier(identifierPath) {
      if (
        [
          'initializeGT',
          'getTranslationsSnapshot',
          'parseLocale',
          'GTProvider',
        ].includes(identifierPath.node.name)
      ) {
        found = true;
        identifierPath.stop();
      }
    },
  });
  return found;
}

function isCompleteGtSsrSetup(ast: t.File): boolean {
  const markers = new Set<string>();
  traverse(ast, {
    CallExpression(callPath) {
      if (t.isIdentifier(callPath.node.callee)) {
        markers.add(`call:${callPath.node.callee.name}`);
      }
    },
    JSXOpeningElement(elementPath) {
      if (t.isJSXIdentifier(elementPath.node.name, { name: 'GTProvider' })) {
        markers.add('provider:GTProvider');
        for (const attribute of elementPath.node.attributes) {
          if (
            t.isJSXAttribute(attribute) &&
            t.isJSXIdentifier(attribute.name)
          ) {
            markers.add(`prop:${attribute.name.name}`);
          }
        }
      }
    },
  });
  return [
    'call:initializeGT',
    'call:getTranslationsSnapshot',
    'call:parseLocale',
    'provider:GTProvider',
    'prop:locale',
    'prop:translations',
  ].every((marker) => markers.has(marker));
}

function findDefaultRootFunction(
  ast: t.File
): NodePath<t.FunctionDeclaration> | null {
  let rootFunction: NodePath<t.FunctionDeclaration> | null = null;
  traverse(ast, {
    ExportDefaultDeclaration(exportPath) {
      const declarationPath = exportPath.get('declaration');
      if (declarationPath.isFunctionDeclaration()) {
        rootFunction = declarationPath;
        exportPath.stop();
      }
    },
  });
  return rootFunction;
}

function findBindingConflict(
  ast: t.File,
  rootFunction: NodePath<t.FunctionDeclaration>
): string | null {
  let conflict: string | null = null;
  traverse(ast, {
    Program(programPath) {
      for (const name of ['gtConfig', 'loadTranslations', 'loader']) {
        if (programPath.scope.hasOwnBinding(name)) {
          conflict = name;
          programPath.stop();
          return;
        }
      }
      const useLoaderDataBinding =
        programPath.scope.getBinding('useLoaderData');
      const useLoaderDataImport = useLoaderDataBinding?.path.parentPath;
      if (
        useLoaderDataBinding &&
        (!useLoaderDataBinding.path.isImportSpecifier() ||
          !useLoaderDataImport?.isImportDeclaration() ||
          useLoaderDataImport.node.source.value !== 'react-router')
      ) {
        conflict = 'useLoaderData';
        programPath.stop();
      }
    },
  });
  if (conflict) return conflict;
  for (const name of ['locale', 'translations']) {
    if (rootFunction.scope.hasOwnBinding(name)) return name;
  }
  return null;
}

function getSingleReturn(
  functionPath: NodePath<t.FunctionDeclaration>
): NodePath<t.ReturnStatement> | null {
  const returns: NodePath<t.ReturnStatement>[] = [];
  functionPath.traverse({
    ReturnStatement(returnPath) {
      if (returnPath.getFunctionParent() === functionPath)
        returns.push(returnPath);
    },
  });
  return returns.length === 1 ? returns[0] : null;
}

function createFallbackWarning(reason: string, rootPath?: string): string {
  return createDiagnosticMessage({
    source: 'gt',
    severity: 'Warning',
    whatHappened:
      'The setup wizard could not safely automate the server-rendered gt-react runtime setup',
    why: reason,
    fix: 'In a root module loaded by both server and client, call initializeGT() with gt.config.json and, for local translation files, loadTranslations; then resolve each request with parseLocale(), load getTranslationsSnapshot(locale) in the framework loader, and pass both locale and translations to GTProvider.',
    wayOut:
      'Keep the existing application code unchanged and complete these steps manually.',
    details: rootPath ? [`Root file: ${rootPath}`] : undefined,
    docsUrl: REACT_QUICKSTART_URL,
  });
}

function createInitializationStatements(
  configImportPath: string,
  loaderImportPath?: string
): t.Statement[] {
  const statements: t.Statement[] = [
    t.importDeclaration(
      [t.importDefaultSpecifier(t.identifier('gtConfig'))],
      t.stringLiteral(configImportPath)
    ),
  ];
  if (loaderImportPath) {
    statements.push(
      t.importDeclaration(
        [t.importDefaultSpecifier(t.identifier('loadTranslations'))],
        t.stringLiteral(loaderImportPath)
      )
    );
  }
  statements.push(
    t.expressionStatement(
      t.callExpression(t.identifier('initializeGT'), [
        t.objectExpression([
          t.spreadElement(t.identifier('gtConfig')),
          ...(loaderImportPath
            ? [
                t.objectProperty(
                  t.identifier('loadTranslations'),
                  t.identifier('loadTranslations'),
                  false,
                  true
                ),
              ]
            : []),
        ]),
      ])
    )
  );
  return statements;
}

function createLoaderDeclaration(
  typescript: boolean
): t.ExportNamedDeclaration {
  const requestPattern = t.objectPattern([
    t.objectProperty(
      t.identifier('request'),
      t.identifier('request'),
      false,
      true
    ),
  ]);
  if (typescript) {
    requestPattern.typeAnnotation = t.tsTypeAnnotation(
      t.tsTypeLiteral([
        t.tsPropertySignature(
          t.identifier('request'),
          t.tsTypeAnnotation(t.tsTypeReference(t.identifier('Request')))
        ),
      ])
    );
  }
  const localeDeclaration = t.variableDeclaration('const', [
    t.variableDeclarator(
      t.identifier('locale'),
      t.callExpression(t.identifier('parseLocale'), [t.identifier('request')])
    ),
  ]);
  const returnStatement = t.returnStatement(
    t.objectExpression([
      t.objectProperty(
        t.identifier('locale'),
        t.identifier('locale'),
        false,
        true
      ),
      t.objectProperty(
        t.identifier('translations'),
        t.awaitExpression(
          t.callExpression(t.identifier('getTranslationsSnapshot'), [
            t.identifier('locale'),
          ])
        )
      ),
    ])
  );
  return t.exportNamedDeclaration(
    t.functionDeclaration(
      t.identifier('loader'),
      [requestPattern],
      t.blockStatement([localeDeclaration, returnStatement]),
      false,
      true
    )
  );
}

export function updateReactRouterSsrRoot({
  code,
  rootPath,
  configPath,
  loadTranslationsPath,
}: {
  code: string;
  rootPath: string;
  configPath: string;
  loadTranslationsPath?: string;
}): { code: string; changed: boolean; warning?: string } {
  let ast: t.File;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
  } catch (error) {
    return {
      code,
      changed: false,
      warning: createFallbackWarning(
        `The root module could not be parsed: ${String(error)}`,
        rootPath
      ),
    };
  }

  if (isCompleteGtSsrSetup(ast)) return { code, changed: false };
  if (hasGtSsrMarker(ast)) {
    return {
      code,
      changed: false,
      warning: createFallbackWarning(
        'The root module already contains part of a gt-react setup, and replacing or completing custom initialization could change application behavior.',
        rootPath
      ),
    };
  }
  if (hasExportedLoader(ast.program)) {
    return {
      code,
      changed: false,
      warning: createFallbackWarning(
        'The root route already exports a loader, and automatically merging locale resolution into arbitrary loader return data could overwrite user behavior.',
        rootPath
      ),
    };
  }

  const rootFunction = findDefaultRootFunction(ast);
  const returnPath = rootFunction ? getSingleReturn(rootFunction) : null;
  if (!rootFunction || !returnPath || !returnPath.node.argument) {
    return {
      code,
      changed: false,
      warning: createFallbackWarning(
        'The default root component is not a function with one explicit return, so the wizard cannot wrap it without risking a semantic change.',
        rootPath
      ),
    };
  }
  const bindingConflict = findBindingConflict(ast, rootFunction);
  if (bindingConflict) {
    return {
      code,
      changed: false,
      warning: createFallbackWarning(
        `The root module already declares "${bindingConflict}", which the generated SSR setup would also need to declare.`,
        rootPath
      ),
    };
  }

  addNamedImports(ast.program, 'gt-react', [
    'GTProvider',
    'getTranslationsSnapshot',
    'initializeGT',
    'parseLocale',
  ]);
  addNamedImports(ast.program, 'react-router', ['useLoaderData']);

  let lastImportIndex = -1;
  for (const [index, node] of ast.program.body.entries()) {
    if (t.isImportDeclaration(node)) lastImportIndex = index;
  }
  ast.program.body.splice(
    lastImportIndex + 1,
    0,
    ...createInitializationStatements(
      toImportSpecifier(rootPath, configPath),
      loadTranslationsPath
        ? toImportSpecifier(rootPath, loadTranslationsPath)
        : undefined
    ),
    createLoaderDeclaration(/\.[cm]?tsx?$/.test(rootPath))
  );

  const useLoaderDataCall = t.callExpression(t.identifier('useLoaderData'), []);
  if (/\.[cm]?tsx?$/.test(rootPath)) {
    useLoaderDataCall.typeParameters = t.tsTypeParameterInstantiation([
      t.tsTypeQuery(t.identifier('loader')),
    ]);
  }
  rootFunction.node.body.body.unshift(
    t.variableDeclaration('const', [
      t.variableDeclarator(
        t.objectPattern([
          t.objectProperty(
            t.identifier('locale'),
            t.identifier('locale'),
            false,
            true
          ),
          t.objectProperty(
            t.identifier('translations'),
            t.identifier('translations'),
            false,
            true
          ),
        ]),
        useLoaderDataCall
      ),
    ])
  );
  const previousReturnValue = returnPath.node.argument;
  returnPath.node.argument = t.jsxElement(
    t.jsxOpeningElement(
      t.jsxIdentifier('GTProvider'),
      [
        t.jsxAttribute(
          t.jsxIdentifier('locale'),
          t.jsxExpressionContainer(t.identifier('locale'))
        ),
        t.jsxAttribute(
          t.jsxIdentifier('translations'),
          t.jsxExpressionContainer(t.identifier('translations'))
        ),
      ],
      false
    ),
    t.jsxClosingElement(t.jsxIdentifier('GTProvider')),
    t.isJSXElement(previousReturnValue) || t.isJSXFragment(previousReturnValue)
      ? [previousReturnValue]
      : [t.jsxExpressionContainer(previousReturnValue)],
    false
  );

  return {
    code: generate(
      ast,
      { comments: true, jsescOption: { quotes: 'single' } },
      code
    ).code,
    changed: true,
  };
}

export async function setupReactRuntime({
  framework,
  packageJson,
  translationStorage,
  configPath = 'gt.config.json',
  cwd = process.cwd(),
}: {
  framework: SupportedReactFrameworks;
  packageJson: Record<string, unknown>;
  translationStorage?: 'local' | 'remote';
  configPath?: string;
  cwd?: string;
}): Promise<SetupReactRuntimeResult> {
  const detection = detectReactRuntime(framework, packageJson, cwd);
  if (detection.kind === 'spa' || detection.kind === 'unknown') {
    return { filesUpdated: [], warnings: [] };
  }
  if (detection.kind === 'unsupported-ssr') {
    return {
      filesUpdated: [],
      warnings: [createFallbackWarning(detection.reason)],
    };
  }

  const absoluteRootPath = path.join(cwd, detection.rootPath);
  const absoluteConfigPath = path.resolve(cwd, configPath);
  const storageMode =
    translationStorage ?? getTranslationStorageMode(absoluteConfigPath);
  if (storageMode === 'unknown') {
    return {
      filesUpdated: [],
      warnings: [
        createFallbackWarning(
          `The finalized GT config could not be read at ${configPath}.`,
          detection.rootPath
        ),
      ],
    };
  }
  const expectedLoadTranslationsPath = fs.existsSync(path.join(cwd, 'src'))
    ? path.join(cwd, 'src', 'loadTranslations.js')
    : path.join(cwd, 'loadTranslations.js');
  if (storageMode === 'local' && !fs.existsSync(expectedLoadTranslationsPath)) {
    return {
      filesUpdated: [],
      warnings: [
        createFallbackWarning(
          `The GT config uses local translation output, but ${path.relative(
            cwd,
            expectedLoadTranslationsPath
          )} was not found.`,
          detection.rootPath
        ),
      ],
    };
  }
  const loadTranslationsPath =
    storageMode === 'local' ? expectedLoadTranslationsPath : undefined;
  let originalCode: string;
  try {
    originalCode = await fs.promises.readFile(absoluteRootPath, 'utf8');
  } catch (error) {
    return {
      filesUpdated: [],
      warnings: [
        createFallbackWarning(
          `The root module could not be read: ${String(error)}`,
          detection.rootPath
        ),
      ],
    };
  }
  const result = updateReactRouterSsrRoot({
    code: originalCode,
    rootPath: absoluteRootPath,
    configPath: absoluteConfigPath,
    loadTranslationsPath,
  });
  if (!result.changed) {
    return {
      filesUpdated: [],
      warnings: result.warning ? [result.warning] : [],
    };
  }

  try {
    await fs.promises.writeFile(absoluteRootPath, result.code);
  } catch (error) {
    return {
      filesUpdated: [],
      warnings: [
        createFallbackWarning(
          `The updated root module could not be written: ${String(error)}`,
          detection.rootPath
        ),
      ],
    };
  }
  return { filesUpdated: [detection.rootPath], warnings: [] };
}
