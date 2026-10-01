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
 * The options object returned by `export const startInstance = createStart(...)`,
 * the entry Start reads. Only a callback that returns an object literal
 * directly counts; any other shape is left for manual setup.
 */
function getStartOptions(start: SourceFile): t.ObjectExpression | undefined {
  const createStart = getLocalImport(
    start,
    'createStart',
    '@tanstack/react-start'
  );
  if (!createStart) return undefined;
  for (const statement of start.statements ?? []) {
    if (statement.type !== 'ExportNamedDeclaration') continue;
    if (statement.declaration?.type !== 'VariableDeclaration') continue;
    for (const { id, init } of statement.declaration.declarations) {
      if (
        !t.isIdentifier(id, { name: 'startInstance' }) ||
        init?.type !== 'CallExpression' ||
        !t.isIdentifier(init.callee, { name: createStart })
      ) {
        continue;
      }
      const getOptions = init.arguments[0];
      if (
        getOptions?.type !== 'ArrowFunctionExpression' &&
        getOptions?.type !== 'FunctionExpression'
      ) {
        return undefined;
      }
      const { body } = getOptions;
      const options =
        body.type !== 'BlockStatement'
          ? body
          : body.body.length === 1 && body.body[0].type === 'ReturnStatement'
            ? body.body[0].argument
            : undefined;
      return options?.type === 'ObjectExpression' ? options : undefined;
    }
  }
  return undefined;
}

/**
 * Whether the imported gtMiddleware is in the one requestMiddleware array of
 * the startInstance options. A spread or computed key could override it.
 */
export function registersMiddleware(start: SourceFile): boolean {
  const local = getLocalImport(start, 'gtMiddleware');
  const options = local ? getStartOptions(start) : undefined;
  if (!options) return false;
  const names = options.properties.map(getPropertyName);
  if (
    names.includes(undefined) ||
    names.filter((name) => name === 'requestMiddleware').length !== 1
  ) {
    return false;
  }
  const middleware = options.properties[names.indexOf('requestMiddleware')];
  return (
    middleware.type === 'ObjectProperty' &&
    middleware.value.type === 'ArrayExpression' &&
    middleware.value.elements.some((element) =>
      t.isIdentifier(element, { name: local })
    )
  );
}

export function getMiddlewareAction(startPath: string): ManualAction {
  return {
    whatHappened: `${startPath} does not use gtMiddleware`,
    fix: `Import { gtMiddleware } from '${Libraries.GT_TANSTACK_START}' in ${startPath} and add it to the requestMiddleware of createStart, keeping your existing middleware such as the CSRF middleware, then rerun gt init (see ${DOCS_URL})`,
  };
}
