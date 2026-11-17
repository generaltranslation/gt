import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { isMessageTree, type MessageTree } from '@generaltranslation/icu';
import {
  DATE_TIME_CONTEXT_OPTIONS,
  FALLBACK_BRANCH_KEY,
  NUMBER_CONTEXT_OPTIONS,
  forEachPlaceholder,
  templateToMessage,
  type TemplateBranch,
  type TemplateHole,
} from '@generaltranslation/icu/internal';
import { hashSource } from 'generaltranslation/id';
import type { TransformState } from '../../state/types';
import {
  getHelperName,
  parseMessageOptions,
  templateFragment,
  unwrapTypeScript,
} from '../injection/injectUnstableTaggedTemplateHash';
import { isSideEffectFree } from '../injection/inline-translations/isSideEffectFree';
import { objectPropertyMatchesName } from '../../utils/parsing/getObjectPropertyFromObjectExpression';
import { escapeTemplateText } from '../injection/inline-translations/replaceTemplateSource';
import type { StaticHelperKind } from './resolveStaticRuntime';
import {
  addStaticRuntimeError,
  addStaticRuntimeWarning,
  getStaticArguments,
  getStaticHelper,
  hoistStaticTree,
} from './staticRuntimeModule';

/** A hole of the template with the expression of the value it formats. */
type BoundHole = TemplateHole & { value?: unknown };

/** The expressions a template gives each of its variables, in source order. */
type Bindings = {
  values: Map<string, t.Expression[]>;
  /** The formatting context of a number, date or time, by its hole. */
  contexts: Map<BoundHole, t.ObjectProperty[]>;
};

/**
 * In a static-runtime build, compiles a `t` template from an unstable entry
 * to what it renders in the build's locale: its text, or a call that formats
 * its message tree with the template's values. Returns whether the template
 * was `t`'s, so no other transform reads it.
 */
export function compileStaticTemplate(
  path: NodePath<t.TaggedTemplateExpression>,
  state: TransformState
): boolean {
  const { tag, quasi } = path.node;
  const callee = t.isCallExpression(tag) ? tag.callee : tag;
  if (
    !t.isIdentifier(callee) ||
    getHelperName(callee.name, path.scope) !== 't'
  ) {
    return false;
  }

  let source: MessageTree;
  let hash: string;
  let maxChars: number | undefined;
  let holes: readonly TemplateHole[];
  let anonymous: [name: string, value: unknown][];
  try {
    const metadata = t.isCallExpression(tag)
      ? parseMessageOptions(tag.arguments)
      : {};
    ({ maxChars } = metadata);
    const fragment = templateFragment(quasi, path.scope);
    ({ holes } = fragment);
    const bindings: Bindings = { values: new Map(), contexts: new Map() };
    bindHoles(holes, quasi.expressions, bindings);
    ({ tree: source, values: anonymous } = templateToMessage(
      fragment.strings,
      holes
    ));
    hash = hashSource({
      source,
      dataFormat: 'MESSAGE_TREE',
      ...metadata,
    });
    return compile(path, state, source, hash, maxChars, anonymous, bindings);
  } catch (error) {
    if (!(error instanceof Unsupported)) {
      addStaticRuntimeError(
        state,
        path.node,
        'this t template is not static or not valid, so its message cannot be resolved at build time'
      );
    } else {
      addStaticRuntimeError(state, path.node, error.message);
    }
    return true;
  }
}

class Unsupported extends Error {}

function unsupported(reason: string): never {
  throw new Unsupported(reason);
}

