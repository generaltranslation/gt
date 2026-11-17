import * as t from '@babel/types';
import { isSideEffectFree } from './isSideEffectFree';

export type TemplateReplacement =
  | { quasi: t.TemplateLiteral }
  | { quasi?: undefined; reason: string };

type Hole = { name: string; expression: t.Expression; start: number };

/**
 * The translation as a template literal that reuses the source's `${{ name }}`
 * holes, for translations of text and `{name}` only; a hole dropped, repeated
 * or reordered must be free of side effects, and a repeated one must bind the
 * same value, as the runtime rejects one name bound to two values.
 */
export function replaceTemplateSource(
  quasi: t.TemplateLiteral,
  translation: unknown
): TemplateReplacement {
  const holes = quasi.expressions.map(getHole);
  if (holes.some((hole) => hole === undefined)) {
    return { reason: 'a placeholder is not a named variable' };
  }
  const holesByName = new Map<string, Hole[]>();
  for (const hole of holes as Hole[]) {
    holesByName.set(hole.name, [...(holesByName.get(hole.name) ?? []), hole]);
  }

  const nodes = typeof translation === 'string' ? [translation] : translation;
  if (!Array.isArray(nodes)) {
    return { reason: 'the translation is not a message tree' };
  }
  const strings = [''];
  const expressions: Hole[] = [];
  for (const node of nodes) {
    if (typeof node === 'string') {
      strings[strings.length - 1] += node;
      continue;
    }
    const name = getArgumentName(node);
    if (name === undefined) {
      return {
        reason: 'the translation uses ICU syntax other than text and {name}',
      };
    }
    const sourceHoles = holesByName.get(name);
    if (!sourceHoles) {
      return {
        reason: `the translation uses {${name}}, which the source lacks`,
      };
    }
    expressions.push(sourceHoles[0]);
    strings.push('');
  }

  const reason = checkHoleUses(holesByName, expressions);
  if (reason) return { reason };

  const used = new Set<Hole>();
  return {
    quasi: t.templateLiteral(
      strings.map((text, index) =>
        t.templateElement(
          { raw: escapeTemplateText(text), cooked: text },
          index === strings.length - 1
        )
      ),
      expressions.map((hole) => {
        if (used.has(hole)) return t.cloneNode(hole.expression, true);
        used.add(hole);
        return hole.expression;
      })
    ),
  };
}

function checkHoleUses(
  holesByName: Map<string, Hole[]>,
  uses: Hole[]
): string | undefined {
  const isStable = (hole: Hole) =>
    isSideEffectFree(getHoleValue(hole.expression), {
      isPureCall: () => false,
      sameIdentity: true,
    });
  for (const [name, sourceHoles] of holesByName) {
    const useCount = uses.filter((hole) => hole.name === name).length;
    if (
      (sourceHoles.length !== 1 || useCount !== 1) &&
      !sourceHoles.every(isStable)
    ) {
      return `{${name}} would be dropped or repeated, and its value has side effects`;
    }
  }
  const ordered = uses.filter((hole) => !isStable(hole));
  if (
    ordered.some(
      (hole, index) => index > 0 && ordered[index - 1].start > hole.start
    )
  ) {
    return 'the translation reorders variables whose values have side effects';
  }
  return undefined;
}

function getHole(expression: t.Expression | t.TSType): Hole | undefined {
  const object = unwrap(expression);
  if (!t.isObjectExpression(object) || object.properties.length !== 1) return;
  const [property] = object.properties;
  if (!t.isObjectProperty(property) || property.computed) return;
  const { key } = property;
  const name = t.isIdentifier(key)
    ? key.name
    : t.isStringLiteral(key)
      ? key.value
      : t.isNumericLiteral(key)
        ? String(key.value)
        : undefined;
  if (name === undefined || !t.isExpression(expression)) return;
  return { name, expression, start: expression.start ?? 0 };
}

function getHoleValue(expression: t.Expression): t.Node {
  const object = unwrap(expression) as t.ObjectExpression;
  return (object.properties[0] as t.ObjectProperty).value;
}

function unwrap(node: t.Node): t.Node {
  while (
    t.isTSAsExpression(node) ||
    t.isTSSatisfiesExpression(node) ||
    t.isTSNonNullExpression(node) ||
    t.isTSTypeAssertion(node) ||
    t.isParenthesizedExpression(node)
  ) {
    node = node.expression;
  }
  return node;
}

/** `{name}` in a message tree is a one-entry array holding the name. */
function getArgumentName(node: unknown): string | undefined {
  return Array.isArray(node) && node.length === 1 && typeof node[0] === 'string'
    ? node[0]
    : undefined;
}

// Raw template text reads backslashes, backticks and `${` as syntax, and turns CR into LF
function escapeTemplateText(text: string): string {
  return text.replace(/\\|`|\$\{|\r/g, (match) =>
    match === '\r' ? '\\r' : `\\${match}`
  );
}
