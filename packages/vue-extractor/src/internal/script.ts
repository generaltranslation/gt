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
import {
  addVueError,
  babelLocation,
  readStaticPrimitive,
  type StaticPrimitiveResult,
  unwrapExpression,
} from './utils.js';

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

type KnownValue =
  | { type: 'component'; name: GTComponentName }
  | { type: 'hook'; kind: Exclude<StringFunctionKind, 'msg'> }
  | { type: 'string'; kind: StringFunctionKind }
  | { type: 'namespace'; source: 'gt-vue' | 'vue' }
  | { type: 'defineComponent' };

/** Import information shared by the two script blocks of one Vue SFC. */
export type VueScriptAnalysis = {
  staticValues: Map<string, string | number | bigint | boolean | null>;
  values: Map<string, KnownValue>;
};

type ScriptState = {
  analysis: VueScriptAnalysis;
  bindings: Map<Binding, KnownValue>;
};

type ScopedExpression = { node: t.Node; scope: Scope };
type TemplateExposure =
  | { type: 'known'; value: KnownValue }
  | {
      type: 'static';
      value: string | number | bigint | boolean | null;
    };

/** Creates the per-SFC state used to resolve cross-block imports safely. */
export function createVueScriptAnalysis(): VueScriptAnalysis {
  return { staticValues: new Map(), values: new Map() };
}

/** Exposes imports from a normal script when the SFC also has script setup. */
export function exposeVueScriptImportsToTemplate(
  analysis: VueScriptAnalysis,
  templateBindings: TemplateBindings
): void {
  for (const [localName, value] of analysis.values) {
    exposeKnownValue(localName, value, templateBindings);
  }
  for (const [localName, value] of analysis.staticValues) {
    templateBindings.staticValues.set(localName, value);
  }
}

/** Collects imports before either SFC script block is fully analyzed. */
export function collectVueScriptImports(
  source: string,
  language: string | undefined,
  analysis: VueScriptAnalysis
): void {
  if (!source.trim()) return;
  try {
    const ast = parseScriptAst(source, language);
    collectImports(ast, { analysis, bindings: new Map() });
  } catch {
    // The full analysis pass reports the parser diagnostic once.
  }
}

/** Extracts calls and component bindings from one padded Vue script block. */
export function parseVueScript(
  source: string,
  language: string | undefined,
  context: VueExtractionContext,
  templateBindings: TemplateBindings,
  exposeToTemplate: boolean,
  analysis: VueScriptAnalysis = createVueScriptAnalysis()
): boolean {
  if (!source.trim()) return true;

  let ast: t.File;
  try {
    ast = parseScriptAst(source, language);
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
    return false;
  }

  const state: ScriptState = { analysis, bindings: new Map() };
  collectImports(ast, state);

  if (exposeToTemplate) {
    exposeProgramBindings(ast, state, templateBindings);
  } else {
    recordProgramAnalysis(ast, state);
    exposeOptionsApiBindings(ast, state, templateBindings);
  }

  const processCall = (path: {
    node: t.CallExpression | t.OptionalCallExpression;
    scope: Scope;
  }) => {
    const value = resolveKnownExpression(
      path.node.callee,
      path.scope,
      state,
      new Set()
    );
    if (value?.type !== 'string') return;
    processVueStringCall(
      path.node,
      value.kind,
      babelLocation(path.node.loc),
      context,
      (node) =>
        readStaticFromScope(
          node,
          path.scope,
          new Set(),
          path.node.start ?? Number.POSITIVE_INFINITY,
          state.analysis
        )
    );
  };

  traverse(ast, {
    CallExpression: processCall,
    OptionalCallExpression: processCall,
    TaggedTemplateExpression(path) {
      const value = resolveKnownExpression(
        path.node.tag,
        path.scope,
        state,
        new Set()
      );
      if (value?.type !== 'string') return;
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
      const value = binding
        ? resolveKnownBinding(binding, state, new Set())
        : state.analysis.values.get(name.name);
      if (value?.type !== 'component' || value.name !== 'T') return;
      addVueError(
        context,
        babelLocation(path.node.loc),
        'Found a gt-vue <T> component in Vue JSX or TSX',
        'Move the rich translation into a Vue single-file component template'
      );
    },
  });
  return true;
}

