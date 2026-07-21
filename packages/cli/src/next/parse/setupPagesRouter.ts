import generateModule from '@babel/generator';
import { parse } from '@babel/parser';
import traverseModule, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/internal';
import fs from 'node:fs';
import path from 'node:path';
import { matchFiles } from '../../fs/matchFiles.js';

const traverse = traverseModule.default || traverseModule;
const generate = generateModule.default || generateModule;

const PAGES_ROUTER_QUICKSTART_URL =
  'https://generaltranslation.com/docs/react/nextjs-pages-router-quickstart';
const PAGES_ROUTER_SSG_URL =
  'https://generaltranslation.com/docs/react/nextjs/pages-router-static-site-generation';

type TransformResult = {
  code: string;
  modified: boolean;
  warning?: string;
};

type DataFetchingExport = 'getServerSideProps' | 'getStaticProps';

const DATA_FETCHING_HELPERS: Record<DataFetchingExport, string> = {
  getServerSideProps: 'withGTServerSideProps',
  getStaticProps: 'withGTStaticProps',
};

function parseModule(code: string) {
  return parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
    tokens: true,
    createParenthesizedExpressions: true,
  });
}

function printModule(ast: ReturnType<typeof parse>, code: string): string {
  return generate(
    ast,
    {
      retainLines: true,
      retainFunctionParens: true,
      comments: true,
      compact: 'auto',
    },
    code
  ).code;
}

/**
 * Conservatively confirm that an exported Next.js config enables Pages Router
 * locale routing. Ambiguous wrapper functions and imported config values are
 * intentionally left for manual review before getStaticProps is changed.
 */
export function hasPagesRouterLocaleRouting(code: string): boolean {
  let ast: ReturnType<typeof parse>;
  try {
    ast = parseModule(code);
  } catch {
    return false;
  }

  const initializers = new Map<string, t.Expression>();
  for (const statement of ast.program.body) {
    if (!t.isVariableDeclaration(statement)) continue;
    for (const declaration of statement.declarations) {
      if (
        t.isIdentifier(declaration.id) &&
        declaration.init &&
        t.isExpression(declaration.init)
      ) {
        initializers.set(declaration.id.name, declaration.init);
      }
    }
  }

  const resolveObject = (
    expression: t.Expression,
    seen = new Set<string>()
  ): t.ObjectExpression | undefined => {
    let current = expression;
    while (
      t.isParenthesizedExpression(current) ||
      t.isTSAsExpression(current) ||
      t.isTSSatisfiesExpression(current) ||
      t.isTypeCastExpression(current)
    ) {
      current = current.expression;
    }
    if (t.isObjectExpression(current)) return current;
    if (t.isIdentifier(current)) {
      if (seen.has(current.name)) return undefined;
      const initializer = initializers.get(current.name);
      if (!initializer) return undefined;
      return resolveObject(initializer, new Set([...seen, current.name]));
    }
    if (
      t.isCallExpression(current) &&
      t.isIdentifier(current.callee, { name: 'withGTConfig' }) &&
      current.arguments[0] &&
      t.isExpression(current.arguments[0])
    ) {
      return resolveObject(current.arguments[0], seen);
    }
    return undefined;
  };

  const exportedExpressions: t.Expression[] = [];
  for (const statement of ast.program.body) {
    if (
      t.isExportDefaultDeclaration(statement) &&
      t.isExpression(statement.declaration)
    ) {
      exportedExpressions.push(statement.declaration);
    }
    if (
      t.isExpressionStatement(statement) &&
      t.isAssignmentExpression(statement.expression) &&
      t.isMemberExpression(statement.expression.left) &&
      t.isIdentifier(statement.expression.left.object, { name: 'module' }) &&
      t.isIdentifier(statement.expression.left.property, { name: 'exports' }) &&
      t.isExpression(statement.expression.right)
    ) {
      exportedExpressions.push(statement.expression.right);
    }
  }

  return exportedExpressions.some((expression) => {
    const config = resolveObject(expression);
    if (!config) return false;
    const i18nProperty = config.properties.find(
      (property): property is t.ObjectProperty =>
        t.isObjectProperty(property) &&
        ((t.isIdentifier(property.key) && property.key.name === 'i18n') ||
          (t.isStringLiteral(property.key) && property.key.value === 'i18n'))
    );
    if (!i18nProperty || !t.isExpression(i18nProperty.value)) return false;
    const i18nConfig = resolveObject(i18nProperty.value);
    if (!i18nConfig) return false;
    const keys = new Set(
      i18nConfig.properties.flatMap((property) => {
        if (!t.isObjectProperty(property)) return [];
        if (t.isIdentifier(property.key)) return [property.key.name];
        if (t.isStringLiteral(property.key)) return [property.key.value];
        return [];
      })
    );
    return keys.has('locales') && keys.has('defaultLocale');
  });
}

