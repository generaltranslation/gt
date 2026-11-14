import { visitorKeys } from 'oxc-parser';
import { parsedRange, type ESTree, type Node } from './ast.js';

/**
 * Which declaration each identifier of a module refers to, as
 * `@typescript-eslint/scope-manager` resolves it for a module, with no
 * library globals and no JSX pragma: the same scopes, definitions and
 * references, visited in the same order, so that what the analysis reads is
 * the same. It builds only that: the scope manager's scopes, variables and
 * references are several times as large, and took most of the time of
 * reading a module.
 *
 * Each rule below is the scope manager's (version 8): `Referencer`,
 * `ClassVisitor`, `TypeVisitor`, `PatternVisitor`, `ImportVisitor` and
 * `ExportVisitor`, and the scopes' resolution. A module is strict code, so
 * every scope resolves statically; `with` is a syntax error there.
 */

export type DefinitionType =
  | 'CatchClause'
  | 'ClassName'
  | 'FunctionName'
  | 'ImplicitGlobalVariable'
  | 'ImportBinding'
  | 'Parameter'
  | 'TSEnumMemberName'
  | 'TSEnumName'
  | 'TSModuleName'
  | 'Type'
  | 'Variable';

export type ResolvedDefinition = {
  type: DefinitionType;
  /** The declared identifier, or a string enum member's literal. */
  name: Node;
  node: Node;
  parent: Node | undefined;
};

/**
 * A variable, and what the analysis reads of it once every name is
 * resolved: `definitions`, `assignments` and `isModuleLevel`.
 */
export class ResolvedVariable {
  /** Every definition, types included. */
  readonly defs: ResolvedDefinition[] = [];
  /** In the order they were resolved to it. */
  readonly resolvedReferences: ResolvedReference[] = [];
  private valueDefinitions: ResolvedDefinition[] | undefined;
  private writes: Node[] | undefined;

  constructor(
    readonly name: string,
    readonly scope: NameScope,
    /** For a library global, which has no definition. */
    private readonly kinds?: { type: boolean; value: boolean }
  ) {}

  get isTypeVariable(): boolean {
    if (this.kinds) return this.kinds.type;
    if (this.defs.length === 0) return true;

    return this.defs.some(({ type }) => TYPE_DEFINITIONS.has(type));
  }

  get isValueVariable(): boolean {
    if (this.kinds) return this.kinds.value;
    if (this.defs.length === 0) return true;

    return this.defs.some(({ type }) => type !== 'Type');
  }

  get isModuleLevel(): boolean {
    return this.scope.type === 'module';
  }

  /** None for a type: `type Message = …` and `function Message()` are one variable, and the value counts. */
  get definitions(): readonly ResolvedDefinition[] {
    this.valueDefinitions ??= this.isValueVariable
      ? this.defs.filter(({ type }) => type !== 'Type')
      : [];

    return this.valueDefinitions;
  }

  /** Assigned identifiers, without initializations. */
  get assignments(): readonly Node[] {
    this.writes ??= this.resolvedReferences
      .filter(({ flags, init }) => (flags & WRITE) !== 0 && !init)
      .map(({ identifier }) => identifier);

    return this.writes;
  }
}

export class ResolvedReference {
  resolved: ResolvedVariable | undefined = undefined;

  constructor(
    readonly identifier: Node,
    /** `READ`, `WRITE` or both. */
    readonly flags: number,
    /** `VALUE`, `TYPE` or both. */
    readonly kinds: number,
    /** A declaration's own initialization. */
    readonly init: boolean
  ) {}

  /** Undefined for a global. */
  get variable(): ResolvedVariable | undefined {
    return this.resolved;
  }

  get isRead(): boolean {
    return (this.flags & READ) !== 0;
  }
}

export type ScopeType =
  | 'block'
  | 'catch'
  | 'class'
  | 'classFieldInitializer'
  | 'classStaticBlock'
  | 'conditionalType'
  | 'for'
  | 'function'
  | 'functionExpressionName'
  | 'functionType'
  | 'global'
  | 'mappedType'
  | 'module'
  | 'switch'
  | 'tsEnum'
  | 'tsModule'
  | 'type';

