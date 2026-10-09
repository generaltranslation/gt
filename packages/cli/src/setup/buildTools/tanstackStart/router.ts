// src/router.tsx: the setupRouterGTIntegration call in getRouter.
import * as t from '@babel/types';
import { Libraries } from '../../../types/libraries.js';
import { parseModule } from '../../setupViteSPA.js';
import type { ManualAction } from '../index.js';
import {
  applyEdits,
  getCodeStyle,
  getImportEdit,
  getOwnLineIndent,
} from '../shared/edits.js';
import {
  callsFunction,
  getBindingAt,
  getLocalImport,
  getPropertyName,
  usesName,
  type SourceFile,
} from '../shared/source.js';
import { DOCS_URL } from './source.js';

const ROUTER_INTEGRATION = 'setupRouterGTIntegration';

function getRouterIntegrationImport(router: SourceFile): string | undefined {
  return getLocalImport(
    router,
    ROUTER_INTEGRATION,
    Libraries.GT_TANSTACK_START
  );
}

/**
 * Whether getRouter integrates the router it returns, before that return and
 * on every path through it.
 */
export function callsRouterIntegration(router: SourceFile): boolean {
  const local = getRouterIntegrationImport(router);
  const onlyReturn =
    local && router.statements ? findOnlyReturn(router.statements) : undefined;
  if (!onlyReturn) return false;
  const { body, returned } = onlyReturn;
  return body.some((statement) => {
    if (
      statement.type !== 'ExpressionStatement' ||
      statement.expression.type !== 'CallExpression' ||
      !t.isIdentifier(statement.expression.callee, { name: local })
    ) {
      return false;
    }
    const options = statement.expression.arguments[0];
    if (options?.type !== 'ObjectExpression') return false;
    // A spread or computed key could replace the router that is integrated.
    const names = options.properties.map(getPropertyName);
    if (names.includes(undefined)) return false;
    const routers = options.properties.filter(
      (property, index) => names[index] === 'router'
    );
    return (
      routers.length === 1 &&
      routers[0].type === 'ObjectProperty' &&
      t.isIdentifier(routers[0].value, { name: returned })
    );
  });
}

function findGetRouterBody(
  statements: t.Statement[]
): t.BlockStatement | undefined {
  for (const statement of statements) {
    const declaration =
      statement.type === 'ExportNamedDeclaration'
        ? statement.declaration
        : statement;
    if (
      declaration?.type === 'FunctionDeclaration' &&
      declaration.id?.name === 'getRouter'
    ) {
      return declaration.body;
    }
    if (declaration?.type !== 'VariableDeclaration') continue;
    for (const { id, init } of declaration.declarations) {
      if (
        t.isIdentifier(id, { name: 'getRouter' }) &&
        (init?.type === 'ArrowFunctionExpression' ||
          init?.type === 'FunctionExpression') &&
        init.body.type === 'BlockStatement'
      ) {
        return init.body;
      }
    }
  }
  return undefined;
}

/**
 * getRouter's body when it ends in its only return, of an identifier. An
 * earlier return could hand back a router without the integration.
 */
function findOnlyReturn(statements: t.Statement[]):
  | {
      body: t.Statement[];
      routerReturn: t.ReturnStatement;
      returned: string;
    }
  | undefined {
  const getRouter = findGetRouterBody(statements);
  const routerReturn = getRouter?.body.at(-1);
  if (
    !getRouter ||
    routerReturn?.type !== 'ReturnStatement' ||
    routerReturn.argument?.type !== 'Identifier'
  ) {
    return undefined;
  }
  // Returns inside nested functions belong to those functions.
  const nestedFunctions: t.Function[] = [];
  const returns: t.ReturnStatement[] = [];
  t.traverseFast(getRouter, (node) => {
    if (t.isFunction(node)) nestedFunctions.push(node);
    if (node.type === 'ReturnStatement') returns.push(node);
  });
  const ownReturns = returns.filter(
    (statement) =>
      !nestedFunctions.some(
        (fn) => fn.start! <= statement.start! && statement.end! <= fn.end!
      )
  );
  return ownReturns.length === 1
    ? {
        body: getRouter.body,
        routerReturn,
        returned: routerReturn.argument.name,
      }
    : undefined;
}

/**
 * The `return router` ending getRouter after `const router =
 * createRouter(...)`, the create-start shape. Any other shape is left for
 * manual setup.
 */
function findRouterReturn(
  router: SourceFile,
  statements: t.Statement[]
): t.ReturnStatement | undefined {
  const createRouter = getLocalImport(
    router,
    'createRouter',
    '@tanstack/react-router'
  );
  const onlyReturn = createRouter ? findOnlyReturn(statements) : undefined;
  if (!onlyReturn || onlyReturn.returned !== 'router') return undefined;
  const { body, routerReturn } = onlyReturn;
  const declared = body.findIndex(
    (statement) =>
      statement.type === 'VariableDeclaration' &&
      statement.kind === 'const' &&
      statement.declarations.some(
        ({ id, init }) =>
          t.isIdentifier(id, { name: 'router' }) &&
          init?.type === 'CallExpression' &&
          t.isIdentifier(init.callee, { name: createRouter })
      )
  );
  return declared === -1 ? undefined : routerReturn;
}

/** The router with setupRouterGTIntegration, or undefined when unsupported. */
export function configureRouter(router: SourceFile): string | undefined {
  const { content, statements } = router;
  if (!statements) return undefined;
  const local = getRouterIntegrationImport(router);
  // Another binding with this name would clash with the added import, and an
  // existing call that does not integrate the returned router needs review.
  if (
    local
      ? callsFunction(statements, local)
      : usesName(statements, [ROUTER_INTEGRATION])
  ) {
    return undefined;
  }
  const routerReturn = findRouterReturn(router, statements);
  const indent = routerReturn && getOwnLineIndent(content, routerReturn.start!);
  if (!routerReturn || indent === undefined) return undefined;
  // A local binding could hide the import where the call is added.
  if (
    local &&
    getBindingAt(statements, routerReturn, local)?.kind !== 'module'
  ) {
    return undefined;
  }
  const { quote, semi, eol } = getCodeStyle(content, statements);
  const configured = applyEdits(content, [
    {
      start: routerReturn.start!,
      text: `${local ?? ROUTER_INTEGRATION}({ router })${semi}${eol}${indent}`,
    },
    ...(local
      ? []
      : [
          getImportEdit(
            statements,
            [
              `import { ${ROUTER_INTEGRATION} } from ${quote}${Libraries.GT_TANSTACK_START}${quote}${semi}`,
            ],
            eol
          ),
        ]),
  ]);
  return parseModule(configured, router.path) ? configured : undefined;
}

export function getRouterAction(routerPath: string): ManualAction {
  return {
    whatHappened: `${routerPath} was not configured automatically`,
    fix: `Add import { ${ROUTER_INTEGRATION} } from '${Libraries.GT_TANSTACK_START}' to ${routerPath}, and call ${ROUTER_INTEGRATION}({ router }) in getRouter before it returns the router (see ${DOCS_URL})`,
  };
}