function compile(
  path: NodePath<t.TaggedTemplateExpression>,
  state: TransformState,
  source: MessageTree,
  hash: string,
  maxChars: number | undefined,
  anonymous: [name: string, value: unknown][],
  bindings: Bindings
): boolean {
  if (maxChars !== undefined) {
    unsupported(
      'this t template sets maxChars, which the static runtime does not cut text off at'
    );
  }

  // The value of each variable, in the order the template evaluates them
  const values = new Map<string, t.Expression>();
  for (const [name, expressions] of bindings.values) {
    const [first, ...rest] = expressions;
    if (
      rest.length > 0 &&
      !(
        isFree(first) &&
        rest.every((expression) => t.isNodesEquivalent(first, expression))
      )
    ) {
      unsupported(
        `this t template gives the variable "${name}" more than one value`
      );
    }
    values.set(name, first);
  }
  const anonymousNames = new Map<unknown, string>();
  for (const [name, value] of anonymous) {
    anonymousNames.set(value, name);
    values.set(name, value as t.Expression);
  }
  const ordered = [...values].sort(
    ([, a], [, b]) => (a.start ?? 0) - (b.start ?? 0)
  );

  // The formatting context of each formatted variable
  const formats = new Map<string, t.ObjectProperty[]>();
  for (const [hole, properties] of bindings.contexts) {
    const name =
      ('name' in hole ? hole.name : undefined) ??
      anonymousNames.get(hole.value);
    if (name === undefined) unsupported('this t template could not be read');
    const existing = formats.get(name);
    if (
      existing &&
      !(
        existing.length === properties.length &&
        existing.every((property, index) =>
          t.isNodesEquivalent(property, properties[index])
        )
      )
    ) {
      unsupported(
        `this t template formats the variable "${name}" in more than one way`
      );
    }
    // They are evaluated after the values, wherever the template has them
    if (!properties.every((property) => isFree(property.value))) {
      unsupported(
        `this t template formats the variable "${name}" with an option that has side effects`
      );
    }
    formats.set(name, properties);
  }

  const tree = getTree(path, state, source, hash);
  if (typeof tree === 'string') {
    const literal = t.stringLiteral(tree);
    // Printed as written, where the generator would escape non-ASCII text
    literal.extra = { rawValue: tree, raw: JSON.stringify(tree) };
    // Values the text leaves out are still evaluated when they could do something
    const effects = ordered
      .map(([, expression]) => expression)
      .filter((expression) => !isFree(expression));
    path.replaceWith(
      effects.length > 0 ? t.sequenceExpression([...effects, literal]) : literal
    );
    return true;
  }

  const used = new Set<string>();
  let kind: Exclude<StaticHelperKind, 'value'> = 'tree';
  let onlyValues = true;
  forEachPlaceholder(tree, (node) => {
    used.add(node[0]);
    if (node[1] !== undefined) onlyValues = false;
    if (node[1] === 'number' || node[1] === 'date' || node[1] === 'time') {
      kind = 'intl';
    }
  });
  const usedFormats = [...formats].filter(
    ([name, properties]) => used.has(name) && properties.length > 0
  );
  // Built on demand, since a call site may not need it
  const buildCall = (): t.Expression =>
    t.callExpression(getStaticHelper(state, path, kind), [
      hoistStaticTree(state, path, tree),
      t.objectExpression(
        ordered.map(([name, expression]) =>
          t.objectProperty(propertyKey(name), t.cloneNode(expression, true))
        )
      ),
      ...getStaticArguments(
        state,
        kind,
        tree,
        usedFormats.length > 0
          ? t.objectExpression(
              usedFormats.map(([name, properties]) =>
                t.objectProperty(
                  propertyKey(name),
                  t.objectExpression(properties)
                )
              )
            )
          : undefined
      ),
    ]);
  path.replaceWith(
    (onlyValues &&
      buildValueTemplate(tree, values, ordered, (value) =>
        t.callExpression(getStaticHelper(state, path, 'value'), [
          value,
          ...getStaticArguments(state, 'value'),
        ])
      )) ||
      buildCall()
  );
  return true;
}

/**
 * A message of text and `{name}` values as a template literal, which prints a
 * string, a number, a bigint or a boolean as the formatter does in every
 * locale. The formatter prints nothing for null and undefined and formats a
 * Date for the locale, which the runtime's value helper does for each value:
 *
 *   `Bonjour ${value(name, 'fr,en')}`
 *
 * A value written as text or a number needs no helper. Undefined when a value
 * has a side effect, since the translation decides how often and in what
 * order values are read here, and when the message has no text: the
 * formatter prints a symbol there, which a template literal throws on.
 */