export class NameScope {
  readonly set = new Map<string, ResolvedVariable>();
  /** Created in this scope or passed up by its children, until it closes. */
  leftToResolve: ResolvedReference[] | undefined = [];
  readonly variableScope: NameScope;

  constructor(
    readonly type: ScopeType,
    readonly upper: NameScope | undefined,
    readonly block: Node
  ) {
    this.variableScope = VARIABLE_SCOPES.has(type)
      ? this
      : upper!.variableScope;
  }
}

export type ResolvedNames = {
  /** By identifier: the last reference made of it. */
  references: ReadonlyMap<Node, ResolvedReference>;
  module: NameScope;
};

/** Thrown for what a module cannot hold, e.g. `with`: the caller falls back to the scope manager. */
export class UnsupportedSyntax extends Error {}

export const READ = 1;
export const WRITE = 2;
const VALUE = 1;
const TYPE = 2;

const TYPE_DEFINITIONS = new Set<DefinitionType>([
  'ClassName',
  'ImportBinding',
  'TSEnumMemberName',
  'TSEnumName',
  'TSModuleName',
  'Type',
]);

const VARIABLE_SCOPES = new Set<ScopeType>([
  'classFieldInitializer',
  'classStaticBlock',
  'function',
  'global',
  'module',
  'tsModule',
]);

const PATTERN_TYPES = new Set([
  'Identifier',
  'ObjectPattern',
  'ArrayPattern',
  'SpreadElement',
  'RestElement',
  'AssignmentPattern',
]);

type AnyNode = Node & Record<string, any>;
type Visit = (node: AnyNode | null | undefined) => void;
type PatternCallback = (
  pattern: AnyNode,
  assignments: readonly AnyNode[]
) => void;

export function resolveNames(program: ESTree.Program): ResolvedNames {
  return new Resolver().resolve(program as AnyNode);
}

class Resolver {
  private readonly references = new Map<Node, ResolvedReference>();
  private current: NameScope | undefined;

  resolve(program: AnyNode): ResolvedNames {
    const global = this.nest('global', program);
    // The scope manager's one global without a library: `as const`.
    global.set.set(
      'const',
      new ResolvedVariable('const', global, { type: true, value: false })
    );
    const module = this.nest('module', program);

    this.visitChildren(program);
    this.close(program);

    return { references: this.references, module };
  }

  // ---------------------------------------------------------------- scopes

  private scope(): NameScope {
    return this.current!;
  }

  private nest(type: ScopeType, block: Node): NameScope {
    const scope = new NameScope(type, this.current, block);
    this.current = scope;

    // A function's own `arguments`, which has no definition.
    if (type === 'function' && block.type !== 'ArrowFunctionExpression') {
      this.defineName(scope, 'arguments', undefined);
    }

    return scope;
  }

  private close(node: Node): void {
    while (this.current && this.current.block === node) {
      this.current = this.closeScope(this.current);
    }
  }

  private closeScope(scope: NameScope): NameScope | undefined {
    for (const reference of scope.leftToResolve!) {
      if (!this.resolveIn(scope, reference)) {
        scope.upper?.leftToResolve?.push(reference);
      }
    }
    scope.leftToResolve = undefined;

    return scope.upper;
  }

  private resolveIn(scope: NameScope, reference: ResolvedReference): boolean {
    const name = (reference.identifier as AnyNode).name as string;
    const variable = scope.set.get(name);
    if (!variable) return false;
    if (!isValidResolution(scope, reference, variable)) return false;

    const isValidType =
      (reference.kinds & TYPE) !== 0 && variable.isTypeVariable;
    const isValidValue =
      (reference.kinds & VALUE) !== 0 && variable.isValueVariable;
    if (!isValidType && !isValidValue) return false;

    variable.resolvedReferences.push(reference);
    reference.resolved = variable;

    return true;
  }

  private define(
    scope: NameScope,
    identifier: AnyNode,
    type: DefinitionType,
    node: Node,
    parent?: Node
  ): void {
    this.defineName(scope, identifier.name as string, {
      type,
      name: identifier,
      node,
      parent,
    });
  }

