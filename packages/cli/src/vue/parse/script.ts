import { parse, type ParserPlugin } from '@babel/parser';
import traverseModule, { type Binding, type Scope } from '@babel/traverse';
import type * as t from '@babel/types';
import { processVueStringCall } from './stringCalls.js';
import type {
  GTComponentName,
  StringFunctionKind,
  TemplateBindings,
  VueExtractionContext,
} from './types.js';
import { addVueError, babelLocation } from './utils.js';

const traverse = traverseModule.default || traverseModule;

const COMPONENT_IMPORTS = new Set<GTComponentName>([
  'T',
  'Var',
  'Num',
  'DateTime',
  'Currency',
  'Plural',
  'Branch',
]);

type HookKind = Exclude<StringFunctionKind, 'msg'>;

export function parseVueScript(
  source: string,
  language: string | undefined,
  context: VueExtractionContext,
  templateBindings: TemplateBindings,
  exposeToTemplate: boolean
): void {
  if (!source.trim()) return;

  let ast: t.File;
  try {
    ast = parse(source, {
      plugins: getParserPlugins(language),
      sourceType: 'module',
    });
  } catch (error) {
    const syntaxError = error as SyntaxError & {
      loc?: { column: number; line: number };
    };
    addVueError(
      context,
      syntaxError.loc
        ? {
            start: {
              column: syntaxError.loc.column + 1,
              line: syntaxError.loc.line,
              offset: 0,
            },
            end: {
              column: syntaxError.loc.column + 1,
              line: syntaxError.loc.line,
              offset: 0,
            },
          }
        : undefined,
      `Could not parse a gt-vue script block: ${syntaxError.message}`,
      'Fix the script syntax before extracting translations'
    );
    return;
  }

  const hookBindings = new Map<Binding, HookKind>();
  const stringBindings = new Map<Binding, StringFunctionKind>();
  const componentBindings = new Map<Binding, GTComponentName>();
  const defineComponentBindings = new Set<Binding>();

  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.importKind === 'type') return;

      if (path.node.source.value === 'vue') {
        for (const specifierPath of path.get('specifiers')) {
          const specifier = specifierPath.node;
          if (
            specifier.type !== 'ImportSpecifier' ||
            specifier.importKind === 'type'
          ) {
            continue;
          }
          const importedName =
            specifier.imported.type === 'Identifier'
              ? specifier.imported.name
              : specifier.imported.value;
          if (importedName !== 'defineComponent') continue;
          const binding = specifierPath.scope.getBinding(specifier.local.name);
          if (binding) defineComponentBindings.add(binding);
        }
        return;
      }
      if (path.node.source.value !== 'gt-vue') return;

      for (const specifierPath of path.get('specifiers')) {
        const specifier = specifierPath.node;
        if (specifier.type === 'ImportNamespaceSpecifier') {
          addVueError(
            context,
            babelLocation(specifier.loc),
            'Found an unsupported namespace import from gt-vue',
            "Use named imports such as import { T, Var, useGT } from 'gt-vue'"
          );
          continue;
        }
        if (specifier.type !== 'ImportSpecifier') continue;
        if (specifier.importKind === 'type') continue;

        const importedName =
          specifier.imported.type === 'Identifier'
            ? specifier.imported.name
            : specifier.imported.value;
        const localName = specifier.local.name;
        const binding = specifierPath.scope.getBinding(localName);
        if (!binding) continue;

        if (COMPONENT_IMPORTS.has(importedName as GTComponentName)) {
          componentBindings.set(binding, importedName as GTComponentName);
          if (exposeToTemplate) {
            templateBindings.components.set(
              localName,
              importedName as GTComponentName
            );
          }
        } else if (importedName === 'msg') {
          stringBindings.set(binding, 'msg');
          if (exposeToTemplate) {
            templateBindings.stringFunctions.set(localName, 'msg');
          }
        } else if (importedName === 'useGT') {
          hookBindings.set(binding, 'gt');
        } else if (importedName === 'useMessages') {
          hookBindings.set(binding, 'messages');
        }
      }
    },
  });

  // Resolve hook return values and simple aliases to the actual Babel binding.
  // Binding identity keeps a shadowed local with the same spelling from being
  // mistaken for a GT function.
  let changed = true;
  while (changed) {
    changed = false;
    traverse(ast, {
      VariableDeclarator(path) {
        if (path.node.id.type !== 'Identifier') return;
        const target = path.scope.getBinding(path.node.id.name);
        if (!target || !path.node.init) return;

        if (path.node.init.type === 'Identifier') {
          const sourceBinding = path.scope.getBinding(path.node.init.name);
          if (!sourceBinding) return;
          const hookKind = hookBindings.get(sourceBinding);
          if (hookKind && !hookBindings.has(target)) {
            hookBindings.set(target, hookKind);
            changed = true;
          }
          const stringKind = stringBindings.get(sourceBinding);
          if (stringKind && !stringBindings.has(target)) {
            stringBindings.set(target, stringKind);
            if (exposeToTemplate && target.scope.path.isProgram()) {
              templateBindings.stringFunctions.set(
                path.node.id.name,
                stringKind
              );
            }
            changed = true;
          }
          const componentKind = componentBindings.get(sourceBinding);
          if (componentKind && !componentBindings.has(target)) {
            componentBindings.set(target, componentKind);
            if (exposeToTemplate && target.scope.path.isProgram()) {
              templateBindings.components.set(path.node.id.name, componentKind);
            }
            changed = true;
          }
          return;
        }

        if (
          path.node.init.type === 'CallExpression' &&
          path.node.init.callee.type === 'Identifier'
        ) {
          const calleeBinding = path.scope.getBinding(
            path.node.init.callee.name
          );
          const hookKind = calleeBinding
            ? hookBindings.get(calleeBinding)
            : undefined;
          if (hookKind && !stringBindings.has(target)) {
            stringBindings.set(target, hookKind);
            if (exposeToTemplate && target.scope.path.isProgram()) {
              templateBindings.stringFunctions.set(path.node.id.name, hookKind);
            }
            changed = true;
          }
        }
      },
    });
  }

  if (!exposeToTemplate) {
    exposeOptionsApiBindings(
      ast,
      componentBindings,
      stringBindings,
      defineComponentBindings,
      templateBindings
    );
  }

  traverse(ast, {
    CallExpression(path) {
      if (path.node.callee.type !== 'Identifier') return;
      const binding = path.scope.getBinding(path.node.callee.name);
      const kind = binding ? stringBindings.get(binding) : undefined;
      if (!kind) return;
      processVueStringCall(
        path.node,
        kind,
        babelLocation(path.node.loc),
        context
      );
    },
    TaggedTemplateExpression(path) {
      if (path.node.tag.type !== 'Identifier') return;
      const binding = path.scope.getBinding(path.node.tag.name);
      if (!binding || !stringBindings.has(binding)) return;
      addVueError(
        context,
        babelLocation(path.node.loc),
        'Found an unsupported tagged template translation in gt-vue',
        'Call the translation function with a string literal instead'
      );
    },
    JSXElement(path) {
      const name = path.node.openingElement.name;
      if (name.type !== 'JSXIdentifier') return;
      const binding = path.scope.getBinding(name.name);
      if (!binding || componentBindings.get(binding) !== 'T') return;
      addVueError(
        context,
        babelLocation(path.node.loc),
        'Found a gt-vue <T> component in Vue JSX or TSX',
        'Move the rich translation into a Vue single-file component template'
      );
    },
  });
}