function collectImports(ast: t.File, state: ScriptState): void {
  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.importKind === 'type') return;
      const source = path.node.source.value;
      if (source !== 'gt-vue' && source !== 'vue') return;

      for (const specifierPath of path.get('specifiers')) {
        const specifier = specifierPath.node;
        if (specifier.type === 'ImportNamespaceSpecifier') {
          registerImport(
            specifier.local.name,
            { type: 'namespace', source },
            specifierPath.scope,
            state
          );
          continue;
        }
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
        const value = knownExport(source, importedName);
        if (value) {
          registerImport(
            specifier.local.name,
            value,
            specifierPath.scope,
            state
          );
        }
      }
    },
    TSImportEqualsDeclaration(path) {
      const reference = path.node.moduleReference;
      if (
        reference.type !== 'TSExternalModuleReference' ||
        reference.expression.type !== 'StringLiteral'
      ) {
        return;
      }
      const source = reference.expression.value;
      if (source !== 'gt-vue' && source !== 'vue') return;
      registerImport(
        path.node.id.name,
        { type: 'namespace', source },
        path.scope,
        state
      );
    },
    VariableDeclarator(path) {
      const namespace = readRequireNamespace(path.node.init, path.scope);
      if (!namespace) return;
      registerRequirePattern(path.node.id, namespace, path.scope, state);
    },
  });
}

function registerImport(
  localName: string,
  value: KnownValue,
  scope: Scope,
  state: ScriptState
): void {
  const binding = scope.getBinding(localName);
  if (binding) state.bindings.set(binding, value);
  state.analysis.values.set(localName, value);
}

function registerRequirePattern(
  pattern: t.Node,
  namespace: Extract<KnownValue, { type: 'namespace' }>,
  scope: Scope,
  state: ScriptState
): void {
  if (pattern.type === 'Identifier') {
    registerImport(pattern.name, namespace, scope, state);
    return;
  }
  if (pattern.type !== 'ObjectPattern') return;
  for (const property of pattern.properties) {
    if (property.type !== 'ObjectProperty') continue;
    const importedName = readPropertyKey(property);
    const localName = readPatternIdentifier(property.value);
    const value = importedName
      ? knownExport(namespace.source, importedName)
      : undefined;
    if (localName && value) registerImport(localName, value, scope, state);
  }
}

function exposeProgramBindings(
  ast: t.File,
  state: ScriptState,
  templateBindings: TemplateBindings
): void {
  traverse(ast, {
    Program(path) {
      for (const [name, binding] of Object.entries(path.scope.bindings)) {
        const value = resolveKnownBinding(binding, state, new Set());
        if (value) exposeKnownValue(name, value, templateBindings);
        const staticValue = readStaticFromScope(
          binding.identifier,
          path.scope,
          new Set(),
          Number.POSITIVE_INFINITY,
          state.analysis
        );
        if (staticValue.ok) {
          templateBindings.staticValues.set(name, staticValue.value);
        }
      }
      path.stop();
    },
  });
}

/** Records normal-script module bindings that script setup can reference. */
function recordProgramAnalysis(ast: t.File, state: ScriptState): void {
  traverse(ast, {
    Program(path) {
      for (const [name, binding] of Object.entries(path.scope.bindings)) {
        const value = resolveKnownBinding(binding, state, new Set());
        if (value) state.analysis.values.set(name, value);
        const staticValue = readStaticFromScope(
          binding.identifier,
          path.scope,
          new Set(),
          Number.POSITIVE_INFINITY,
          state.analysis
        );
        if (staticValue.ok) {
          state.analysis.staticValues.set(name, staticValue.value);
        }
      }
      path.stop();
    },
  });
}

