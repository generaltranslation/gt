import path from 'node:path';
import traverseModule, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';

const traverse: typeof traverseModule =
  (traverseModule as { default?: typeof traverseModule }).default ||
  traverseModule;

/**
 * next/root-params only resolves during a route render, so a converted
 * translation call in a `route.ts` or `'use server'` function 500s (round-10
 * finding 1). A handler under `[locale]` registers its route param instead.
 */

/** The exports Next.js renders as Route Handler entry points. */
const HTTP_METHOD_EXPORTS = new Set([
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'OPTIONS',
]);

/** gt-next's per-request locale registration, exported from gt-next/server. */
export const REGISTER_LOCALE = 'registerLocale';

/** What to do with a file whose converted code resolves the locale on the server. */
export type ServerEntryPlan =
  /** Not a Route Handler or Server Action, or one that never resolves a locale. */
  | { kind: 'none' }
  /**
   * A Route Handler or Server Action with no route param to pin the locale to.
   * The emitted getLocale.ts falls back to the middleware's locale header, so
   * the file still converts and owes the user a caveat rather than a hold.
   */
  | { kind: 'note'; reason: string }
  /**
   * A Route Handler with a reachable locale: `apply` writes
   * `registerLocale(<locale>)` first in each handler and the caller adds the
   * import. Planning probes every handler first, so `apply` cannot fail.
   */
  | { kind: 'register'; handlers: string[]; apply: () => void };

export type ServerEntryOptions = {
  ast: t.File;
  /** absolute path of the file being transformed */
  file: string;
  /** project root, for the app/-relative classification */
  cwd: string;
  /**
   * Call sites whose gt-next replacement resolves the request locale
   * (`getTranslations`, `getLocale`). Only these matter: a Route Handler that
   * never translates is not affected by next/root-params.
   */
  isLocaleResolvingCall: (call: t.CallExpression) => boolean;
};

const toPosix = (value: string) => value.split(path.sep).join('/');

/**
 * The locale route param a file under `app/` can read, or null. gt-next reads
 * that param only under the literal name `[locale]`, and a catch-all
 * (`[...locale]`) binds an array rather than a locale string.
 */
