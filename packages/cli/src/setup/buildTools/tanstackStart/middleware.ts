// src/start.ts: the generated entry and gtMiddleware registration.
import * as t from '@babel/types';
import { Libraries } from '../../../types/libraries.js';
import type { ManualAction } from '../index.js';
import {
  DOCS_URL,
  getLocalImport,
  getPropertyName,
  type SourceFile,
} from './source.js';

export const START_CONTENT = `import { createCsrfMiddleware, createStart } from '@tanstack/react-start';
import { gtMiddleware } from '${Libraries.GT_TANSTACK_START}';

const csrfMiddleware = createCsrfMiddleware({
  filter: ({ handlerType }) => handlerType === 'serverFn',
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, gtMiddleware],
}));
`;

/** The objects `createStart(() => options)` returns directly. */
function getStartOptions(call: t.CallExpression): t.ObjectExpression[] {
  const getOptions = call.arguments[0];
  if (
    getOptions?.type !== 'ArrowFunctionExpression' &&
    getOptions?.type !== 'FunctionExpression'
  ) {
    return [];
  }
  if (getOptions.body.type !== 'BlockStatement') {
    return getOptions.body.type === 'ObjectExpression' ? [getOptions.body] : [];
  }
  return getOptions.body.body.flatMap((statement) =>
    statement.type === 'ReturnStatement' &&
    statement.argument?.type === 'ObjectExpression'
      ? [statement.argument]
      : []
  );
}

/**
 * Whether the imported gtMiddleware is listed in the requestMiddleware of the
 * createStart options. Comments, other middleware arrays, unrelated locals and
 * objects outside createStart do not count.
 */
export function registersMiddleware(start: SourceFile): boolean {
  const local = getLocalImport(start, 'gtMiddleware');
  if (!local) return false;
  let found = false;
  for (const statement of start.statements ?? []) {
    t.traverseFast(statement, (node) => {
      if (
        node.type !== 'CallExpression' ||
        !t.isIdentifier(node.callee, { name: 'createStart' })
      ) {
        return;
      }
      for (const options of getStartOptions(node)) {
        for (const property of options.properties) {
          if (
            property.type === 'ObjectProperty' &&
            getPropertyName(property) === 'requestMiddleware' &&
            property.value.type === 'ArrayExpression' &&
            property.value.elements.some(
              (element) =>
                element?.type === 'Identifier' && element.name === local
            )
          ) {
            found = true;
          }
        }
      }
    });
  }
  return found;
}

export function getMiddlewareAction(startPath: string): ManualAction {
  return {
    whatHappened: `${startPath} does not use gtMiddleware`,
    fix: `Import { gtMiddleware } from '${Libraries.GT_TANSTACK_START}' in ${startPath} and add it to the requestMiddleware of createStart, keeping your existing middleware such as the CSRF middleware, then rerun gt init (see ${DOCS_URL})`,
  };
}