function exposeKnownValue(
  localName: string,
  value: KnownValue,
  templateBindings: TemplateBindings
): void {
  if (value.type === 'component') {
    templateBindings.components.set(localName, value.name);
  } else if (value.type === 'string') {
    templateBindings.stringFunctions.set(localName, value.kind);
  } else if (value.type === 'namespace' && value.source === 'gt-vue') {
    for (const component of COMPONENT_IMPORTS) {
      templateBindings.components.set(`${localName}.${component}`, component);
    }
    templateBindings.stringFunctions.set(`${localName}.msg`, 'msg');
  }
}

function resolveKnownExpression(
  node: t.Node | null | undefined,
  scope: Scope,
  state: ScriptState,
  seen: Set<Binding>
): KnownValue | undefined {
  const expression = unwrapExpression(node);
  if (!expression) return undefined;

  if (expression.type === 'Identifier') {
    const binding = scope.getBinding(expression.name);
    return binding
      ? resolveKnownBinding(binding, state, seen)
      : state.analysis.values.get(expression.name);
  }
  if (
    expression.type === 'MemberExpression' ||
    expression.type === 'OptionalMemberExpression'
  ) {
    const object = resolveKnownExpression(
      expression.object,
      scope,
      state,
      seen
    );
    const property = readMemberProperty(expression);
    return object?.type === 'namespace' && property
      ? knownExport(object.source, property)
      : undefined;
  }
  if (
    expression.type === 'CallExpression' ||
    expression.type === 'OptionalCallExpression'
  ) {
    const namespace = readRequireNamespace(expression, scope);
    if (namespace) return namespace;
    const callee = resolveKnownExpression(
      expression.callee,
      scope,
      state,
      seen
    );
    return callee?.type === 'hook'
      ? { type: 'string', kind: callee.kind }
      : undefined;
  }
  return undefined;
}

function resolveKnownBinding(
  binding: Binding,
  state: ScriptState,
  seen: Set<Binding>
): KnownValue | undefined {
  const existing = state.bindings.get(binding);
  if (existing) return existing;
  if (seen.has(binding)) return undefined;
  seen.add(binding);

  const source = getBindingSource(binding);
  if (!source) return undefined;
  const value = resolvePatternKnownValue(
    source.pattern,
    source.expression.node,
    binding.identifier.name,
    source.expression.scope,
    state,
    seen
  );
  if (value) state.bindings.set(binding, value);
  return value;
}

function resolvePatternKnownValue(
  pattern: t.Node,
  valueNode: t.Node,
  targetName: string,
  scope: Scope,
  state: ScriptState,
  seen: Set<Binding>
): KnownValue | undefined {
  if (pattern.type === 'Identifier') {
    return pattern.name === targetName
      ? resolveKnownExpression(valueNode, scope, state, seen)
      : undefined;
  }
  if (pattern.type === 'AssignmentPattern') {
    if (isStaticallyUndefined(valueNode, scope)) {
      return resolvePatternKnownValue(
        pattern.left,
        pattern.right,
        targetName,
        scope,
        state,
        seen
      );
    }
    return resolvePatternKnownValue(
      pattern.left,
      valueNode,
      targetName,
      scope,
      state,
      seen
    );
  }
  if (pattern.type === 'ObjectPattern') {
    for (const property of pattern.properties) {
      if (property.type !== 'ObjectProperty') continue;
      if (!patternContains(property.value, targetName)) continue;
      const key = readPropertyKey(property);
      if (!key) return undefined;
      const namespace = resolveKnownExpression(valueNode, scope, state, seen);
      if (namespace?.type === 'namespace') {
        return knownExport(namespace.source, key);
      }
      const entry = readObjectEntry(valueNode, key, scope, new Set());
      return entry
        ? resolvePatternKnownValue(
            property.value,
            entry.node,
            targetName,
            entry.scope,
            state,
            seen
          )
        : resolveKnownPatternDefault(
            property.value,
            targetName,
            scope,
            state,
            seen
          );
    }
  }
  if (pattern.type === 'ArrayPattern') {
    const array = resolveArrayExpression(valueNode, scope, new Set());
    if (!array) return undefined;
    for (let index = 0; index < pattern.elements.length; index += 1) {
      const target = pattern.elements[index];
      if (!target || !patternContains(target, targetName)) continue;
      const element = array.node.elements[index];
      if (!element) {
        return resolveKnownPatternDefault(
          target,
          targetName,
          array.scope,
          state,
          seen
        );
      }
      if (element.type === 'SpreadElement') return undefined;
      return resolvePatternKnownValue(
        target,
        element,
        targetName,
        array.scope,
        state,
        seen
      );
    }
  }
  return undefined;
}

