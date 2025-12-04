import { Metadata } from 'generaltranslation/types';
import * as t from '@babel/types';
import generateModule from '@babel/generator';
// Handle CommonJS/ESM interop
const generate = generateModule.default || generateModule;

import { GT_ATTRIBUTES, mapAttributeName } from '../constants.js';
import { isStaticExpression } from '../../evaluateJsx.js';
import {
  warnInvalidMaxCharsSync,
  warnVariablePropSync,
} from '../../../../console/index.js';

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

    if (attr.value) {
      // If it's a plain string literal like id="hello"
      if (t.isStringLiteral(attr.value)) {
        metadata[attrName] = attr.value.value;
      }
      // If it's an expression container like id={"hello"}, id={someVar}, etc.
      else if (t.isJSXExpressionContainer(attr.value)) {
        const expr = attr.value.expression;
        const code = generate(expr).code;

        // Only check for static expressions on id and context and maxChars props
        if (
          GT_ATTRIBUTES.includes(attrName as (typeof GT_ATTRIBUTES)[number])
        ) {
          const staticAnalysis = isStaticExpression(expr);
          if (!staticAnalysis.isStatic) {
            componentErrors.push(
              warnVariablePropSync(
                file,
                attrName,
                code,
                `${expr.loc?.start?.line}:${expr.loc?.start?.column}`
              )
            );
          }
          // Use the static value if available
          if (staticAnalysis.isStatic && staticAnalysis.value !== undefined) {
            // Check for invalid maxChars values
            if (attrName === '$maxChars' || attrName === 'maxChars') {
              if (
                typeof staticAnalysis.value === 'string' &&
                (isNaN(Number(staticAnalysis.value)) ||
                  !t.isNumericLiteral(expr) ||
                  Number(staticAnalysis.value) < 0 ||
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
                metadata[mapAttributeName(attrName)] = Number(
                  staticAnalysis.value
                );
              }
            } else {
              // Add the $context or $id or other attributes value to the metadata
              metadata[mapAttributeName(attrName)] = staticAnalysis.value;
            }
          } else {
            // Only store the code if we couldn't extract a static value
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