  private defineName(
    scope: NameScope,
    name: string,
    definition: ResolvedDefinition | undefined
  ): void {
    let variable = scope.set.get(name);

    if (!variable) {
      variable = new ResolvedVariable(name, scope);
      scope.set.set(name, variable);
    }

    if (definition) variable.defs.push(definition);
  }

  private reference(
    identifier: Node,
    flags: number,
    kinds: number,
    init = false
  ): void {
    const reference = new ResolvedReference(identifier, flags, kinds, init);

    // A pattern with defaults is referenced several times: the scope manager's index keeps the last.
    this.references.set(identifier, reference);
    this.scope().leftToResolve?.push(reference);
  }

  private referenceValue(identifier: Node, flags = READ, init = false): void {
    this.reference(identifier, flags, VALUE, init);
  }

  private referencingDefaultValue(
    pattern: AnyNode,
    assignments: readonly AnyNode[],
    init: boolean
  ): void {
    for (let index = 0; index < assignments.length; index++) {
      this.referenceValue(pattern, WRITE, init);
    }
  }

  // -------------------------------------------------------------- visiting

  private readonly visit: Visit = (node) => {
    if (node?.type == null) return;

    const handler = this.handlers[node.type];
    if (handler) handler(node);
    else this.visitChildren(node);
  };

  private visitChildren(
    node: AnyNode | null | undefined,
    exclude?: string
  ): void {
    visitChildren(node, this.visit, exclude);
  }

  private visitPattern(
    root: AnyNode,
    callback: PatternCallback,
    processRightHandNodes: boolean,
    visit: Visit = this.visit
  ): void {
    const rightHandNodes = visitPattern(root, callback);
    if (processRightHandNodes) rightHandNodes.forEach((node) => visit(node));
  }

  private visitType(node: AnyNode | null | undefined): void {
    if (node) this.typeVisit(node);
  }