function exposeOptionsApiBindings(
  ast: t.File,
  componentBindings: Map<Binding, GTComponentName>,
  stringBindings: Map<Binding, StringFunctionKind>,
  defineComponentBindings: Set<Binding>,
  templateBindings: TemplateBindings
): void {
  const setupFunctions = new Set<t.Function>();

  traverse(ast, {
    ExportDefaultDeclaration(path) {
      const options = resolveOptionsObject(
        path.node.declaration,
        path.scope,
        defineComponentBindings,
        new Set()
      );
      if (!options) return;

      for (const property of options.properties) {
        if (property.type === 'SpreadElement') continue;
        if (property.computed) continue;
        const key = readObjectKey(property.key);
        if (key === 'components' && property.type === 'ObjectProperty') {
          exposeRegisteredComponents(
            property.value,
            path.scope,
            componentBindings,
            templateBindings
          );
        } else if (key === 'setup') {
          const setup =
            property.type === 'ObjectMethod'
              ? property
              : property.type === 'ObjectProperty'
                ? resolveSetupFunction(property.value, path.scope, new Set())
                : undefined;
          if (setup) setupFunctions.add(setup);
        }
      }
    },
  });

  if (setupFunctions.size === 0) return;
  traverse(ast, {
    ReturnStatement(path) {
      const functionParent = path.getFunctionParent();
      if (!functionParent || !setupFunctions.has(functionParent.node)) return;
      if (!path.node.argument) return;
      const returned = resolveObjectExpression(
        path.node.argument,
        path.scope,
        new Set()
      );
      if (!returned) return;
      for (const property of returned.properties) {
        if (property.type !== 'ObjectProperty' || property.computed) continue;
        const templateName = readObjectKey(property.key);
        const value = unwrapExpression(property.value);
        if (!templateName || value?.type !== 'Identifier') continue;
        const binding = path.scope.getBinding(value.name);
        const component = binding ? componentBindings.get(binding) : undefined;
        if (component) {
          templateBindings.components.set(templateName, component);
        }
        const kind = binding ? stringBindings.get(binding) : undefined;
        if (kind) templateBindings.stringFunctions.set(templateName, kind);
      }
    },
  });
}

