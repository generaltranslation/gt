import * as t from '@babel/types';
import { isSideEffectFree } from './isSideEffectFree';

/**
 * A template of text and `${{ name }}` values as the expression that renders
 * it without the runtime: `Bonjour ${{ name }}` becomes
 *
 *   typeof name == "object" && name ? fallback : `Bonjour ${name ?? ""}`
 *
 * The formatter prints a plain `{name}` as `String(value)` for a string, a
 * number, a bigint and a boolean, in every locale, which is what a template
 * literal prints. It prints nothing for null and undefined, hence `?? ""`.
 * Only an object differs: a Date is formatted for the locale. So an object,
 * which the types of `${{ name }}` reject, is left to `fallback`, the call
 * that renders the template at runtime. A value that is written as text or a
 * number needs neither, and a template without values is its text.
 *
 * Undefined when a value has a side effect, since each one is read up to
 * three times here, and when the template has values but no text: the
 * formatter then prints a symbol, which a template literal throws on.
 */
export function buildNativeTemplate(
  template: t.TemplateLiteral,
  fallback: t.Expression
): t.Expression | undefined {
  const values: t.Expression[] = [];
  for (const expression of template.expressions) {
    const value = getValue(expression);
    if (
      !value ||
      !isSideEffectFree(value, { isPureCall: () => false, sameIdentity: true })
    ) {
      return undefined;
    }
    values.push(value);
  }
  if (values.length === 0) {
    const text = template.quasis[0].value.cooked ?? '';
    const literal = t.stringLiteral(text);
    // Printed as written, where the generator would escape non-ASCII text
    literal.extra = { rawValue: text, raw: JSON.stringify(text) };
    return literal;
  }

  if (template.quasis.every((quasi) => !quasi.value.cooked)) return undefined;

  const guarded = values.filter(
    (value, index) =>
      !isText(value) &&
      values.findIndex((other) => t.isNodesEquivalent(other, value)) === index
  );
  const literal = t.templateLiteral(
    template.quasis.map((quasi) => t.cloneNode(quasi)),
    values.map((value) =>
      isText(value)
        ? t.cloneNode(value, true)
        : t.logicalExpression(
            '??',
            t.cloneNode(value, true),
            t.stringLiteral('')
          )
    )
  );
  if (guarded.length === 0) return literal;
  const isObject = guarded
    .map(
      (value): t.Expression =>
        t.logicalExpression(
          '&&',
          t.binaryExpression(
            '==',
            t.unaryExpression('typeof', t.cloneNode(value, true)),
            t.stringLiteral('object')
          ),
          t.cloneNode(value, true)
        )
    )
    .reduce((left, right) => t.logicalExpression('||', left, right));
  return t.conditionalExpression(isObject, fallback, literal);
}

/** The value of a `{ name: value }` hole. */
function getValue(
  expression: t.Expression | t.TSType
): t.Expression | undefined {
  let object: t.Node = expression;
  while (
    t.isTSAsExpression(object) ||
    t.isTSSatisfiesExpression(object) ||
    t.isTSNonNullExpression(object) ||
    t.isTSTypeAssertion(object) ||
    t.isParenthesizedExpression(object)
  ) {
    object = object.expression;
  }
  if (!t.isObjectExpression(object) || object.properties.length !== 1) return;
  const [property] = object.properties;
  if (!t.isObjectProperty(property) || !t.isExpression(property.value)) return;
  return property.value;
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