function resolveKnownPatternDefault(
  pattern: t.Node,
  targetName: string,
  scope: Scope,
  state: ScriptState,
  seen: Set<Binding>
): KnownValue | undefined {
  return pattern.type === 'AssignmentPattern' &&
    patternContains(pattern.left, targetName)
    ? resolvePatternKnownValue(
        pattern.left,
        pattern.right,
        targetName,
        scope,
        state,
        seen
      )
    : undefined;
}

function getBindingSource(
  binding: Binding
): { expression: ScopedExpression; pattern: t.Node } | undefined {
  const declaration = binding.path.node;
  if (declaration.type !== 'VariableDeclarator') return undefined;

  if (declaration.init) {
    if (!binding.constant) return undefined;
    return {
      expression: { node: declaration.init, scope: binding.path.scope },
      pattern: declaration.id,
    };
  }

  if (binding.constantViolations.length !== 1) return undefined;
  const violation = binding.constantViolations[0];
  if (
    !violation.isAssignmentExpression() ||
    violation.node.operator !== '=' ||
    !isBindingPattern(violation.node.left)
  ) {
    return undefined;
  }
  const assignmentEnd = violation.node.end ?? Number.POSITIVE_INFINITY;
  if (
    binding.referencePaths.some(
      (reference) => (reference.node.start ?? assignmentEnd) < assignmentEnd
    )
  ) {
    return undefined;
  }
  return {
    expression: { node: violation.node.right, scope: violation.scope },
    pattern: violation.node.left,
  };
}

function exposeOptionsApiBindings(
  ast: t.File,
  state: ScriptState,
  templateBindings: TemplateBindings
): void {
  const setupFunctions = new Set<t.Function>();

  traverse(ast, {
    ExportDefaultDeclaration(path) {
      const options = resolveOptionsObject(
        path.node.declaration,
        path.scope,
        state,
        new Set()
      );
      if (!options) return;
      const entries = collectObjectEntries(
        options.node,
        options.scope,
        new Set()
      );
      const components = entries.get('components');
      if (components) {
        exposeRegisteredComponents(components, state, templateBindings);
      }
      const setup = entries.get('setup');
      if (setup) {
        const setupFunction = resolveSetupFunction(
          setup.node,
          setup.scope,
          new Set()
        );
        if (setupFunction) setupFunctions.add(setupFunction);
      }
    },
  });

  if (setupFunctions.size === 0) return;
  const setupReturns = new Map<t.Function, ScopedExpression[]>(
    [...setupFunctions].map((setup) => [setup, []])
  );
  traverse(ast, {
    ArrowFunctionExpression(path) {
      if (
        setupFunctions.has(path.node) &&
        path.node.body.type !== 'BlockStatement'
      ) {
        setupReturns
          .get(path.node)
          ?.push({ node: path.node.body, scope: path.scope });
      }
    },
    ReturnStatement(path) {
      const parent = path.getFunctionParent();
      if (!parent || !setupFunctions.has(parent.node) || !path.node.argument) {
        return;
      }
      setupReturns
        .get(parent.node)
        ?.push({ node: path.node.argument, scope: path.scope });
    },
  });
  for (const [setup, returns] of setupReturns) {
    if (!setupAlwaysTerminates(setup)) continue;
    exposeConsistentSetupReturns(returns, state, templateBindings);
  }
}

