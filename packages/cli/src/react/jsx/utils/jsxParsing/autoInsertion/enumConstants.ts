import traverseModule, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import type { ValuePath } from './syntax.js';

const traverse = traverseModule.default || traverseModule;
type Literal = string | number;
type EnumInfo = { members: Map<string, Literal | undefined> };
type EnumDeclaration = { path: NodePath<t.TSEnumDeclaration>; info: EnumInfo };

function isFrame(path: NodePath): boolean {
  // Babel does not create TypeScript namespace scopes or register enum bindings.
  return path.isTSModuleBlock() || path.scope.path.node === path.node;
}

function owner(path: NodePath): NodePath {
  let current = path.parentPath;
  while (current && !isFrame(current)) current = current.parentPath;
  return current ?? path;
}

function memberName(member: t.TSEnumMember): string {
  return t.isIdentifier(member.id) ? member.id.name : member.id.value;
}

function propertyName(member: t.MemberExpression): string | undefined {
  if (!member.computed && t.isIdentifier(member.property))
    return member.property.name;
  if (member.property.extra?.parenthesized) return;
  if (member.computed && t.isStringLiteral(member.property))
    return member.property.value;
  if (
    member.computed &&
    t.isTemplateLiteral(member.property) &&
    member.property.expressions.length === 0
  )
    return member.property.quasis[0]?.value.cooked ?? undefined;
}

/**
 * Classify only enum members that the host's TypeScript transform inlines.
 * Preserve every executable TypeScript node: callers use this view to choose
 * insertion boundaries and build the separate extraction view.
 */
export function createEnumConstants(
  ast: t.File
): (path: ValuePath) => Literal | undefined {
  const frames = new WeakMap<t.Node, Map<string, EnumInfo>>();
  const declarations: EnumDeclaration[] = [];
  traverse(ast, {
    TSEnumDeclaration(path) {
      if (path.node.declare) return;
      const frame = owner(path).node;
      let enums = frames.get(frame);
      if (!enums) frames.set(frame, (enums = new Map()));
      let info = enums.get(path.node.id.name);
      if (!info) {
        info = { members: new Map() };
        enums.set(path.node.id.name, info);
      }
      declarations.push({ path, info });
    },
  });

  function resolveEnum(path: NodePath, name: string): EnumInfo | undefined {
    let current: NodePath | null = path;
    let child: NodePath | null = null;
    while (current) {
      if (isFrame(current)) {
        // Parameter defaults run outside the function body's lexical scope.
        // Babel exposes its body bindings on the function scope as well.
        const parameter = current.isFunction() && child?.listKey === 'params';
        const binding =
          current.scope.path.node === current.node
            ? current.scope.getOwnBinding(name)
            : undefined;
        // A parameter/local value with the same spelling shadows the TS enum.
        if (
          binding &&
          (!parameter || binding.kind === 'param' || binding.kind === 'local')
        )
          return;
        const info = parameter
          ? undefined
          : frames.get(current.node)?.get(name);
        if (info) return info;
      }
      child = current;
      current = current.parentPath;
    }
  }

  function readMember(path: NodePath<t.MemberExpression>): Literal | undefined {
    // Next does not fold through typed objects/properties here, although newer
    // standalone SWC frontends may. Follow the actual Next insertion stage.
    const object = path.node.object;
    if (!t.isIdentifier(object) || object.extra?.parenthesized) return;
    const name = propertyName(path.node);
    if (name === undefined) return;
    return resolveEnum(path, object.name)?.members.get(name);
  }

  function evaluate(path: ValuePath, info: EnumInfo): Literal | undefined {
    if (path.isStringLiteral() || path.isNumericLiteral())
      return path.node.value;
    if (
      path.isParenthesizedExpression() ||
      path.isTSAsExpression() ||
      path.isTSSatisfiesExpression() ||
      path.isTSNonNullExpression() ||
      path.isTSTypeAssertion() ||
      path.isTSInstantiationExpression()
    )
      return evaluate(path.get('expression') as ValuePath, info);
    if (path.isIdentifier()) {
      if (info.members.has(path.node.name))
        return info.members.get(path.node.name);
      if (!path.scope.getBinding(path.node.name)) {
        if (path.node.name === 'NaN') return NaN;
        if (path.node.name === 'Infinity') return Infinity;
      }
      return;
    }
    if (path.isMemberExpression()) return readMember(path);
    if (path.isTemplateLiteral()) {
      let value = path.node.quasis[0]?.value.cooked;
      if (value === null || value === undefined) return;
      for (const [index, expression] of path.get('expressions').entries()) {
        const item = evaluate(expression, info);
        const suffix = path.node.quasis[index + 1]?.value.cooked;
        if (item === undefined || suffix === null || suffix === undefined)
          return;
        value += String(item) + suffix;
      }
      return value;
    }
    if (path.isUnaryExpression()) {
      const value = evaluate(path.get('argument'), info);
      if (typeof value !== 'number') return;
      switch (path.node.operator) {
        case '+':
          return value;
        case '-':
          return -value;
        case '~':
          return ~value;
      }
      return;
    }
    if (path.isBinaryExpression()) {
      const left = evaluate(path.get('left'), info);
      const right = evaluate(path.get('right'), info);
      if (left === undefined || right === undefined) return;
      if (path.node.operator === '+')
        return typeof left === 'string' || typeof right === 'string'
          ? String(left) + String(right)
          : left + right;
      if (typeof left !== 'number' || typeof right !== 'number') return;
      switch (path.node.operator) {
        case '-':
          return left - right;
        case '*':
          return left * right;
        case '/':
          return left / right;
        case '%':
          return left % right;
        case '**':
          return left ** right;
        case '<<':
          return left << right;
        case '>>':
          return left >> right;
        case '>>>':
          return left >>> right;
        case '|':
          return left | right;
        case '&':
          return left & right;
        case '^':
          return left ^ right;
      }
    }
  }

  // Initializers are evaluated in declaration order. Forward enum references
  // remain dynamic; merged declarations share named members but restart their
  // implicit numeric sequence. References in executable code see the final map.
  for (const { path, info } of declarations) {
    let previous: Literal | undefined = -1;
    for (const member of path.get('members')) {
      const initializer = member.get('initializer');
      const value: Literal | undefined = initializer.node
        ? evaluate(initializer, info)
        : typeof previous === 'number'
          ? previous + 1
          : undefined;
      info.members.set(memberName(member.node), value);
      previous = value;
    }
  }

  return (path) => (path.isMemberExpression() ? readMember(path) : undefined);
}