function localeRouteParam(file: string, cwd: string): string | null {
  const relative = toPosix(path.relative(cwd, file));
  if (!/^(?:src\/)?app\//.test(relative)) return null;
  return relative.split('/').includes('[locale]') ? 'locale' : null;
}

/** Whether a block or program carries the `'use server'` directive. */
function hasUseServerDirective(
  node: t.BlockStatement | t.Program | t.Node
): boolean {
  const directives = (node as { directives?: t.Directive[] }).directives;
  return (directives ?? []).some(
    (directive) => directive.value.value === 'use server'
  );
}

/**
 * Whether this call runs inside a Server Action: either the whole module
 * carries `'use server'`, or some enclosing function does (the inline
 * `async function submit() { 'use server'; ... }` form inside a page).
 */
function insideServerAction(callPath: NodePath): boolean {
  const program = callPath.findParent((parent) =>
    parent.isProgram()
  ) as NodePath<t.Program> | null;
  if (program && hasUseServerDirective(program.node)) return true;
  let fn = callPath.getFunctionParent();
  while (fn) {
    if (hasUseServerDirective(fn.node.body)) return true;
    fn = fn.getFunctionParent();
  }
  return false;
}

type Handler = { name: string; fn: NodePath<t.Function> };

/** The exported HTTP-method functions Next.js will call as route entry points. */
function collectRouteHandlers(ast: t.File): {
  handlers: Handler[];
  unresolved: string[];
} {
  const handlers: Handler[] = [];
  const unresolved: string[] = [];
  const record = (name: string, fn: NodePath<t.Node> | null | undefined) => {
    if (fn && (fn.isFunctionDeclaration() || fn.isFunctionExpression())) {
      handlers.push({ name, fn: fn as NodePath<t.Function> });
      return;
    }
    if (fn && fn.isArrowFunctionExpression()) {
      handlers.push({ name, fn: fn as NodePath<t.Function> });
      return;
    }
    unresolved.push(name);
  };
  traverse(ast, {
    ExportNamedDeclaration(exportPath) {
      const declaration = exportPath.get('declaration');
      if (Array.isArray(declaration)) return;
      if (declaration.isFunctionDeclaration()) {
        const name = declaration.node.id?.name;
        if (name && HTTP_METHOD_EXPORTS.has(name)) record(name, declaration);
        return;
      }
      if (declaration.isVariableDeclaration()) {
        for (const declarator of declaration.get('declarations')) {
          const id = declarator.node.id;
          if (!t.isIdentifier(id) || !HTTP_METHOD_EXPORTS.has(id.name))
            continue;
          record(id.name, declarator.get('init') as NodePath<t.Node>);
        }
        return;
      }
      // `export { GET }`: resolve the local binding back to its function.
      if (exportPath.node.source) return;
      for (const specifier of exportPath.node.specifiers) {
        if (!t.isExportSpecifier(specifier)) continue;
        const exported = t.isIdentifier(specifier.exported)
          ? specifier.exported.name
          : specifier.exported.value;
        if (!HTTP_METHOD_EXPORTS.has(exported)) continue;
        const binding = exportPath.scope.getBinding(specifier.local.name);
        if (!binding) {
          unresolved.push(exported);
          continue;
        }
        if (binding.path.isFunctionDeclaration()) {
          record(exported, binding.path);
        } else if (binding.path.isVariableDeclarator()) {
          record(exported, binding.path.get('init') as NodePath<t.Node>);
        } else {
          unresolved.push(exported);
        }
      }
    },
  });
  return { handlers, unresolved };
}

/** A `{ params: Promise<{ locale: string }> }` annotation for an added param. */
function paramsTypeAnnotation(localeParam: string): t.TSTypeAnnotation {
  const localeMember = t.tsPropertySignature(
    t.identifier(localeParam),
    t.tsTypeAnnotation(t.tsStringKeyword())
  );
  const paramsMember = t.tsPropertySignature(
    t.identifier('params'),
    t.tsTypeAnnotation(
      t.tsTypeReference(
        t.identifier('Promise'),
        t.tsTypeParameterInstantiation([t.tsTypeLiteral([localeMember])])
      )
    )
  );
  return t.tsTypeAnnotation(t.tsTypeLiteral([paramsMember]));
}

/** Adds the `{ params }` context parameter Next.js passes as argument 2. */
function addParamsParameter(
  fn: t.Function,
  localeParam: string,
  typescript: boolean
): t.Identifier {
  const binding = t.identifier('params');
  const pattern = t.objectPattern([
    t.objectProperty(t.identifier('params'), binding, false, true),
  ]);
  if (typescript) pattern.typeAnnotation = paramsTypeAnnotation(localeParam);
  if (fn.params.length === 0) {
    const request = t.identifier('_request');
    if (typescript) {
      request.typeAnnotation = t.tsTypeAnnotation(
        t.tsTypeReference(t.identifier('Request'))
      );
    }
    fn.params.push(request);
  }
  fn.params.push(pattern);
  return binding;
}

/**
 * The expression that yields this handler's locale, or why it cannot be built.
 * `await` is safe on both param shapes: Next >= 15 passes a promise and
 * awaiting the older plain object is a no-op. `commit` false skips the AST.
 */
function localeExpression(
  fn: t.Function,
  localeParam: string,
  typescript: boolean,
  commit: boolean
): { expression: t.Expression } | { reason: string } {
  const awaited = (source: t.Expression): t.Expression =>
    t.memberExpression(t.awaitExpression(source), t.identifier(localeParam));

  const context = fn.params[1];
  if (context === undefined) {
    if (fn.params.some((param) => t.isRestElement(param))) {
      return {
        reason:
          'its parameters are a rest element, so gt migrate cannot see or add the route-params argument',
      };
    }
    if (!commit) return { expression: awaited(t.identifier('params')) };
    return {
      expression: awaited(addParamsParameter(fn, localeParam, typescript)),
    };
  }

  if (t.isIdentifier(context)) {
    return {
      expression: awaited(
        t.memberExpression(t.identifier(context.name), t.identifier('params'))
      ),
    };
  }

  if (t.isObjectPattern(context)) {
    for (const property of context.properties) {
      if (
        !t.isObjectProperty(property) ||
        property.computed ||
        !t.isIdentifier(property.key, { name: 'params' })
      ) {
        continue;
      }
      if (t.isIdentifier(property.value)) {
        return { expression: awaited(t.identifier(property.value.name)) };
      }
      // `{ params: { locale } }`: the locale is already destructured out.
      if (t.isObjectPattern(property.value)) {
        for (const inner of property.value.properties) {
          if (
            t.isObjectProperty(inner) &&
            !inner.computed &&
            t.isIdentifier(inner.key, { name: localeParam }) &&
            t.isIdentifier(inner.value)
          ) {
            return { expression: t.identifier(inner.value.name) };
          }
        }
      }
      return {
        reason: `its route-params argument is destructured in a shape gt migrate cannot read (${localeParam} is not bound)`,
      };
    }
    if (context.properties.some((property) => t.isRestElement(property))) {
      return {
        reason:
          'its route-params argument is absorbed by a rest element, so adding `params` would change what that rest holds',
      };
    }
    const annotation = context.typeAnnotation;
    if (
      annotation &&
      (!t.isTSTypeAnnotation(annotation) ||
        !t.isTSTypeLiteral(annotation.typeAnnotation))
    ) {
      return {
        reason:
          'its second parameter carries a named type that gt migrate cannot extend with `params`',
      };
    }
    const binding = t.identifier('params');
    if (!commit) return { expression: awaited(binding) };
    context.properties.push(
      t.objectProperty(t.identifier('params'), binding, false, true)
    );
    if (
      annotation &&
      t.isTSTypeAnnotation(annotation) &&
      t.isTSTypeLiteral(annotation.typeAnnotation)
    ) {
      annotation.typeAnnotation.members.push(
        (paramsTypeAnnotation(localeParam).typeAnnotation as t.TSTypeLiteral)
          .members[0]
      );
    }
    return { expression: awaited(binding) };
  }

  return {
    reason:
      'its second parameter is not the `{ params }` context Next.js passes',
  };
}

/** `registerLocale(<expression>);` */
function registerLocaleStatement(
  expression: t.Expression
): t.ExpressionStatement {
  return t.expressionStatement(
    t.callExpression(t.identifier(REGISTER_LOCALE), [expression])
  );
}

/**
 * What a file resolving the locale on the server needs, decided before any
 * mutation runs so a `note` file never keeps a half-applied change.
 */
export function planServerEntryLocale(
  options: ServerEntryOptions
): ServerEntryPlan {
  const { ast, file, cwd, isLocaleResolvingCall } = options;
  const relative = toPosix(path.relative(cwd, file));
  const typescript = /\.[cm]?tsx?$/.test(file);

  const resolverCalls: NodePath<t.CallExpression>[] = [];
  let inServerAction = 0;
  traverse(ast, {
    CallExpression(callPath) {
      if (!isLocaleResolvingCall(callPath.node)) return;
      resolverCalls.push(callPath);
      if (insideServerAction(callPath)) inServerAction++;
    },
  });
  if (resolverCalls.length === 0) return { kind: 'none' };

  if (inServerAction > 0) {
    return {
      kind: 'note',
      reason:
        "Server Action ('use server') that resolves translations: next/root-params, which gt-next " +
        'resolves the locale through, is unavailable inside a Server Action, and an action has no ' +
        'route params to read either. The emitted getLocale.ts falls back to the locale header the ' +
        'gt-next middleware sets, so this action answers in the request locale wherever that ' +
        'middleware runs. Check that its matcher covers the paths these actions post to; on a path ' +
        `it does not cover the action renders in the default locale, so call ${REGISTER_LOCALE}() ` +
        "from 'gt-next/server' with a locale the caller passes in as the action's first statement",
    };
  }

  // Only Route Handlers are affected beyond Server Actions: a page, layout,
  // template or default IS a route render context, where next/root-params works.
  const isRouteHandler = /(^|\/)route\.[cm]?[jt]sx?$/.test(relative);
  if (!isRouteHandler) return { kind: 'none' };

  const cannotRegister = (why: string): ServerEntryPlan => ({
    kind: 'note',
    reason:
      'Route Handler that resolves translations: next/root-params, which gt-next resolves the ' +
      'locale through, is unavailable inside a Route Handler, and gt migrate could not register ' +
      `the route locale here because ${why}. The emitted getLocale.ts falls back to the locale ` +
      'header the gt-next middleware sets, so this handler answers in the request locale wherever ' +
      'that middleware runs (its matcher commonly excludes /api). Where it does not, the handler ' +
      `renders in the default locale: call ${REGISTER_LOCALE}(locale) from 'gt-next/server' as the ` +
      "handler's first statement with a locale you resolve yourself",
  });

  const localeParam = localeRouteParam(file, cwd);
  if (localeParam === null) {
    return cannotRegister(
      'the handler does not sit under a [locale] route segment, so it has no locale route param to read'
    );
  }

  const { handlers, unresolved } = collectRouteHandlers(ast);
  if (unresolved.length > 0) {
    return cannotRegister(
      `its ${unresolved.join(', ')} export is not a function declaration gt migrate can add a statement to`
    );
  }
  if (handlers.length === 0) {
    return cannotRegister(
      'the file exports no HTTP method handler (GET, POST, ...) to register the locale in'
    );
  }

  // A call in a module-level helper belongs to whichever handler reaches it,
  // which is not knowable here, so every handler registers. The store is
  // request-scoped, so registering in a handler that never translates is inert.
  const needsRegistration = new Set<t.Function>();
  for (const callPath of resolverCalls) {
    let fn = callPath.getFunctionParent();
    let owner: Handler | undefined;
    while (fn && !owner) {
      owner = handlers.find((handler) => handler.fn.node === fn!.node);
      fn = fn.getFunctionParent();
    }
    if (owner) {
      needsRegistration.add(owner.fn.node);
      continue;
    }
    if (callPath.getFunctionParent() === null) {
      return cannotRegister(
        'it resolves translations at module scope, which runs before any handler and therefore before any locale exists'
      );
    }
    for (const handler of handlers) needsRegistration.add(handler.fn.node);
  }

  const targets = handlers.filter((handler) =>
    needsRegistration.has(handler.fn.node)
  );
  for (const handler of targets) {
    if (!handler.fn.node.async) {
      return cannotRegister(
        `its ${handler.name} handler is not async, so the awaited route params cannot be read there`
      );
    }
    if (!t.isBlockStatement(handler.fn.node.body)) {
      return cannotRegister(
        `its ${handler.name} handler has an expression body, which has no place for a leading statement`
      );
    }
  }

  // Prove every handler is registerable before changing any of them, so a
  // refusal on the third handler cannot leave the first two with an added
  // parameter and no statement referencing it.
  for (const handler of targets) {
    const probe = localeExpression(
      handler.fn.node,
      localeParam,
      typescript,
      false
    );
    if ('reason' in probe) {
      return cannotRegister(`in its ${handler.name} handler, ${probe.reason}`);
    }
  }
  const statements: {
    fn: t.BlockStatement;
    statement: t.ExpressionStatement;
  }[] = [];
  for (const handler of targets) {
    const resolved = localeExpression(
      handler.fn.node,
      localeParam,
      typescript,
      true
    );
    if ('reason' in resolved) {
      return cannotRegister(
        `in its ${handler.name} handler, ${resolved.reason}`
      );
    }
    statements.push({
      fn: handler.fn.node.body as t.BlockStatement,
      statement: registerLocaleStatement(resolved.expression),
    });
  }

  return {
    kind: 'register',
    handlers: targets.map((handler) => handler.name),
    apply: () => {
      for (const { fn, statement } of statements) fn.body.unshift(statement);
    },
  };
}