/**
 * Returns whether every reachable setup path ends before falling through.
 * Template bindings are exposed only in that case because Vue receives no
 * setup state on a fallthrough path.
 */
function setupAlwaysTerminates(setup: t.Function): boolean {
  return setup.body.type !== 'BlockStatement'
    ? true
    : blockAlwaysTerminates(setup.body);
}

function blockAlwaysTerminates(block: t.BlockStatement): boolean {
  return block.body.some(statementAlwaysTerminates);
}

function statementAlwaysTerminates(statement: t.Statement): boolean {
  if (
    statement.type === 'ReturnStatement' ||
    statement.type === 'ThrowStatement'
  ) {
    return true;
  }
  if (statement.type === 'BlockStatement') {
    return blockAlwaysTerminates(statement);
  }
  if (statement.type !== 'IfStatement' || !statement.alternate) return false;
  return (
    statementAlwaysTerminates(statement.consequent) &&
    statementAlwaysTerminates(statement.alternate)
  );
}

/** Exposes statically resolved Options API component registrations. */
function exposeRegisteredComponents(
  object: ScopedExpression,
  state: ScriptState,
  templateBindings: TemplateBindings
): void {
  const entries = collectObjectEntries(object.node, object.scope, new Set());
  for (const [name, entry] of entries) {
    const value = resolveKnownExpression(
      entry.node,
      entry.scope,
      state,
      new Set()
    );
    if (value?.type === 'component') {
      exposeKnownValue(name, value, templateBindings);
      templateBindings.registeredComponents.add(name);
    }
  }
}

/** Exposes only setup bindings that agree across every explicit return. */
function exposeConsistentSetupReturns(
  returns: ScopedExpression[],
  state: ScriptState,
  templateBindings: TemplateBindings
): void {
  const returnValues = returns.map((entry) =>
    collectTemplateExposures(entry, state)
  );
  const first = returnValues[0];
  if (!first) return;

  for (const [name, exposure] of first) {
    if (
      !exposure ||
      !returnValues
        .slice(1)
        .every(
          (values) =>
            values.has(name) &&
            equalTemplateExposure(exposure, values.get(name))
        )
    ) {
      continue;
    }
    exposeTemplateExposure(name, exposure, templateBindings);
  }
}

function collectTemplateExposures(
  object: ScopedExpression,
  state: ScriptState
): Map<string, TemplateExposure | undefined> {
  const result = new Map<string, TemplateExposure | undefined>();
  const entries = collectObjectEntries(object.node, object.scope, new Set());
  for (const [name, entry] of entries) {
    const known = resolveKnownExpression(
      entry.node,
      entry.scope,
      state,
      new Set()
    );
    if (known) {
      result.set(name, { type: 'known', value: known });
      continue;
    }
    const staticValue = readStaticFromScope(
      entry.node,
      entry.scope,
      new Set(),
      Number.POSITIVE_INFINITY,
      state.analysis
    );
    result.set(
      name,
      staticValue.ok ? { type: 'static', value: staticValue.value } : undefined
    );
  }
  return result;
}

function equalTemplateExposure(
  first: TemplateExposure,
  second: TemplateExposure | undefined
): boolean {
  if (!second || first.type !== second.type) return false;
  if (first.type === 'static' && second.type === 'static') {
    return Object.is(first.value, second.value);
  }
  return (
    first.type === 'known' &&
    second.type === 'known' &&
    knownValueKey(first.value) === knownValueKey(second.value)
  );
}

function exposeTemplateExposure(
  name: string,
  exposure: TemplateExposure,
  templateBindings: TemplateBindings
): void {
  if (exposure.type === 'known') {
    exposeKnownValue(name, exposure.value, templateBindings);
  } else {
    templateBindings.staticValues.set(name, exposure.value);
  }
}

function knownValueKey(value: KnownValue): string {
  if (value.type === 'component') return `component:${value.name}`;
  if (value.type === 'hook') return `hook:${value.kind}`;
  if (value.type === 'string') return `string:${value.kind}`;
  if (value.type === 'namespace') return `namespace:${value.source}`;
  return 'defineComponent';
}

