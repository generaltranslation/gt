import * as t from '@babel/types';
import traverseModule, { type NodePath } from '@babel/traverse';
import {
  componentName,
  ensureStaticHelper,
  opaque,
  runtimeAllowsJsx,
  runtimeHelper,
  updateRuntimeToSingle,
  variables,
} from './bindings.js';
import {
  attributeSlot,
  bodySlot,
  childrenSlot,
  expressionPath,
  expressionSlot,
  hasText,
  inlineObject,
  isRuntimeJsx,
  makeRawBodyDynamic,
  needsVariable,
  propertyName,
  type ElementPath,
  type Slot,
  type ValuePath,
} from './syntax.js';
import {
  containsStyleBoundary,
  isStyleJsxElement,
  isProtectedRuntimeCall,
  styleChildSegments,
} from '../styleBoundary.js';
import {
  INTERNAL_TRANSLATION_COMPONENT as internalT,
  INTERNAL_VAR_COMPONENT as internalVar,
} from '../../constants.js';
import { createEnumConstants } from './enumConstants.js';
import { preserveMemberParentheses } from './preserveSyntax.js';
import {
  resolveAutoJsxRuntime,
  type AutoJsxRuntimeContext,
} from './projectRuntime.js';

const traverse = traverseModule.default || traverseModule;