function exposeRegisteredComponents(
  node: t.Node,
  scope: Scope,
  componentBindings: Map<Binding, GTComponentName>,
  templateBindings: TemplateBindings
): void {
  const components = resolveObjectExpression(node, scope, new Set());
  if (!components) return;

  for (const property of components.properties) {
    if (property.type !== 'ObjectProperty' || property.computed) continue;
    const localName = readObjectKey(property.key);
    const value = unwrapExpression(property.value);
    if (!localName || value?.type !== 'Identifier') continue;
    const binding = scope.getBinding(value.name);
    const component = binding ? componentBindings.get(binding) : undefined;
    if (component) templateBindings.components.set(localName, component);
  }
}

function resolveSetupFunction(
  node: t.Node,
  scope: Scope,
  seen: Set<t.Node>
): t.Function | undefined {
  const expression = unwrapExpression(node);
  if (!expression || seen.has(expression)) return undefined;
  seen.add(expression);
  if (
    expression.type === 'FunctionExpression' ||
    expression.type === 'ArrowFunctionExpression'
  ) {
    return expression;
  }
  if (expression.type !== 'Identifier') return undefined;
  const declaration = scope.getBinding(expression.name)?.path.node;
  if (declaration?.type === 'FunctionDeclaration') return declaration;
  return declaration?.type === 'VariableDeclarator' && declaration.init
    ? resolveSetupFunction(declaration.init, scope, seen)
    : undefined;
}

function resolveOptionsObject(
  node: t.ExportDefaultDeclaration['declaration'],
  scope: Scope,
  defineComponentBindings: Set<Binding>,
  seen: Set<t.Node>
): t.ObjectExpression | undefined {
  const expression = unwrapExpression(node);
  if (!expression || seen.has(expression)) return undefined;
  seen.add(expression);
  if (expression.type === 'ObjectExpression') return expression;
  if (expression.type === 'Identifier') {
    const binding = scope.getBinding(expression.name);
    const declaration = binding?.path.node;
    return declaration?.type === 'VariableDeclarator' && declaration.init
      ? resolveOptionsObject(
          declaration.init,
          scope,
          defineComponentBindings,
          seen
        )
      : undefined;
  }
  if (
    expression.type !== 'CallExpression' ||
    expression.callee.type !== 'Identifier'
  ) {
    return undefined;
  }
  const calleeBinding = scope.getBinding(expression.callee.name);
  if (!calleeBinding || !defineComponentBindings.has(calleeBinding)) {
    return undefined;
  }
  const argument = expression.arguments[0];
  return argument &&
    argument.type !== 'SpreadElement' &&
    argument.type !== 'ArgumentPlaceholder'
    ? resolveObjectExpression(argument, scope, seen)
    : undefined;
}

function resolveObjectExpression(
  node: t.Node,
  scope: Scope,
  seen: Set<t.Node>
): t.ObjectExpression | undefined {
  const expression = unwrapExpression(node);
  if (!expression || seen.has(expression)) return undefined;
  seen.add(expression);
  if (expression.type === 'ObjectExpression') return expression;
  if (expression.type !== 'Identifier') return undefined;
  const declaration = scope.getBinding(expression.name)?.path.node;
  return declaration?.type === 'VariableDeclarator' && declaration.init
    ? resolveObjectExpression(declaration.init, scope, seen)
    : undefined;
}

function unwrapExpression(node: t.Node): t.Node | undefined {
  let current: t.Node = node;
  while (
    current.type === 'TSAsExpression' ||
    current.type === 'TSTypeAssertion' ||
    current.type === 'TSNonNullExpression' ||
    current.type === 'TypeCastExpression' ||
    current.type === 'ParenthesizedExpression'
  ) {
    current = current.expression;
  }
  return current;
}

function readObjectKey(node: t.Node): string | undefined {
  if (node.type === 'Identifier' || node.type === 'StringLiteral') {
    return node.type === 'Identifier' ? node.name : node.value;
  }
  return undefined;
}

function getParserPlugins(language: string | undefined): ParserPlugin[] {
  const normalizedLanguage = language?.toLowerCase();
  const plugins: ParserPlugin[] = [];
  if (normalizedLanguage === 'ts' || normalizedLanguage === 'tsx') {
    plugins.push('typescript');
  }
  if (normalizedLanguage === 'jsx' || normalizedLanguage === 'tsx') {
    plugins.push('jsx');
  }
  return plugins;
}