function resolveOptionsObject(
  node: t.Node,
  scope: Scope,
  state: ScriptState,
  seen: Set<t.Node>
): ScopedExpression | undefined {
  const expression = unwrapExpression(node);
  if (!expression || seen.has(expression)) return undefined;
  seen.add(expression);
  if (expression.type === 'ObjectExpression')
    return { node: expression, scope };
  if (expression.type === 'Identifier') {
    const binding = scope.getBinding(expression.name);
    const source = binding ? getBindingSource(binding) : undefined;
    return source
      ? resolveOptionsObject(
          source.expression.node,
          source.expression.scope,
          state,
          seen
        )
      : undefined;
  }
  if (
    expression.type !== 'CallExpression' &&
    expression.type !== 'OptionalCallExpression'
  ) {
    return undefined;
  }
  const callee = resolveKnownExpression(
    expression.callee,
    scope,
    state,
    new Set()
  );
  if (callee?.type !== 'defineComponent') return undefined;
  const argument = expression.arguments[0];
  return argument &&
    argument.type !== 'SpreadElement' &&
    argument.type !== 'ArgumentPlaceholder'
    ? resolveOptionsObject(argument, scope, state, seen)
    : undefined;
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
    expression.type === 'ArrowFunctionExpression' ||
    expression.type === 'ObjectMethod'
  ) {
    return expression;
  }
  if (expression.type !== 'Identifier') return undefined;
  const binding = scope.getBinding(expression.name);
  if (binding?.path.isFunctionDeclaration()) return binding.path.node;
  const source = binding ? getBindingSource(binding) : undefined;
  return source
    ? resolveSetupFunction(
        source.expression.node,
        source.expression.scope,
        seen
      )
    : undefined;
}

function collectObjectEntries(
  node: t.Node,
  scope: Scope,
  seen: Set<t.Node>
): Map<string, ScopedExpression> {
  const result = new Map<string, ScopedExpression>();
  const object = resolveObjectExpression(node, scope, seen);
  if (!object) return result;
  for (const property of object.node.properties) {
    if (property.type === 'SpreadElement') {
      const spreadEntries = collectObjectEntries(
        property.argument,
        object.scope,
        seen
      );
      for (const [name, entry] of spreadEntries) result.set(name, entry);
      continue;
    }
    const key = readPropertyKey(property);
    if (!key) continue;
    if (property.type === 'ObjectProperty') {
      result.set(key, { node: property.value, scope: object.scope });
    } else if (property.type === 'ObjectMethod') {
      result.set(key, { node: property, scope: object.scope });
    }
  }
  return result;
}

function resolveObjectExpression(
  node: t.Node,
  scope: Scope,
  seen: Set<t.Node>
): { node: t.ObjectExpression; scope: Scope } | undefined {
  const expression = unwrapExpression(node);
  if (!expression || seen.has(expression)) return undefined;
  seen.add(expression);
  if (expression.type === 'ObjectExpression')
    return { node: expression, scope };
  if (expression.type !== 'Identifier') return undefined;
  const binding = scope.getBinding(expression.name);
  const source = binding ? getBindingSource(binding) : undefined;
  return source
    ? resolveObjectExpression(
        source.expression.node,
        source.expression.scope,
        seen
      )
    : undefined;
}

function resolveArrayExpression(
  node: t.Node,
  scope: Scope,
  seen: Set<t.Node>
): { node: t.ArrayExpression; scope: Scope } | undefined {
  const expression = unwrapExpression(node);
  if (!expression || seen.has(expression)) return undefined;
  seen.add(expression);
  if (expression.type === 'ArrayExpression') return { node: expression, scope };
  if (expression.type !== 'Identifier') return undefined;
  const binding = scope.getBinding(expression.name);
  const source = binding ? getBindingSource(binding) : undefined;
  return source
    ? resolveArrayExpression(
        source.expression.node,
        source.expression.scope,
        seen
      )
    : undefined;
}