function importedName(specifier: t.ImportSpecifier): string {
  return t.isIdentifier(specifier.imported)
    ? specifier.imported.name
    : specifier.imported.value;
}

function findNamedImport(
  ast: ReturnType<typeof parse>,
  source: string,
  name: string
): t.ImportSpecifier | undefined {
  for (const statement of ast.program.body) {
    if (
      !t.isImportDeclaration(statement) ||
      statement.source.value !== source
    ) {
      continue;
    }
    const specifier = statement.specifiers.find(
      (candidate): candidate is t.ImportSpecifier =>
        t.isImportSpecifier(candidate) && importedName(candidate) === name
    );
    if (specifier) return specifier;
  }
  return undefined;
}

function hasProgramBinding(
  ast: ReturnType<typeof parse>,
  name: string
): boolean {
  let hasBinding = false;
  traverse(ast, {
    Program(programPath) {
      hasBinding = programPath.scope.hasBinding(name);
      programPath.stop();
    },
  });
  return hasBinding;
}

function getAvailableLocalName(
  ast: ReturnType<typeof parse>,
  preferredName: string
): string {
  if (!hasProgramBinding(ast, preferredName)) return preferredName;
  const baseName = `GT${preferredName}`;
  let candidate = baseName;
  let suffix = 2;
  while (hasProgramBinding(ast, candidate)) {
    candidate = `${baseName}${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function ensureNamedImport(
  ast: ReturnType<typeof parse>,
  source: string,
  name: string,
  options: { typeOnly?: boolean; preferredLocalName?: string } = {}
): string {
  const existing = findNamedImport(ast, source, name);
  if (existing) return existing.local.name;

  const localName = getAvailableLocalName(
    ast,
    options.preferredLocalName || name
  );
  const specifier = t.importSpecifier(
    t.identifier(localName),
    t.identifier(name)
  );
  if (options.typeOnly) specifier.importKind = 'type';

  const declaration = ast.program.body.find(
    (statement): statement is t.ImportDeclaration =>
      t.isImportDeclaration(statement) && statement.source.value === source
  );
  if (declaration) {
    declaration.specifiers.push(specifier);
  } else {
    const importDeclaration = t.importDeclaration(
      [specifier],
      t.stringLiteral(source)
    );
    let lastImportIndex = -1;
    ast.program.body.forEach((statement, index) => {
      if (t.isImportDeclaration(statement)) lastImportIndex = index;
    });
    ast.program.body.splice(lastImportIndex + 1, 0, importDeclaration);
  }
  return localName;
}

function migrateLegacyProviderImport(
  ast: ReturnType<typeof parse>
): string | undefined {
  for (const statement of ast.program.body) {
    if (
      !t.isImportDeclaration(statement) ||
      statement.source.value !== 'gt-react'
    ) {
      continue;
    }
    const providerSpecifier = statement.specifiers.find(
      (specifier): specifier is t.ImportSpecifier =>
        t.isImportSpecifier(specifier) &&
        importedName(specifier) === 'GTProvider'
    );
    if (!providerSpecifier) continue;

    statement.specifiers = statement.specifiers.filter(
      (specifier) => specifier !== providerSpecifier
    );
    if (statement.specifiers.length === 0) {
      ast.program.body = ast.program.body.filter(
        (candidate) => candidate !== statement
      );
    }
    return ensureNamedImport(ast, 'gt-next', 'GTProvider', {
      preferredLocalName: providerSpecifier.local.name,
    });
  }
  return undefined;
}

function getJsxName(element: t.JSXElement): string | undefined {
  return t.isJSXIdentifier(element.openingElement.name)
    ? element.openingElement.name.name
    : undefined;
}

function hasJsxAttribute(element: t.JSXElement, name: string): boolean {
  return element.openingElement.attributes.some(
    (attribute) =>
      t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name, { name })
  );
}

function addExpressionAttribute(
  element: t.JSXElement,
  name: string,
  value: string
): void {
  if (hasJsxAttribute(element, name)) return;
  element.openingElement.attributes.push(
    t.jsxAttribute(
      t.jsxIdentifier(name),
      t.jsxExpressionContainer(t.identifier(value))
    )
  );
}

function containsTypeReference(node: t.TSType, name: string): boolean {
  if (t.isTSTypeReference(node) && t.isIdentifier(node.typeName, { name })) {
    return true;
  }
  if (t.isTSIntersectionType(node) || t.isTSUnionType(node)) {
    return node.types.some((part) => containsTypeReference(part, name));
  }
  return false;
}

function addPagePropsType(
  ast: ReturnType<typeof parse>,
  injectedTypeName: string
): boolean {
  let modified = false;
  traverse(ast, {
    TSTypeReference(referencePath) {
      if (!t.isIdentifier(referencePath.node.typeName, { name: 'AppProps' })) {
        return;
      }
      const injectedType = t.tsTypeReference(t.identifier(injectedTypeName));
      const existingType = referencePath.node.typeParameters?.params[0];
      if (!existingType) {
        referencePath.node.typeParameters = t.tsTypeParameterInstantiation([
          injectedType,
        ]);
        modified = true;
        return;
      }
      if (containsTypeReference(existingType, injectedTypeName)) return;
      referencePath.node.typeParameters = t.tsTypeParameterInstantiation([
        t.tsIntersectionType([existingType, injectedType]),
      ]);
      modified = true;
    },
  });
  return modified;
}

function removeLegacyConfigSpread(
  ast: ReturnType<typeof parse>,
  providerElement: t.JSXElement
): void {
  const removedNames = new Set<string>();
  providerElement.openingElement.attributes =
    providerElement.openingElement.attributes.filter((attribute) => {
      if (
        t.isJSXSpreadAttribute(attribute) &&
        t.isIdentifier(attribute.argument)
      ) {
        const bindingName = attribute.argument.name;
        const isConfigImport = ast.program.body.some(
          (statement) =>
            t.isImportDeclaration(statement) &&
            /(?:^|\/)gt\.config\.json$/.test(statement.source.value) &&
            statement.specifiers.some(
              (specifier) =>
                t.isImportDefaultSpecifier(specifier) &&
                specifier.local.name === bindingName
            )
        );
        if (isConfigImport) {
          removedNames.add(bindingName);
          return false;
        }
      }
      return true;
    });

  if (removedNames.size === 0) return;
  const stillReferenced = new Set<string>();
  traverse(ast, {
    ReferencedIdentifier(identifierPath) {
      if (removedNames.has(identifierPath.node.name)) {
        stillReferenced.add(identifierPath.node.name);
      }
    },
  });
  ast.program.body = ast.program.body.filter((statement) => {
    if (
      !t.isImportDeclaration(statement) ||
      !/(?:^|\/)gt\.config\.json$/.test(statement.source.value)
    ) {
      return true;
    }
    statement.specifiers = statement.specifiers.filter(
      (specifier) =>
        !removedNames.has(specifier.local.name) ||
        stillReferenced.has(specifier.local.name)
    );
    return statement.specifiers.length > 0;
  });
}

function createAppWarning(filepath: string, why: string): string {
  return createDiagnosticMessage({
    whatHappened: `The setup wizard could not safely wire GTProvider in ${filepath}`,
    why,
    fix: 'Update pages/_app so it passes pageProps.locale and pageProps.translations to GTProvider from gt-next, then pass the remaining page props to Component',
    docsUrl: PAGES_ROUTER_QUICKSTART_URL,
  });
}

function createPageWarning(
  filepath: string,
  exportName: DataFetchingExport | 'getInitialProps',
  why: string
): string {
  const helper =
    exportName === 'getInitialProps'
      ? 'withGTServerSideProps'
      : DATA_FETCHING_HELPERS[exportName];
  const dataFetchingName =
    exportName === 'getInitialProps' ? 'the page data loader' : exportName;
  return createDiagnosticMessage({
    whatHappened: `The setup wizard could not safely add GT locale and translation props to ${filepath}`,
    why,
    fix: `Wrap ${dataFetchingName} with ${helper} and export the wrapped result from this page`,
    docsUrl:
      exportName === 'getStaticProps'
        ? PAGES_ROUTER_SSG_URL
        : PAGES_ROUTER_QUICKSTART_URL,
  });
}

/**
 * Wire a Pages Router custom App to the locale and translation props injected by
 * gt-next's data-fetching helpers. Returns a warning instead of guessing when
 * the App does not use the conventional Component/pageProps shape.
 */
export function transformPagesRouterApp(
  code: string,
  filepath: string
): TransformResult {
  const ast = parseModule(code);
  const legacyProviderLocalName = migrateLegacyProviderImport(ast);
  const providerLocalName =
    legacyProviderLocalName ||
    findNamedImport(ast, 'gt-next', 'GTProvider')?.local.name ||
    getAvailableLocalName(ast, 'GTProvider');

  let componentPath: NodePath<t.JSXElement> | undefined;
  let appFunctionPath: NodePath<t.Function> | undefined;
  let componentUsesRestPageProps = false;
  traverse(ast, {
    JSXElement(jsxPath) {
      if (componentPath || getJsxName(jsxPath.node) !== 'Component') return;
      const pagePropsSpread = jsxPath.node.openingElement.attributes.some(
        (attribute) =>
          t.isJSXSpreadAttribute(attribute) &&
          t.isIdentifier(attribute.argument) &&
          (attribute.argument.name === 'pageProps' ||
            attribute.argument.name === 'restPageProps')
      );
      if (!pagePropsSpread) return;
      componentUsesRestPageProps = jsxPath.node.openingElement.attributes.some(
        (attribute) =>
          t.isJSXSpreadAttribute(attribute) &&
          t.isIdentifier(attribute.argument, { name: 'restPageProps' })
      );
      const functionPath = jsxPath.findParent((candidate) =>
        candidate.isFunction()
      ) as NodePath<t.Function> | null;
      if (!functionPath) return;
      componentPath = jsxPath;
      appFunctionPath = functionPath;
    },
  });

  if (!componentPath || !appFunctionPath) {
    return {
      code,
      modified: false,
      warning: createAppWarning(
        filepath,
        'the custom App does not render <Component {...pageProps} /> inside a function component'
      ),
    };
  }
  if (!t.isBlockStatement(appFunctionPath.node.body)) {
    return {
      code,
      modified: false,
      warning: createAppWarning(
        filepath,
        'the custom App uses an implicit-return function that cannot be extended without restructuring application code'
      ),
    };
  }

  const hasPagePropsBinding = Boolean(
    appFunctionPath.scope.getBinding('pageProps')
  );
  if (!hasPagePropsBinding) {
    return {
      code,
      modified: false,
      warning: createAppWarning(
        filepath,
        'pageProps is not a local binding in the component that renders the page'
      ),
    };
  }

  let hasPropsDeclaration = false;
  for (const statement of appFunctionPath.node.body.body) {
    if (!t.isVariableDeclaration(statement)) continue;
    for (const declaration of statement.declarations) {
      if (!t.isObjectPattern(declaration.id)) continue;
      const names = declaration.id.properties.map((property) => {
        if (t.isRestElement(property) && t.isIdentifier(property.argument)) {
          return property.argument.name;
        }
        return t.isObjectProperty(property) && t.isIdentifier(property.key)
          ? property.key.name
          : undefined;
      });
      if (
        t.isIdentifier(declaration.init, { name: 'pageProps' }) &&
        names.includes('locale') &&
        names.includes('translations') &&
        names.includes('restPageProps')
      ) {
        hasPropsDeclaration = true;
      }
    }
  }

  const existingProviderPath = componentPath.findParent(
    (candidate) =>
      candidate.isJSXElement() &&
      getJsxName(candidate.node) === providerLocalName
  ) as NodePath<t.JSXElement> | null;
  if (
    !legacyProviderLocalName &&
    componentUsesRestPageProps &&
    hasPropsDeclaration &&
    existingProviderPath &&
    hasJsxAttribute(existingProviderPath.node, 'locale') &&
    hasJsxAttribute(existingProviderPath.node, 'translations') &&
    findNamedImport(ast, 'gt-next', 'GTProvider')
  ) {
    return { code, modified: false };
  }

  if (!hasPropsDeclaration) {
    const appFunctionScope = appFunctionPath.scope;
    const conflictingBinding = ['locale', 'translations', 'restPageProps'].find(
      (name) => appFunctionScope.hasBinding(name)
    );
    if (conflictingBinding) {
      return {
        code,
        modified: false,
        warning: createAppWarning(
          filepath,
          `the custom App already defines ${conflictingBinding}, so adding the standard page-props bindings could change application behavior`
        ),
      };
    }
    appFunctionPath.node.body.body.unshift(
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
            t.restElement(t.identifier('restPageProps')),
          ]),
          t.identifier('pageProps')
        ),
      ])
    );
  }

  componentPath.node.openingElement.attributes =
    componentPath.node.openingElement.attributes.map((attribute) =>
      t.isJSXSpreadAttribute(attribute) &&
      t.isIdentifier(attribute.argument, { name: 'pageProps' })
        ? t.jsxSpreadAttribute(t.identifier('restPageProps'))
        : attribute
    );

  let providerElement: t.JSXElement;
  if (existingProviderPath) {
    providerElement = existingProviderPath.node;
  } else {
    providerElement = t.jsxElement(
      t.jsxOpeningElement(t.jsxIdentifier(providerLocalName), [], false),
      t.jsxClosingElement(t.jsxIdentifier(providerLocalName)),
      [t.cloneNode(componentPath.node, true)],
      false
    );
    componentPath.replaceWith(providerElement);
  }
  removeLegacyConfigSpread(ast, providerElement);
  addExpressionAttribute(providerElement, 'locale', 'locale');
  addExpressionAttribute(providerElement, 'translations', 'translations');

  ensureNamedImport(ast, 'gt-next', 'GTProvider', {
    preferredLocalName: providerLocalName,
  });
  const injectedTypeName =
    findNamedImport(ast, 'gt-next', 'WithGTServerSideProps')?.local.name ||
    getAvailableLocalName(ast, 'WithGTServerSideProps');
  const appPropsTypeAdded = addPagePropsType(ast, injectedTypeName);
  if (appPropsTypeAdded) {
    ensureNamedImport(ast, 'gt-next', 'WithGTServerSideProps', {
      typeOnly: true,
      preferredLocalName: injectedTypeName,
    });
  }

  const transformedCode = printModule(ast, code);
  return {
    code: transformedCode,
    modified: transformedCode !== code,
  };
}

function getExportedDataFetchingDeclarations(
  ast: ReturnType<typeof parse>
): Map<DataFetchingExport, NodePath<t.ExportNamedDeclaration>> {
  const exports = new Map<
    DataFetchingExport,
    NodePath<t.ExportNamedDeclaration>
  >();
  traverse(ast, {
    ExportNamedDeclaration(exportPath) {
      const declaration = exportPath.node.declaration;
      if (t.isFunctionDeclaration(declaration) && declaration.id) {
        if (
          declaration.id.name === 'getServerSideProps' ||
          declaration.id.name === 'getStaticProps'
        ) {
          exports.set(declaration.id.name, exportPath);
        }
        return;
      }
      if (t.isVariableDeclaration(declaration)) {
        for (const variable of declaration.declarations) {
          if (
            t.isIdentifier(variable.id) &&
            (variable.id.name === 'getServerSideProps' ||
              variable.id.name === 'getStaticProps')
          ) {
            exports.set(variable.id.name, exportPath);
          }
        }
      }
      for (const specifier of exportPath.node.specifiers) {
        if (
          t.isExportSpecifier(specifier) &&
          t.isIdentifier(specifier.exported) &&
          (specifier.exported.name === 'getServerSideProps' ||
            specifier.exported.name === 'getStaticProps')
        ) {
          exports.set(specifier.exported.name, exportPath);
        }
      }
    },
  });
  return exports;
}

function isHelperCall(
  expression: t.Expression,
  helperName: string,
  helperLocalName: string | undefined
): boolean {
  return (
    t.isCallExpression(expression) &&
    t.isIdentifier(expression.callee) &&
    (expression.callee.name === helperName ||
      expression.callee.name === helperLocalName)
  );
}

function hasGetInitialProps(ast: ReturnType<typeof parse>): boolean {
  let found = false;
  traverse(ast, {
    AssignmentExpression(assignmentPath) {
      if (
        t.isMemberExpression(assignmentPath.node.left) &&
        t.isIdentifier(assignmentPath.node.left.property, {
          name: 'getInitialProps',
        })
      ) {
        found = true;
        assignmentPath.stop();
      }
    },
  });
  return found;
}

/** Add the appropriate gt-next wrapper to one Pages Router page module. */
export function transformPagesRouterPage(
  code: string,
  filepath: string,
  options: {
    hasStaticLocaleRouting?: boolean;
    requiresStaticGeneration?: boolean;
  } = {}
): TransformResult {
  const ast = parseModule(code);
  const dataFetchingExports = getExportedDataFetchingDeclarations(ast);
  if (dataFetchingExports.size > 1) {
    return {
      code,
      modified: false,
      warning: createPageWarning(
        filepath,
        'getServerSideProps',
        'the page exports both getServerSideProps and getStaticProps'
      ),
    };
  }

  const entry = dataFetchingExports.entries().next().value as
    | [DataFetchingExport, NodePath<t.ExportNamedDeclaration>]
    | undefined;
  if (!entry) {
    if (hasGetInitialProps(ast)) {
      return {
        code,
        modified: false,
        warning: createPageWarning(
          filepath,
          'getInitialProps',
          'the page uses legacy getInitialProps, whose lifecycle cannot be replaced automatically'
        ),
      };
    }
    if (options.requiresStaticGeneration && !options.hasStaticLocaleRouting) {
      return {
        code,
        modified: false,
        warning: createPageWarning(
          filepath,
          'getStaticProps',
          'custom 404 and 500 pages must remain statically generated, but the wizard could not confirm Pages Router locale routing in the existing Next.js config'
        ),
      };
    }
    const exportName = options.requiresStaticGeneration
      ? 'getStaticProps'
      : 'getServerSideProps';
    const helperLocalName = ensureNamedImport(
      ast,
      'gt-next',
      DATA_FETCHING_HELPERS[exportName]
    );
    ast.program.body.push(
      t.exportNamedDeclaration(
        t.variableDeclaration('const', [
          t.variableDeclarator(
            t.identifier(exportName),
            t.callExpression(t.identifier(helperLocalName), [])
          ),
        ])
      )
    );
    return { code: printModule(ast, code), modified: true };
  }

  const [exportName, exportPath] = entry;
  const helperName = DATA_FETCHING_HELPERS[exportName];
  const existingHelperLocalName = findNamedImport(ast, 'gt-next', helperName)
    ?.local.name;
  const declaration = exportPath.node.declaration;
  if (!t.isVariableDeclaration(declaration)) {
    return {
      code,
      modified: false,
      warning: createPageWarning(
        filepath,
        exportName,
        `${exportName} is not an initialized exported const`
      ),
    };
  }
  const variable = declaration.declarations.find(
    (candidate) =>
      t.isIdentifier(candidate.id) && candidate.id.name === exportName
  );
  if (!variable?.init || !t.isExpression(variable.init)) {
    return {
      code,
      modified: false,
      warning: createPageWarning(
        filepath,
        exportName,
        `${exportName} does not have an expression the wizard can wrap without restructuring the module`
      ),
    };
  }
  if (isHelperCall(variable.init, helperName, existingHelperLocalName)) {
    return { code, modified: false };
  }
  if (exportName === 'getStaticProps' && !options.hasStaticLocaleRouting) {
    return {
      code,
      modified: false,
      warning: createPageWarning(
        filepath,
        exportName,
        'withGTStaticProps requires Pages Router locale routing, which the wizard could not confirm in the existing Next.js config'
      ),
    };
  }

  const helperLocalName = ensureNamedImport(ast, 'gt-next', helperName);
  variable.init = t.callExpression(t.identifier(helperLocalName), [
    variable.init,
  ]);
  return { code: printModule(ast, code), modified: true };
}

function isSpecialPagesFile(filepath: string, pagesDirectory: string): boolean {
  const relativePath = path.relative(pagesDirectory, filepath);
  const segments = relativePath.split(path.sep);
  return (
    segments[0] === 'api' ||
    path.basename(filepath).startsWith('_') ||
    filepath.endsWith('.d.ts')
  );
}

function isCustomErrorPage(filepath: string, pagesDirectory: string): boolean {
  const relativePath = path.relative(pagesDirectory, filepath);
  return (
    !relativePath.includes(path.sep) &&
    ['404', '500'].includes(path.parse(relativePath).name)
  );
}

function defaultAppContents(useTypeScript: boolean): string {
  if (!useTypeScript) {
    return `import { GTProvider } from 'gt-next';

export default function App({ Component, pageProps }) {
  const { locale, translations, ...restPageProps } = pageProps;

  return (
    <GTProvider locale={locale} translations={translations}>
      <Component {...restPageProps} />
    </GTProvider>
  );
}
`;
  }
  return `import type { AppProps } from 'next/app';
import { GTProvider, type WithGTServerSideProps } from 'gt-next';

export default function App({
  Component,
  pageProps,
}: AppProps<WithGTServerSideProps>) {
  const { locale, translations, ...restPageProps } = pageProps;

  return (
    <GTProvider locale={locale} translations={translations}>
      <Component {...restPageProps} />
    </GTProvider>
  );
}
`;
}

export async function setupPagesRouter(
  pagesDirectory: string,
  errors: string[],
  warnings: string[],
  options: { hasStaticLocaleRouting?: boolean } = {}
): Promise<{ filesUpdated: string[] }> {
  const filesUpdated: string[] = [];
  const appCandidates = ['_app.tsx', '_app.ts', '_app.jsx', '_app.js'].map(
    (filename) => path.join(pagesDirectory, filename)
  );
  let appPath = appCandidates.find((candidate) => fs.existsSync(candidate));

  try {
    if (!appPath) {
      const useTypeScript = fs.existsSync(
        path.join(process.cwd(), 'tsconfig.json')
      );
      appPath = path.join(
        pagesDirectory,
        useTypeScript ? '_app.tsx' : '_app.jsx'
      );
      await fs.promises.writeFile(appPath, defaultAppContents(useTypeScript));
      filesUpdated.push(appPath);
    } else {
      const original = await fs.promises.readFile(appPath, 'utf8');
      const result = transformPagesRouterApp(original, appPath);
      if (result.warning) warnings.push(result.warning);
      if (result.modified && result.code !== original) {
        await fs.promises.writeFile(appPath, result.code);
        filesUpdated.push(appPath);
      }
    }
  } catch (error) {
    errors.push(
      createDiagnosticMessage({
        whatHappened: `The setup wizard could not update ${appPath || 'pages/_app'}`,
        fix: 'Update the custom App manually using the Pages Router quickstart',
        details: formatDiagnosticErrorDetails(error),
        docsUrl: PAGES_ROUTER_QUICKSTART_URL,
      })
    );
  }

  const pageFiles = matchFiles(pagesDirectory, ['**/*.{js,jsx,ts,tsx}']);
  for (const filepath of pageFiles) {
    if (filepath === appPath || isSpecialPagesFile(filepath, pagesDirectory)) {
      continue;
    }
    try {
      const original = await fs.promises.readFile(filepath, 'utf8');
      const result = transformPagesRouterPage(original, filepath, {
        ...options,
        requiresStaticGeneration: isCustomErrorPage(filepath, pagesDirectory),
      });
      if (result.warning) warnings.push(result.warning);
      if (result.modified && result.code !== original) {
        await fs.promises.writeFile(filepath, result.code);
        filesUpdated.push(filepath);
      }
    } catch (error) {
      errors.push(
        createDiagnosticMessage({
          whatHappened: `The setup wizard could not update ${filepath}`,
          fix: 'Wrap the page data-fetching export manually with the matching gt-next helper',
          details: formatDiagnosticErrorDetails(error),
          docsUrl: PAGES_ROUTER_QUICKSTART_URL,
        })
      );
    }
  }

  return { filesUpdated };
}
