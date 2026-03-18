import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import { isDeriveInvocation } from '../../utils/parsing/isDeriveInvocation';

/**
 * Converts template literal quasis and expressions into an ICU-style message
 * string with numeric variable placeholders ({0}, {1}, etc.).
 */
export function transformTemplateLiteral(path: NodePath<t.TemplateLiteral>): {
  message: t.TemplateLiteral;
  variables: t.ObjectExpression | null;
} {
  const node = path.node;
  const properties: t.ObjectProperty[] = [];
  let varIndex = 0;

  // Tracking
  const currentParts: Array<string | undefined> = [];
  let currentPartsRaw: string[] = [];
  let currentPartsCooked: Array<string | undefined> = [];
  const templateElements: t.TemplateElement[] = [];
  const templateExpressions: t.Expression[] = [];
  function recordTemplateElement() {
    templateElements.push(
      t.templateElement(
        { cooked: currentPartsCooked.join(''), raw: currentPartsRaw.join('') },
        false
      )
    );
    currentPartsCooked = [];
    currentPartsRaw = [];
  }

  for (let i = 0; i < node.quasis.length; i++) {
    // Add the cooked text from the quasi (use cooked to handle escape sequences)
    const { cooked, raw } = node.quasis[i].value;
    currentParts.push(cooked ?? raw);
    currentPartsCooked.push(cooked);
    currentPartsRaw.push(raw);

    // If there's a corresponding expression, create a variable placeholder
    if (i < node.expressions.length) {
      const expr = node.expressions[i] as t.Expression;
      // Skip un-interpolation step for derive invocations
      if (isDeriveInvocation(expr, path)) {
        templateExpressions.push(expr);
        recordTemplateElement();
        continue;
      }
      const key = varIndex.toString();
      currentParts.push(`{${key}}`);
      properties.push(t.objectProperty(t.stringLiteral(key), expr));
      varIndex++;
    }
  }

  // capture any remaining parts
  if (currentParts.length > 0) {
    recordTemplateElement();
  }

  // mark last template element as tail
  if (templateElements.length > 0) {
    templateElements[templateElements.length - 1].tail = true;
  }

  return {
    message: t.templateLiteral(templateElements, templateExpressions),
    variables: properties.length > 0 ? t.objectExpression(properties) : null,
  };
}