function readObjectEntry(
  node: t.Node,
  key: string,
  scope: Scope,
  seen: Set<t.Node>
): ScopedExpression | undefined {
  const object = resolveObjectExpression(node, scope, seen);
  if (!object) return undefined;
  let result: ScopedExpression | undefined;
  for (const property of object.node.properties) {
    if (property.type === 'SpreadElement') {
      result =
        readObjectEntry(property.argument, key, object.scope, seen) ?? result;
    } else if (
      property.type === 'ObjectProperty' &&
      readPropertyKey(property) === key
    ) {
      result = { node: property.value, scope: object.scope };
    }
  }
  return result;
}

function readStaticFromScope(
  node: t.Node | null | undefined,
  scope: Scope,
  seen: Set<Binding>,
  atPosition: number,
  analysis?: VueScriptAnalysis
): StaticPrimitiveResult {
  return readStaticPrimitive(node, (identifier) => {
    const binding = scope.getBinding(identifier.name);
    if (!binding) {
      const value = analysis?.staticValues.get(identifier.name);
      return analysis?.staticValues.has(identifier.name)
        ? { ok: true, value: value! }
        : { ok: false };
    }
    if (seen.has(binding)) return { ok: false };
    const nextSeen = new Set(seen);
    nextSeen.add(binding);
    const source = getBindingSource(binding);
    if (!source) return { ok: false };
    if ((source.expression.node.end ?? 0) > atPosition) return { ok: false };
    const expression = selectPatternExpression(
      source.pattern,
      source.expression.node,
      binding.identifier.name,
      source.expression.scope
    );
    return expression
      ? readStaticFromScope(
          expression.node,
          expression.scope,
          nextSeen,
          atPosition,
          analysis
        )
      : { ok: false };
  });
}

function selectPatternExpression(
  pattern: t.Node,
  value: t.Node,
  targetName: string,
  scope: Scope
): ScopedExpression | undefined {
  if (pattern.type === 'Identifier') {
    return pattern.name === targetName ? { node: value, scope } : undefined;
  }
  if (pattern.type === 'AssignmentPattern') {
    if (isStaticallyUndefined(value, scope)) {
      return selectPatternExpression(
        pattern.left,
        pattern.right,
        targetName,
        scope
      );
    }
    return selectPatternExpression(pattern.left, value, targetName, scope);
  }
  if (pattern.type === 'ObjectPattern') {
    for (const property of pattern.properties) {
      if (property.type !== 'ObjectProperty') continue;
      if (!patternContains(property.value, targetName)) continue;
      const key = readPropertyKey(property);
      if (!key) return undefined;
      const entry = readObjectEntry(value, key, scope, new Set());
      return entry
        ? selectPatternExpression(
            property.value,
            entry.node,
            targetName,
            entry.scope
          )
        : selectPatternDefault(property.value, targetName, scope);
    }
  }
  if (pattern.type === 'ArrayPattern') {
    const array = resolveArrayExpression(value, scope, new Set());
    if (!array) return undefined;
    for (let index = 0; index < pattern.elements.length; index += 1) {
      const target = pattern.elements[index];
      if (!target || !patternContains(target, targetName)) continue;
      const element = array.node.elements[index];
      if (!element)
        return selectPatternDefault(target, targetName, array.scope);
      return element.type !== 'SpreadElement'
        ? selectPatternExpression(target, element, targetName, array.scope)
        : undefined;
    }
  }
  return undefined;
}

function selectPatternDefault(
  pattern: t.Node,
  targetName: string,
  scope: Scope
): ScopedExpression | undefined {
  return pattern.type === 'AssignmentPattern' &&
    patternContains(pattern.left, targetName)
    ? { node: pattern.right, scope }
    : undefined;
}