  private readonly handlers: Record<string, (node: AnyNode) => void> = {
    ArrowFunctionExpression: (node) => this.visitFunction(node),
    FunctionDeclaration: (node) => this.visitFunction(node),
    FunctionExpression: (node) => this.visitFunction(node),
    TSDeclareFunction: (node) => this.visitFunction(node),
    TSEmptyBodyFunctionExpression: (node) => this.visitFunction(node),

    AssignmentExpression: (node) => {
      const left = this.visitExpressionTarget(node.left);

      if (PATTERN_TYPES.has(left.type)) {
        if (node.operator === '=') {
          this.visitPattern(
            left,
            (pattern, assignments) => {
              this.referencingDefaultValue(pattern, assignments, false);
              this.referenceValue(pattern, WRITE, false);
            },
            true
          );
        } else if (left.type === 'Identifier') {
          this.referenceValue(left, READ | WRITE);
        }
      } else {
        this.visit(left);
      }

      this.visit(node.right);
    },

    BlockStatement: (node) => {
      this.nest('block', node);
      this.visitChildren(node);
      this.close(node);
    },

    BreakStatement: () => {},
    ContinueStatement: () => {},

    CallExpression: (node) => this.visitWithTypeArguments(node),
    NewExpression: (node) => this.visitWithTypeArguments(node),
    TSInstantiationExpression: (node) => this.visitWithTypeArguments(node),

    CatchClause: (node) => {
      this.nest('catch', node);

      if (node.param) {
        this.visitPattern(
          node.param,
          (pattern, assignments) => {
            this.define(this.scope(), pattern, 'CatchClause', node);
            this.referencingDefaultValue(pattern, assignments, true);
          },
          true
        );
      }

      this.visit(node.body);
      this.close(node);
    },

    ClassDeclaration: (node) => this.visitClass(node),
    ClassExpression: (node) => this.visitClass(node),

    ExportAllDeclaration: () => {},

    ExportDefaultDeclaration: (node) => {
      if (node.declaration.type === 'Identifier') this.visitExport(node);
      else this.visit(node.declaration);
    },

    ExportNamedDeclaration: (node) => {
      if (node.declaration) this.visit(node.declaration);
      else this.visitExport(node);
    },

    ForInStatement: (node) => this.visitForIn(node),
    ForOfStatement: (node) => this.visitForIn(node),

    ForStatement: (node) => {
      if (
        node.init?.type === 'VariableDeclaration' &&
        node.init.kind !== 'var'
      ) {
        this.nest('for', node);
      }

      this.visitChildren(node);
      this.close(node);
    },

    Identifier: (node) => {
      this.referenceValue(node);
      this.visitType(node.typeAnnotation);
    },

    ImportAttribute: () => {},

    ImportDeclaration: (node) => {
      for (const specifier of node.specifiers as AnyNode[]) {
        this.define(
          this.scope(),
          specifier.local,
          'ImportBinding',
          specifier,
          node
        );
      }
    },

    JSXAttribute: (node) => this.visit(node.value),
    JSXClosingElement: (node) => this.visitJsxElement(node),
    JSXFragment: (node) => this.visitChildren(node),
    JSXIdentifier: (node) => this.referenceValue(node),

    JSXMemberExpression: (node) => {
      const isThis =
        node.object.type === 'JSXIdentifier' && node.object.name === 'this';
      if (!isThis) this.visit(node.object);
    },

    JSXOpeningElement: (node) => {
      this.visitJsxElement(node);
      this.visitType(node.typeArguments);
      for (const attribute of node.attributes as AnyNode[]) {
        this.visit(attribute);
      }
    },

    LabeledStatement: (node) => this.visit(node.body),

    MemberExpression: (node) => {
      this.visit(node.object);
      if (node.computed) this.visit(node.property);
    },

    MetaProperty: () => {},
    PrivateIdentifier: () => {},

    Property: (node) => {
      if (node.computed) this.visit(node.key);
      this.visit(node.value);
    },

    SwitchStatement: (node) => {
      this.visit(node.discriminant);
      this.nest('switch', node);
      for (const switchCase of node.cases as AnyNode[]) this.visit(switchCase);
      this.close(node);
    },

    TaggedTemplateExpression: (node) => {
      this.visit(node.tag);
      this.visit(node.quasi);
      this.visitType(node.typeArguments);
    },

    TSAsExpression: (node) => this.visitTypeAssertion(node),
    TSSatisfiesExpression: (node) => this.visitTypeAssertion(node),
    TSTypeAssertion: (node) => this.visitTypeAssertion(node),

    TSEnumDeclaration: (node) => {
      this.define(this.scope(), node.id, 'TSEnumName', node);
      this.nest('tsEnum', node);

      for (const member of node.body.members as AnyNode[]) {
        const id = member.id as AnyNode;

        if (id.type === 'Literal' && typeof id.value === 'string') {
          this.defineName(this.scope(), id.value, {
            type: 'TSEnumMemberName',
            name: id,
            node: member,
            parent: undefined,
          });
        } else if (id.type === 'Identifier') {
          this.define(this.scope(), id, 'TSEnumMemberName', member);
        }

        this.visit(member.initializer);
      }

      this.close(node);
    },

    TSExportAssignment: (node) => {
      if (node.expression.type === 'Identifier') {
        this.reference(node.expression, READ, TYPE | VALUE);
      } else {
        this.visit(node.expression);
      }
    },

    TSImportEqualsDeclaration: (node) => {
      this.define(this.scope(), node.id, 'ImportBinding', node, node);

      if (node.moduleReference.type === 'TSQualifiedName') {
        let identifier = node.moduleReference.left as AnyNode;
        while (identifier.type === 'TSQualifiedName')
          identifier = identifier.left;
        this.visit(identifier);
      } else {
        this.visit(node.moduleReference);
      }
    },

    TSInterfaceDeclaration: (node) => this.visitType(node),
    TSTypeAliasDeclaration: (node) => this.visitType(node),

    TSModuleDeclaration: (node) => {
      if (node.id.type === 'Identifier' && node.kind !== 'global') {
        this.define(this.scope(), node.id, 'TSModuleName', node);
      }

      this.nest('tsModule', node);
      this.visit(node.body);
      this.close(node);
    },

    UpdateExpression: (node) => {
      const argument = this.visitExpressionTarget(node.argument);

      if (PATTERN_TYPES.has(argument.type)) {
        this.visitPattern(
          argument,
          (pattern) => this.referenceValue(pattern, READ | WRITE),
          false
        );
      } else {
        this.visitChildren(node);
      }
    },

    VariableDeclaration: (node) => {
      const target =
        node.kind === 'var' ? this.scope().variableScope : this.scope();

      for (const declarator of node.declarations as AnyNode[]) {
        const { init } = declarator;

        this.visitPattern(
          declarator.id,
          (pattern, assignments) => {
            this.define(target, pattern, 'Variable', declarator, node);
            this.referencingDefaultValue(pattern, assignments, true);
            if (init) this.referenceValue(pattern, WRITE, true);
          },
          true
        );
        this.visit(init);
        this.visitType(declarator.id.typeAnnotation);
      }
    },

    WithStatement: () => {
      throw new UnsupportedSyntax('with');
    },
  };

