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

/**
 * Whether the imported gtMiddleware is listed in a requestMiddleware array.
 * Comments, other middleware arrays and unrelated locals do not count.
 */
export function registersMiddleware(start: SourceFile): boolean {
  const local = getLocalImport(start, 'gtMiddleware');
  if (!local) return false;
  let found = false;
  for (const statement of start.statements ?? []) {
    t.traverseFast(statement, (node) => {
      if (
        node.type === 'ObjectProperty' &&
        getPropertyName(node) === 'requestMiddleware' &&
        node.value.type === 'ArrayExpression' &&
        node.value.elements.some(
          (element) => element?.type === 'Identifier' && element.name === local
        )
      ) {
        found = true;
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