/** Mutate insertion sites while keeping the caller's expressions, types and comments. */
export function insertAutoJsx(
  ast: t.File,
  aliases: Record<string, string>,
  mark: (node: t.Node) => void,
  context?: AutoJsxRuntimeContext
): void {
  preserveMemberParentheses(ast);
  const rawJsxEnabled = runtimeAllowsJsx(ast, resolveAutoJsxRuntime(context));
  const constant = createEnumConstants(ast);
  const processed = new WeakSet<t.Node>();
  const tName =
    Object.entries(aliases).find(
      ([, original]) => original === internalT
    )?.[0] ?? internalT;
  const varName =
    Object.entries(aliases).find(
      ([, original]) => original === internalVar
    )?.[0] ?? internalVar;

  function generated<T extends t.Node>(node: T): T {
    mark(node);
    processed.add(node);
    return node;
  }

  function jsxWrapper(
    name: string,
    children: t.JSXElement['children'],
    attrs: t.JSXAttribute[] = []
  ): t.JSXElement {
    return generated(
      t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier(name),
          attrs,
          children.length === 0
        ),
        children.length ? t.jsxClosingElement(t.jsxIdentifier(name)) : null,
        children
      )
    );
  }

  function asChild(expr: t.Expression): t.JSXElement['children'][number] {
    return t.isJSXElement(expr) || t.isJSXFragment(expr)
      ? expr
      : t.jsxExpressionContainer(expr);
  }

  function callWrapper(
    name: string,
    content: t.Expression,
    owner: NodePath<t.CallExpression>,
    multiple: boolean
  ): t.CallExpression {
    const runtime = runtimeHelper(owner, multiple);
    const args: t.Expression[] = [
      t.identifier(name),
      t.objectExpression([t.objectProperty(t.identifier('children'), content)]),
    ];
    if (runtime.development)
      args.push(
        t.unaryExpression('void', t.numericLiteral(0)),
        t.booleanLiteral(multiple)
      );
    return generated(t.callExpression(runtime.callee, args));
  }

  function variable(expr: t.Expression, owner: ElementPath): t.Expression {
    return owner.isCallExpression()
      ? callWrapper(varName, expr, owner, false)
      : jsxWrapper(varName, [asChild(expr)]);
  }

  function translationContent(
    content: t.Expression,
    owner: ElementPath,
    multiple: boolean
  ): t.Expression {
    if (owner.isCallExpression())
      return callWrapper(tName, content, owner, multiple);
    if (multiple)
      return generated(
        t.callExpression(ensureStaticHelper(owner), [
          t.identifier(tName),
          t.objectExpression([
            t.objectProperty(t.identifier('children'), content),
          ]),
        ])
      );
    return jsxWrapper(tName, [asChild(content)]);
  }

  function translation(slot: Slot, owner: ElementPath): t.Expression {
    if (slot.raw)
      return jsxWrapper(tName, [...(slot.originalChildren?.() ?? [])]);
    const content = slot.expression!.node as t.Expression;
    if (slot.quoted && t.isStringLiteral(content))
      return jsxWrapper(
        tName,
        [],
        [t.jsxAttribute(t.jsxIdentifier('children'), content)]
      );
    return translationContent(content, owner, slot.array);
  }

  function isElement(path: ValuePath): path is ElementPath {
    if (path.isCallExpression()) return isRuntimeJsx(path);
    return (
      rawJsxEnabled &&
      (path.isJSXElement() || path.isJSXFragment()) &&
      isRuntimeJsx(path)
    );
  }

  function isOpaque(path: ValuePath): boolean {
    path = expressionPath(path);
    if (path.isJSXExpressionContainer())
      return isOpaque(path.get('expression'));
    return isElement(path) && opaque.has(componentName(path) ?? '');
  }

  function markValue(path: ValuePath): void {
    path = expressionPath(path);
    if (path.isJSXExpressionContainer()) {
      markValue(path.get('expression'));
      return;
    }
    if (isElement(path)) {
      processed.add(path.node);
      for (const child of childrenSlot(path).values()) markValue(child);
    } else if (path.isArrayExpression()) {
      for (const child of path.get('elements'))
        if (child.isExpression()) markValue(child);
    }
  }

  function markChildren(path: ElementPath): void {
    for (const child of childrenSlot(path).values()) markValue(child);
  }

  function processValue(
    path: ValuePath,
    inside: boolean,
    owner: ElementPath
  ): void {
    if (
      !path.node ||
      path.isJSXText() ||
      path.isJSXEmptyExpression() ||
      path.isSpreadElement() ||
      path.isJSXSpreadChild()
    )
      return;
    if (path.isJSXExpressionContainer()) {
      processValue(path.get('expression'), inside, owner);
      return;
    }
    const value = expressionPath(path);
    if (isElement(value)) {
      if (!processed.has(value.node)) processElement(value, inside);
      return;
    }
    if (
      inside &&
      path.isExpression() &&
      (needsVariable(path, constant) ||
        ((value.isJSXElement() || value.isJSXFragment()) && !rawJsxEnabled))
    )
      path.replaceWith(variable(path.node, owner));
  }

  function processSlot(slot: Slot, inside: boolean, owner: ElementPath): void {
    for (const value of slot.values()) processValue(value, inside, owner);
  }

  function processStyleSlot(slot: Slot, owner: ElementPath): void {
    for (const segment of styleChildSegments(
      slot.allValues() as NodePath[]
    ).reverse()) {
      const values = slot.allValues().slice(segment.start, segment.end);
      const claim =
        !segment.boundary &&
        values.some((value) => hasText(value, constant) || isOpaque(value));
      for (const value of values) processValue(value, claim, owner);
      if (!claim) continue;
      const current = slot.allValues().slice(segment.start, segment.end);
      let wrapped: t.Expression;
      if (slot.raw)
        wrapped = jsxWrapper(
          tName,
          current.map((value) => value.node) as t.JSXElement['children']
        );
      else {
        const values = current.map(
          (value) => value.node
        ) as t.ArrayExpression['elements'];
        const content =
          values.length === 1 && t.isExpression(values[0])
            ? values[0]
            : t.arrayExpression(values);
        wrapped = translationContent(
          content,
          owner,
          t.isArrayExpression(content)
        );
      }
      slot.splice(segment.start, segment.end - segment.start, wrapped);
    }
  }

  function processChildren(owner: ElementPath, inside: boolean): void {
    const slot = childrenSlot(owner);
    if (
      slot
        .allValues()
        .some((value) => value.node && containsStyleBoundary(value as NodePath))
    ) {
      processStyleSlot(slot, owner);
      return;
    }
    const claim =
      !inside &&
      slot
        .values()
        .some((value) => hasText(value, constant) || isOpaque(value));
    processSlot(slot, inside || claim, owner);
    if (claim) {
      slot.replace(translation(slot, owner));
      if (owner.isCallExpression()) updateRuntimeToSingle(owner);
      else if (!slot.raw && (owner.isJSXElement() || owner.isJSXFragment()))
        makeRawBodyDynamic(owner);
    }
  }

  function opaqueProperty(
    path: NodePath,
    name: string | undefined,
    component: string,
    owner: ElementPath,
    slot?: Slot
  ): void {
    if (
      component === 'Branch' &&
      (name === 'branch' || name?.startsWith('data-'))
    )
      return;
    if (component === 'Plural' && (name === 'n' || name === 'locales')) return;
    if (name === 'children') {
      if (component !== 'Derive' && slot) processSlot(slot, true, owner);
      return;
    }
    const value = expressionPath(path);
    if (isElement(value)) {
      processSlot(childrenSlot(value), true, value);
      markValue(value);
    } else if (path.isExpression() && needsVariable(path, constant))
      path.replaceWith(variable(path.node, owner));
  }

  function opaqueObject(
    object: NodePath<t.ObjectExpression>,
    owner: ElementPath,
    component: string
  ): void {
    for (const property of object.get('properties')) {
      if (!property.isObjectProperty()) continue;
      const value = property.get('value');
      if (!value.isExpression()) continue;
      const original = value.node;
      opaqueProperty(
        value,
        propertyName(property),
        component,
        owner,
        expressionSlot(value)
      );
      if (value.node !== original) property.node.shorthand = false;
    }
  }

  function processOpaque(owner: ElementPath, component: string): void {
    if (owner.isCallExpression()) {
      const props = owner.get('arguments')[1];
      const object = props && expressionPath(props);
      if (object?.isObjectExpression()) opaqueObject(object, owner, component);
      return;
    }
    if (!owner.isJSXElement()) return;
    for (const attr of owner.get('openingElement').get('attributes')) {
      if (attr.isJSXAttribute()) {
        const name = t.isJSXIdentifier(attr.node.name)
          ? attr.node.name.name
          : undefined;
        if (name === 'key') continue;
        const value = attr.get('value');
        const slot = attributeSlot(attr);
        if (value.isJSXExpressionContainer())
          opaqueProperty(value.get('expression'), name, component, owner, slot);
        else if (name === 'children' && component !== 'Derive' && slot)
          processSlot(slot, true, owner);
      } else if (attr.isJSXSpreadAttribute()) {
        const object = inlineObject(attr.get('argument'));
        if (object) opaqueObject(object, owner, component);
      }
    }
    if (component !== 'Derive') processSlot(bodySlot(owner), true, owner);
  }

  function processElement(path: ElementPath, inside: boolean): void {
    if (
      (path.isJSXElement() && isStyleJsxElement(path)) ||
      (path.isCallExpression() && isProtectedRuntimeCall(path))
    ) {
      path.skip();
      return;
    }
    processed.add(path.node);
    if (path.isCallExpression() && !path.get('arguments')[0]?.isExpression())
      return;
    const component = componentName(path);
    if (component === 'T' || variables.has(component ?? '')) {
      markChildren(path);
      return;
    }
    if (component === internalT || component === internalVar) return;
    if (opaque.has(component ?? '')) {
      processOpaque(path, component!);
      if (!inside) path.replaceWith(translationContent(path.node, path, false));
      return;
    }
    processChildren(path, inside);
  }

  function visit(path: ElementPath): void {
    if (path.isCallExpression() && isProtectedRuntimeCall(path)) {
      path.skip();
      return;
    }
    if (!isElement(path)) return;
    if (
      (path.isJSXElement() && isStyleJsxElement(path)) ||
      variables.has(componentName(path) ?? '')
    ) {
      path.skip();
      return;
    }
    if (!processed.has(path.node)) processElement(path, false);
  }

  traverse(ast, {
    JSXElement: visit,
    JSXFragment: visit,
    CallExpression: visit,
  });
}