  private visitWithTypeArguments(node: AnyNode): void {
    this.visitChildren(node, 'typeArguments');
    this.visitType(node.typeArguments);
  }

  private visitTypeAssertion(node: AnyNode): void {
    this.visit(node.expression);
    this.visitType(node.typeAnnotation);
  }

  private visitExpressionTarget(left: AnyNode): AnyNode {
    switch (left.type) {
      case 'TSAsExpression':
      case 'TSTypeAssertion':
        this.visitType(left.typeAnnotation);
        return left.expression;
      case 'TSNonNullExpression':
        return left.expression;
      default:
        return left;
    }
  }

  private visitJsxElement(node: AnyNode): void {
    const name = node.name as AnyNode;

    if (name.type !== 'JSXIdentifier') {
      this.visit(name);
      return;
    }

    // A lower-case name is an intrinsic element, a string: `<div />`.
    const first = (name.name as string)[0]!;
    if (first.toUpperCase() === first || name.name === 'this') this.visit(name);
  }

  private visitForIn(node: AnyNode): void {
    const left = node.left as AnyNode;

    if (left.type === 'VariableDeclaration' && left.kind !== 'var') {
      this.nest('for', node);
    }

    if (left.type === 'VariableDeclaration') {
      this.visit(left);
      this.visitPattern(
        (left.declarations as AnyNode[])[0]!.id,
        (pattern) => this.referenceValue(pattern, WRITE, true),
        false
      );
    } else {
      this.visitPattern(
        left,
        (pattern, assignments) => {
          this.referencingDefaultValue(pattern, assignments, false);
          this.referenceValue(pattern, WRITE, false);
        },
        true
      );
    }

    this.visit(node.right);
    this.visit(node.body);
    this.close(node);
  }

  private visitFunction(node: AnyNode): void {
    if (node.type === 'FunctionExpression') {
      if (node.id) this.nestFunctionExpressionName(node);
    } else if (node.id) {
      this.define(this.scope(), node.id, 'FunctionName', node);
    }

    this.nest('function', node);

    for (const param of node.params as AnyNode[]) {
      this.visitPattern(
        param,
        (pattern, assignments) => {
          this.define(this.scope(), pattern, 'Parameter', node);
          this.referencingDefaultValue(pattern, assignments, true);
        },
        true
      );
      this.visitParameterType(param, (type) => this.visitType(type));
      for (const decorator of param.decorators ?? []) this.visit(decorator);
    }

    this.visitType(node.returnType);
    this.visitType(node.typeParameters);

    if (node.body) {
      // A function's body is not a block scope of its own.
      if (node.body.type === 'BlockStatement') this.visitChildren(node.body);
      else this.visit(node.body);
    }

    this.close(node);
  }

  private nestFunctionExpressionName(node: AnyNode): void {
    const scope = this.nest('functionExpressionName', node);
    this.define(scope, node.id, 'FunctionName', node);
  }

  private visitParameterType(
    param: AnyNode,
    visitType: (type: AnyNode | null | undefined) => void
  ): void {
    switch (param.type) {
      case 'AssignmentPattern':
        visitType((param.left as AnyNode).typeAnnotation);
        break;
      case 'TSParameterProperty':
        this.visitParameterType(param.parameter, visitType);
        break;
      default:
        visitType(param.typeAnnotation);
    }
  }

  // ---------------------------------------------------- exports (ExportVisitor)