function buildValueTemplate(
  tree: Exclude<MessageTree, string>,
  values: Map<string, t.Expression>,
  ordered: [string, t.Expression][],
  print: (value: t.Expression) => t.Expression
): t.Expression | undefined {
  if (
    !tree.some((node) => typeof node === 'string' && node !== '') ||
    !ordered.every(([, value]) => isFree(value))
  ) {
    return undefined;
  }
  const quasis: string[] = [''];
  const expressions: t.Expression[] = [];
  for (const node of tree) {
    if (typeof node === 'string') {
      quasis[quasis.length - 1] += node;
      continue;
    }
    const value = t.cloneNode(values.get((node as [string])[0])!, true);
    expressions.push(isText(value) ? value : print(value));
    quasis.push('');
  }
  return t.templateLiteral(
    quasis.map((text, index) =>
      t.templateElement(
        { raw: escapeTemplateText(text), cooked: text },
        index === quasis.length - 1
      )
    ),
    expressions
  );
}

/** Whether a value is surely a string, a number, a bigint or a boolean. */
function isText(value: t.Expression): boolean {
  return (
    t.isStringLiteral(value) ||
    t.isNumericLiteral(value) ||
    t.isBigIntLiteral(value) ||
    t.isBooleanLiteral(value) ||
    t.isTemplateLiteral(value)
  );
}

function propertyKey(name: string): t.Identifier | t.StringLiteral {
  return t.isValidIdentifier(name) ? t.identifier(name) : t.stringLiteral(name);
}

function isFree(node: t.Node): boolean {
  return isSideEffectFree(node, { isPureCall: () => false });
}

// ===== Values ===== //

/**
 * Reads the expression of each hole's value: an unnamed value into the hole
 * itself, where the tree builder numbers it, and a named one into `bindings`.
 * The holes were read from these expressions, so each has its hole's shape.
 */
function bindHoles(
  holes: readonly TemplateHole[],
  expressions: readonly (t.Expression | t.TSType)[],
  bindings: Bindings
): void {
  holes.forEach((hole: BoundHole, index) => {
    const expression = unwrapTypeScript(expressions[index]) as t.Expression;
    switch (hole.kind) {
      case 'pound':
        return;
      case 'argument':
        bind(bindings, hole.name, getNamedValue(expression));
        return;
      case 'anonymous':
        hole.value = expression;
        return;
      case 'fragment':
        bindHoles(
          hole.holes,
          (expression as t.TaggedTemplateExpression).quasi.expressions,
          bindings
        );
        return;
    }
    const [variable, argument] = (expression as t.CallExpression)
      .arguments as t.Expression[];
    const value = unwrapTypeScript(variable) as t.Expression;
    if (hole.name === undefined) hole.value = value;
    else bind(bindings, hole.name, getNamedValue(value));
    if (!('branches' in hole)) {
      bindings.contexts.set(hole, getContext(hole.kind, argument));
      return;
    }
    for (const property of (argument as t.ObjectExpression).properties) {
      const { key, value: branchValue } = property as t.ObjectProperty;
      const name = t.isIdentifier(key)
        ? key.name
        : String((key as t.StringLiteral | t.NumericLiteral).value);
      const branch: TemplateBranch | undefined = hole.branches[name];
      if (branch !== undefined && typeof branch !== 'string') {
        bindHoles(
          branch.holes,
          (branchValue as t.TaggedTemplateExpression).quasi.expressions,
          bindings
        );
      }
    }
  });
}

/** The value of `{ name }` or `{ name: value }`. */
function getNamedValue(node: t.Expression): t.Expression {
  const [property] = (node as t.ObjectExpression).properties;
  return (property as t.ObjectProperty).value as t.Expression;
}

