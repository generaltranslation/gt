import * as t from '@babel/types';
import { Part } from './extractString';

/**
 * Converts merged parts into an AST message node and optional variables object.
 *
 * - All static → StringLiteral, no variables
 * - Has derive/dynamic → TemplateLiteral with derive expressions preserved
 *   and dynamic values extracted as {n} placeholders
 */
export function buildTransformResult(parts: Part[]): {
  message: t.StringLiteral | t.TemplateLiteral;
  variables: t.ObjectExpression | null;
} {
  const hasDerive = parts.some((p) => p.type === 'derive');

  // No derive parts: collapse everything into a StringLiteral with {n} placeholders
  if (!hasDerive) {
    const properties: t.ObjectProperty[] = [];
    let varIndex = 0;
    let message = '';
    for (const part of parts) {
      if (part.type === 'static') {
        message += part.content;
      } else {
        const key = varIndex.toString();
        message += `{${key}}`;
        properties.push(t.objectProperty(t.stringLiteral(key), part.content));
        varIndex++;
      }
    }
    return {
      message: t.stringLiteral(message),
      variables: properties.length > 0 ? t.objectExpression(properties) : null,
    };
  }

  // Has derive parts: build a TemplateLiteral with derive expressions preserved
  const quasis: t.TemplateElement[] = [];
  const expressions: t.Expression[] = [];
  const properties: t.ObjectProperty[] = [];
  let varIndex = 0;
  let quasiBuffer = '';

  function flushQuasi(tail: boolean) {
    quasis.push(
      t.templateElement({ raw: quasiBuffer, cooked: quasiBuffer }, tail)
    );
    quasiBuffer = '';
  }

  for (const part of parts) {
    if (part.type === 'static') {
      quasiBuffer += part.content;
    } else if (part.type === 'derive') {
      flushQuasi(false);
      expressions.push(part.content);
    } else {
      // TODO: probably should have better name than '{0}' for the variable key
      const key = varIndex.toString();
      quasiBuffer += `{${key}}`;
      properties.push(t.objectProperty(t.stringLiteral(key), part.content));
      varIndex++;
    }
  }

  // Final quasi (tail)
  flushQuasi(true);

  return {
    message: t.templateLiteral(quasis, expressions),
    variables: properties.length > 0 ? t.objectExpression(properties) : null,
  };
}