  private visitExport(exportNode: AnyNode): void {
    const visitIdentifier = (identifier: AnyNode) => {
      if (exportNode.exportKind === 'type')
        this.reference(identifier, READ, TYPE);
      else this.reference(identifier, READ, TYPE | VALUE);
    };

    const exportVisit: Visit = (node) => {
      if (node?.type == null) return;

      switch (node.type) {
        case 'ExportDefaultDeclaration':
          if (node.declaration.type === 'Identifier')
            exportVisit(node.declaration);
          return;
        case 'ExportNamedDeclaration':
          if (node.source) return;
          if (!node.declaration) visitChildren(node, exportVisit);
          return;
        case 'ExportSpecifier':
          if (node.exportKind === 'type' && node.local.type === 'Identifier') {
            this.reference(node.local, READ, TYPE);
          } else {
            exportVisit(node.local);
          }
          return;
        case 'Identifier':
          visitIdentifier(node);
          return;
        default:
          visitChildren(node, exportVisit);
      }
    };

    exportVisit(exportNode);
  }

  // ------------------------------------------------------ classes (ClassVisitor)

  private visitClass(node: AnyNode): void {
    if (node.type === 'ClassDeclaration' && node.id) {
      this.define(this.scope(), node.id, 'ClassName', node);
    }

    for (const decorator of node.decorators ?? []) this.visit(decorator);
    this.nest('class', node);
    if (node.id) this.define(this.scope(), node.id, 'ClassName', node);

    this.visit(node.superClass);
    this.visitType(node.typeParameters);
    this.visitType(node.superTypeArguments);
    for (const implemented of node.implements ?? [])
      this.visitType(implemented);
    this.classVisit(node.body);
    this.close(node);
  }

  private readonly classHandlers: Record<string, (node: AnyNode) => void> = {
    AccessorProperty: (node) => this.visitPropertyDefinition(node),
    ClassBody: (node) => visitChildren(node, this.classVisit),
    Identifier: (node) => this.visit(node),
    MethodDefinition: (node) => this.visitMethod(node),
    PrivateIdentifier: () => {},
    PropertyDefinition: (node) => this.visitPropertyDefinition(node),
    StaticBlock: (node) => {
      this.nest('classStaticBlock', node);
      for (const statement of node.body as AnyNode[])
        this.classVisit(statement);
      this.close(node);
    },
    TSAbstractAccessorProperty: (node) => this.visitPropertyDefinition(node),
    TSAbstractMethodDefinition: (node) => this.visitPropertyBase(node),
    TSAbstractPropertyDefinition: (node) => this.visitPropertyDefinition(node),
    TSIndexSignature: (node) => this.visitType(node),
  };

  private readonly classVisit: Visit = (node) => {
    const handler = node && this.classHandlers[node.type];
    if (handler) handler(node!);
    else this.visit(node);
  };

  private visitMethod(node: AnyNode): void {
    if (node.computed) this.visit(node.key);

    if (node.value.type === 'FunctionExpression') {
      this.visitMethodFunction(node.value);
    } else {
      this.visit(node.value);
    }

    for (const decorator of node.decorators ?? []) this.visit(decorator);
  }

  private visitMethodFunction(node: AnyNode): void {
    if (node.id) this.nestFunctionExpressionName(node);

    for (const param of node.params as AnyNode[]) {
      for (const decorator of param.decorators ?? [])
        this.classVisit(decorator);
    }

    this.nest('function', node);

    for (const param of node.params as AnyNode[]) {
      this.visitPattern(
        param,
        (pattern, assignments) => {
          this.define(this.scope(), pattern, 'Parameter', node);
          this.referencingDefaultValue(pattern, assignments, true);
        },
        true,
        this.classVisit
      );
      this.visitParameterType(param, (type) => this.visitType(type));
    }

    this.visitType(node.returnType);
    this.visitType(node.typeParameters);
    this.visitChildren(node.body);
    this.close(node);
  }

  private visitPropertyBase(node: AnyNode): void {
    if (node.computed) this.visit(node.key);

    if (node.value) {
      const isField =
        node.type === 'PropertyDefinition' || node.type === 'AccessorProperty';

      if (isField) this.nest('classFieldInitializer', node.value);
      this.visit(node.value);
      if (isField) this.close(node.value);
    }

    for (const decorator of node.decorators ?? []) this.visit(decorator);
  }