function bind(bindings: Bindings, name: string, value: t.Expression): void {
  bindings.values.set(name, [...(bindings.values.get(name) ?? []), value]);
}

/** The options of a number, date or time that are formatting context, which the tree leaves out. */
function getContext(
  kind: 'number' | 'date' | 'time',
  options: t.Expression | undefined
): t.ObjectProperty[] {
  if (!options) return [];
  const contextKeys: readonly string[] =
    kind === 'number' ? NUMBER_CONTEXT_OPTIONS : DATE_TIME_CONTEXT_OPTIONS;
  return (options as t.ObjectExpression).properties.filter(
    (property): property is t.ObjectProperty =>
      contextKeys.some((key) => objectPropertyMatchesName(property, key))
  );
}

// ===== Translation ===== //

/**
 * The tree the template renders in the build's locale: its translation, or
 * its source when the build's locale renders the source, or the translation
 * is missing or cannot stand in for the source.
 */
function getTree(
  path: NodePath<t.TaggedTemplateExpression>,
  state: TransformState,
  source: MessageTree,
  hash: string
): MessageTree {
  const { sourceReplacement, inlineTranslationsTable } = state.settings;
  if (sourceReplacement?.locale === undefined) return source;
  const translation =
    inlineTranslationsTable?.[sourceReplacement.locale]?.[hash];
  if (translation === undefined) {
    addStaticRuntimeWarning(
      state,
      path.node,
      `the "${sourceReplacement.locale}" translation of message ${hash} is missing, so its source is rendered`
    );
    return source;
  }
  const problem = getTranslationProblem(source, translation);
  if (problem !== undefined) {
    addStaticRuntimeWarning(
      state,
      path.node,
      `the "${sourceReplacement.locale}" translation of message ${hash} ${problem}, so its source is rendered`
    );
    return source;
  }
  return translation as MessageTree;
}

/**
 * Why a translation cannot be formatted wherever its source can, which is
 * when the runtime renders the source instead; undefined when it can.
 */
function getTranslationProblem(
  source: MessageTree,
  translation: unknown
): string | undefined {
  if (!isMessageTree(translation)) return 'is not a message tree';
  // What each variable of the source is formatted as
  const kinds = new Map<string, Set<string>>();
  forEachPlaceholder(source, (node) => {
    const kind =
      node[1] !== undefined && isBranching(node[1])
        ? node[1]
        : JSON.stringify(node.slice(1));
    kinds.set(node[0], (kinds.get(node[0]) ?? new Set()).add(kind));
  });
  let problem: string | undefined;
  forEachPlaceholder(translation, (node) => {
    const [name, kind] = node;
    const sourceKinds = kinds.get(name);
    if (!sourceKinds) {
      problem ??= `has the variable "${name}", which its source lacks`;
    } else if (kind === undefined) {
      // Any value formats as text
    } else if (kind === 'tag') {
      problem ??= `has the tag "${name}"`;
    } else if (isBranching(kind)) {
      // A value its source selects or counts with is one this can select or count with
      const numeric = kind !== 'select';
      const matches = [...sourceKinds].some((sourceKind) =>
        numeric
          ? sourceKind === 'plural' ||
            sourceKind === 'selectordinal' ||
            sourceKind.startsWith('["number"')
          : sourceKind === 'select'
      );
      if (!matches) {
        problem ??= `reads "${name}" as a ${kind}, which its source does not`;
      } else if (
        !Object.prototype.hasOwnProperty.call(node[2], FALLBACK_BRANCH_KEY)
      ) {
        problem ??= `has no "${FALLBACK_BRANCH_KEY}" branch for "${name}"`;
      }
    } else if (!sourceKinds.has(JSON.stringify(node.slice(1)))) {
      problem ??= `formats "${name}" as its source does not`;
    }
  });
  return problem;
}

function isBranching(kind: string | undefined): boolean {
  return kind === 'select' || kind === 'plural' || kind === 'selectordinal';
}