function readRequireNamespace(
  node: t.Node | null | undefined,
  scope: Scope
): Extract<KnownValue, { type: 'namespace' }> | undefined {
  const expression = unwrapExpression(node);
  if (
    !expression ||
    (expression.type !== 'CallExpression' &&
      expression.type !== 'OptionalCallExpression') ||
    expression.callee.type !== 'Identifier' ||
    expression.callee.name !== 'require' ||
    scope.getBinding('require') ||
    expression.arguments.length !== 1
  ) {
    return undefined;
  }
  const argument = expression.arguments[0];
  if (argument?.type !== 'StringLiteral') return undefined;
  return argument.value === 'gt-vue' || argument.value === 'vue'
    ? { type: 'namespace', source: argument.value }
    : undefined;
}

function knownExport(
  source: 'gt-vue' | 'vue',
  name: string
): KnownValue | undefined {
  if (source === 'vue') {
    return name === 'defineComponent' ? { type: 'defineComponent' } : undefined;
  }
  if (COMPONENT_IMPORTS.has(name as GTComponentName)) {
    return { type: 'component', name: name as GTComponentName };
  }
  if (name === 'msg') return { type: 'string', kind: 'msg' };
  if (name === 'useGT') return { type: 'hook', kind: 'gt' };
  if (name === 'useMessages') return { type: 'hook', kind: 'messages' };
  return undefined;
}

function readMemberProperty(
  node: t.MemberExpression | t.OptionalMemberExpression
): string | undefined {
  if (!node.computed && node.property.type === 'Identifier') {
    return node.property.name;
  }
  return node.computed && node.property.type === 'StringLiteral'
    ? node.property.value
    : undefined;
}

function readObjectKey(node: t.Node): string | undefined {
  return node.type === 'Identifier'
    ? node.name
    : node.type === 'StringLiteral'
      ? node.value
      : undefined;
}

function readPropertyKey(property: {
  computed: boolean;
  key: t.Node;
}): string | undefined {
  return property.computed && property.key.type !== 'StringLiteral'
    ? undefined
    : readObjectKey(property.key);
}

function readPatternIdentifier(node: t.Node): string | undefined {
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'AssignmentPattern') {
    return readPatternIdentifier(node.left);
  }
  return undefined;
}

function isStaticallyUndefined(node: t.Node, scope: Scope): boolean {
  const expression = unwrapExpression(node);
  return (
    (expression?.type === 'Identifier' &&
      expression.name === 'undefined' &&
      !scope.getBinding('undefined')) ||
    (expression?.type === 'UnaryExpression' && expression.operator === 'void')
  );
}

function patternContains(node: t.Node, name: string): boolean {
  if (node.type === 'Identifier') return node.name === name;
  if (node.type === 'AssignmentPattern') {
    return patternContains(node.left, name);
  }
  if (node.type === 'RestElement') return patternContains(node.argument, name);
  if (node.type === 'ArrayPattern') {
    return node.elements.some(
      (element) => element && patternContains(element, name)
    );
  }
  if (node.type === 'ObjectPattern') {
    return node.properties.some((property) =>
      property.type === 'RestElement'
        ? patternContains(property.argument, name)
        : patternContains(property.value, name)
    );
  }
  return false;
}

function isBindingPattern(node: t.Node): boolean {
  return (
    node.type === 'Identifier' ||
    node.type === 'ObjectPattern' ||
    node.type === 'ArrayPattern' ||
    node.type === 'AssignmentPattern' ||
    node.type === 'RestElement'
  );
}

function getParserPlugins(language: string | undefined): ParserPlugin[] {
  const normalizedLanguage = language?.toLowerCase();
  const plugins: ParserPlugin[] = ['decorators-legacy'];
  if (normalizedLanguage === 'ts' || normalizedLanguage === 'tsx') {
    plugins.push('typescript');
  }
  if (normalizedLanguage === 'jsx' || normalizedLanguage === 'tsx') {
    plugins.push('jsx');
  }
  return plugins;
}

function parseScriptAst(source: string, language: string | undefined): t.File {
  return parse(source, {
    plugins: getParserPlugins(language),
    sourceType: 'module',
  });
}