  private visitPropertyDefinition(node: AnyNode): void {
    this.visitPropertyBase(node);
    this.visitType(node.typeAnnotation);
  }

  // ---------------------------------------------------------- types (TypeVisitor)

  private readonly typeHandlers: Record<string, (node: AnyNode) => void> = {
    Identifier: (node) => this.reference(node, READ, TYPE),
    MemberExpression: (node) => this.typeVisit(node.object),
    TSCallSignatureDeclaration: (node) => this.visitFunctionType(node),
    TSConditionalType: (node) => {
      this.nest('conditionalType', node);
      visitChildren(node, this.typeVisit, 'falseType');
      this.close(node);
      this.typeVisit(node.falseType);
    },
    TSConstructorType: (node) => this.visitFunctionType(node),
    TSConstructSignatureDeclaration: (node) => this.visitFunctionType(node),
    TSFunctionType: (node) => this.visitFunctionType(node),
    TSImportType: (node) => this.typeVisit(node.typeArguments),
    TSIndexSignature: (node) => {
      for (const param of node.parameters as AnyNode[]) {
        if (param.type === 'Identifier') this.typeVisit(param.typeAnnotation);
      }
      this.typeVisit(node.typeAnnotation);
    },
    TSInferType: (node) => {
      const typeParameter = node.typeParameter as AnyNode;
      let scope = this.scope();

      // In a type inside a conditional type, it is the conditional type's.
      if (scope.type === 'functionType' || scope.type === 'mappedType') {
        let upper = scope.upper;

        while (upper) {
          if (upper.type === 'functionType' || upper.type === 'mappedType') {
            upper = upper.upper;
            continue;
          }
          if (upper.type === 'conditionalType') scope = upper;
          break;
        }
      }

      this.define(scope, typeParameter.name, 'Type', typeParameter);
      this.typeVisit(typeParameter.constraint);
    },
    TSInterfaceDeclaration: (node) => {
      this.define(this.scope(), node.id, 'Type', node);

      if (node.typeParameters) {
        this.nest('type', node);
        this.typeVisit(node.typeParameters);
      }

      for (const heritage of node.extends ?? []) this.typeVisit(heritage);
      this.typeVisit(node.body);

      if (node.typeParameters) this.close(node);
    },
    TSMappedType: (node) => {
      this.nest('mappedType', node);
      this.define(this.scope(), node.key, 'Type', node);
      this.typeVisit(node.constraint);
      this.typeVisit(node.nameType);
      this.typeVisit(node.typeAnnotation);
      this.close(node);
    },
    TSMethodSignature: (node) => {
      this.visitPropertyKey(node);
      this.visitFunctionType(node);
    },
    TSNamedTupleMember: (node) => this.typeVisit(node.elementType),
    TSPropertySignature: (node) => {
      this.visitPropertyKey(node);
      this.typeVisit(node.typeAnnotation);
    },
    TSQualifiedName: (node) => this.typeVisit(node.left),
    TSTypeAliasDeclaration: (node) => {
      this.define(this.scope(), node.id, 'Type', node);

      if (node.typeParameters) {
        this.nest('type', node);
        this.typeVisit(node.typeParameters);
      }

      this.typeVisit(node.typeAnnotation);

      if (node.typeParameters) this.close(node);
    },
    TSTypeParameter: (node) => {
      this.define(this.scope(), node.name, 'Type', node);
      this.typeVisit(node.constraint);
      this.typeVisit(node.default);
    },
    TSTypePredicate: (node) => {
      if (node.parameterName.type !== 'TSThisType') {
        this.referenceValue(node.parameterName);
      }
      this.typeVisit(node.typeAnnotation);
    },
    TSTypeAnnotation: (node) => visitChildren(node, this.typeVisit),
    TSTypeQuery: (node) => {
      let entity = node.exprName as AnyNode;

      if (entity.type === 'TSQualifiedName') {
        while (entity.left.type === 'TSQualifiedName') entity = entity.left;
        entity = entity.left;
      } else if (entity.type === 'TSImportType') {
        this.typeVisit(entity);
      }

      if (entity.type === 'Identifier') this.referenceValue(entity);
      this.typeVisit(node.typeArguments);
    },
  };

