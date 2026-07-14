import { Metadata } from 'generaltranslation/types';
import * as t from '@babel/types';
import generateModule from '@babel/generator';
// Handle CommonJS/ESM interop
const generate = generateModule.default || generateModule;

import { GT_ATTRIBUTES } from '../constants.js';
import { mapAttributeName } from '../mapAttributeName.js';
import { isStaticExpression } from '../../evaluateJsx.js';
import {
  warnInvalidMaxCharsSync,
  warnInvalidRequiresReviewSync,
  warnVariablePropSync,
} from '../../../../console/index.js';
import { isNumberLiteral } from '../isNumberLiteral.js';
import { containsDeriveCall } from '../stringParsing/derivation/containsDeriveCall.js';

// Parse the props of a <T> component
export function parseTProps({
  openingElement,
  metadata,
  componentErrors,
  file,
}: {
  openingElement: t.JSXOpeningElement;
  metadata: Metadata;
  componentErrors: string[];
  file: string;
}) {
  openingElement.attributes.forEach((attr) => {
    if (!t.isJSXAttribute(attr)) return;
    const attrName = attr.name.name;
    if (typeof attrName !== 'string') return;

    const isRequiresReviewAttr =
      attrName === 'requiresReview' || attrName === '$requiresReview';

    // requiresReview is boolean-only and hash-changing, so it gets strict
    // handling before the generic attribute logic:
    // - bare attribute (<T requiresReview>) compiles to `requiresReview: true`,
    //   so it must mean true here too or CLI and compiler hashes disagree
    // - string values like requiresReview="false" are rejected, never coerced
    if (isRequiresReviewAttr) {
      if (!attr.value) {
        metadata[mapAttributeName(attrName)] = true;
        return;
      }
      if (
        t.isJSXExpressionContainer(attr.value) &&
        t.isBooleanLiteral(attr.value.expression)
      ) {
        metadata[mapAttributeName(attrName)] = attr.value.expression.value;
        return;
      }
      const code = t.isJSXExpressionContainer(attr.value)
        ? generate(attr.value.expression).code
        : generate(attr.value).code;
      componentErrors.push(
        warnInvalidRequiresReviewSync(
          file,
          code,
          `${attr.value.loc?.start?.line}:${attr.value.loc?.start?.column}`
        )
      );
      return;
    }

    if (attr.value) {
      // If it's a plain string literal like id="hello" or $context="nav"
      if (t.isStringLiteral(attr.value)) {
        if (attrName === '$maxChars' || attrName === 'maxChars') {
          // String-typed maxChars is rejected in the expression path
          // (maxChars={"10"}), so reject the bare string form too
          componentErrors.push(
            warnInvalidMaxCharsSync(
              file,
              generate(attr.value).code,
              `${attr.value.loc?.start?.line}:${attr.value.loc?.start?.column}`
            )
          );
        } else {
          // Map $-prefixed names ($context -> context, $id -> id, ...) so
          // hashing and registration read them; other names pass through
          metadata[mapAttributeName(attrName)] = attr.value.value;
        }
      }
      // If it's an expression container like id={"hello"}, id={someVar}, etc.
      else if (t.isJSXExpressionContainer(attr.value)) {
        const expr = attr.value.expression;
        const code = generate(expr).code;

        // Only check for derivable expressions on id and context and maxChars props
        if (
          GT_ATTRIBUTES.includes(attrName as (typeof GT_ATTRIBUTES)[number])
        ) {
          const staticAnalysis = isStaticExpression(expr);
          if (!staticAnalysis.isStatic) {
            if (
              mapAttributeName(attrName) === 'context' &&
              t.isExpression(expr) &&
              containsDeriveCall(expr)
            ) {
              metadata._contextDeriveExpr = expr;
            } else {
              componentErrors.push(
                warnVariablePropSync(
                  file,
                  attrName,
                  code,
                  `${expr.loc?.start?.line}:${expr.loc?.start?.column}`
                )
              );
            }
          }
          // Use the derived value if available
          if (staticAnalysis.isStatic && staticAnalysis.value !== undefined) {
            // Check for invalid maxChars values
            if (attrName === '$maxChars' || attrName === 'maxChars') {
              if (
                typeof staticAnalysis.value === 'string' &&
                (isNaN(Number(staticAnalysis.value)) ||
                  (t.isExpression(expr) && !isNumberLiteral(expr)) ||
                  !Number.isInteger(Number(staticAnalysis.value)))
              ) {
                componentErrors.push(
                  warnInvalidMaxCharsSync(
                    file,
                    code,
                    `${expr.loc?.start?.line}:${expr.loc?.start?.column}`
                  )
                );
              } else {
                // Add the maxChars value to the metadata
                metadata[mapAttributeName(attrName)] = Math.abs(
                  Number(staticAnalysis.value)
                );
              }
            } else {
              // Add the $context or $id or other attributes value to the metadata
              metadata[mapAttributeName(attrName)] = staticAnalysis.value;
            }
          } else {
            // Only store the code if we couldn't extract a derivable value
            metadata[attrName] = code;
          }
        } else {
          // For other attributes that aren't id or context
          metadata[attrName] = code;
        }
      }
    }
  });
}