  private readonly typeVisit: Visit = (node) => {
    if (node?.type == null) return;

    const handler = this.typeHandlers[node.type];
    if (handler) handler(node);
    else visitChildren(node, this.typeVisit);
  };

  private visitPropertyKey(node: AnyNode): void {
    if (node.computed) this.visit(node.key);
  }

  private visitFunctionType(node: AnyNode): void {
    this.nest('functionType', node);
    this.typeVisit(node.typeParameters);

    for (const param of node.params as AnyNode[]) {
      let didVisitAnnotation = false;

      this.visitPattern(
        param,
        (pattern) => {
          this.define(this.scope(), pattern, 'Parameter', node);

          if (pattern.typeAnnotation) {
            this.typeVisit(pattern.typeAnnotation);
            didVisitAnnotation = true;
          }
        },
        false
      );

      if (!didVisitAnnotation && 'typeAnnotation' in param) {
        this.typeVisit(param.typeAnnotation);
      }
    }

    this.typeVisit(node.returnType);
    this.close(node);
  }
}

/** The scope manager's `isValidResolution`, with positions where nodes were parsed: see `indexProgram`. */
function isValidResolution(
  scope: NameScope,
  reference: ResolvedReference,
  variable: ResolvedVariable
): boolean {
  if (scope.type !== 'function' || scope.block.type === 'Program') return true;

  // A parameter's default cannot read a variable declared only in the body.
  const body = (scope.block as AnyNode).body as Node | null | undefined;
  const bodyStart = body ? parsedRange(body)[0] : -1;

  return !(
    variable.scope === scope &&
    parsedRange(reference.identifier)[0] < bodyStart &&
    variable.defs.every(({ name }) => parsedRange(name)[0] >= bodyStart)
  );
}

/** The scope manager's `VisitorBase.visitChildren`, by the parser's visitor keys: they are in the same order. */
function visitChildren(
  node: AnyNode | null | undefined,
  visit: Visit,
  exclude?: string
): void {
  if (node?.type == null) return;

  const keys =
    (visitorKeys as Record<string, readonly string[] | undefined>)[node.type] ??
    Object.keys(node);

  for (const key of keys) {
    if (key === exclude || key === 'parent') continue;

    const child = node[key];
    if (!child) continue;

    if (Array.isArray(child)) {
      for (const item of child) if (isNode(item)) visit(item);
    } else if (isNode(child)) {
      visit(child);
    }
  }
}

function isNode(value: unknown): value is AnyNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

/**
 * The scope manager's `PatternVisitor`: calls `callback` with each identifier
 * a pattern binds or assigns, and the defaults around it. Returns what the
 * pattern reads: defaults, computed keys and member objects.
 */
function visitPattern(root: AnyNode, callback: PatternCallback): AnyNode[] {
  const assignments: AnyNode[] = [];
  const rightHandNodes: AnyNode[] = [];

  const visit: Visit = (node) => {
    if (node?.type == null) return;

    switch (node.type) {
      case 'ArrayExpression':
      case 'ArrayPattern':
        for (const element of node.elements as AnyNode[]) visit(element);
        return;
      case 'AssignmentExpression':
      case 'AssignmentPattern':
        assignments.push(node);
        visit(node.left);
        rightHandNodes.push(node.right);
        assignments.pop();
        return;
      case 'CallExpression':
        for (const argument of node.arguments as AnyNode[]) {
          rightHandNodes.push(argument);
        }
        visit(node.callee);
        return;
      case 'Decorator':
      case 'TSTypeAnnotation':
        return;
      case 'Identifier':
        callback(node, assignments);
        return;
      case 'MemberExpression':
        if (node.computed) rightHandNodes.push(node.property);
        rightHandNodes.push(node.object);
        return;
      case 'Property':
        if (node.computed) rightHandNodes.push(node.key);
        visit(node.value);
        return;
      case 'RestElement':
      case 'SpreadElement':
        visit(node.argument);
        return;
      default:
        visitChildren(node, visit);
    }
  };

  visit(root);

  return rightHandNodes;
}
