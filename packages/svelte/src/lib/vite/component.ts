import { hashSource } from 'generaltranslation/id';
import type {
  JsxChild,
  JsxChildren,
  JsxElement,
  Variable,
} from 'generaltranslation/types';
import { parse } from 'svelte/compiler';
import {
  childrenParam,
  componentHandle,
  getGTAlias,
  hashProp,
  isVariableExport,
  lookupAlias,
  renderParam,
  snippetName,
  sourceProp,
  variableExports,
  type VariableExport,
} from '../shared/protocol.js';
import {
  forEachChild,
  freeReferences,
  parentMap,
  patternNames,
  prepareForScopeAnalysis,
  type AnyNode,
} from './ast.js';
import {
  SourceCompiler,
  type Binding,
  type CompileResult,
} from './compiler.js';
import {
  directCallOnly,
  dynamicTContent,
  emptyT,
  nestedT,
  tagOnly,
  unsupportedTProp,
  varProps,
} from './diagnostics.js';
import { evaluateConstant } from './evaluate.js';

class TemplateScope {
  constructor(
    readonly names: ReadonlySet<string>,
    readonly parent?: TemplateScope
  ) {}

  has(name: string): boolean {
    return this.names.has(name) || !!this.parent?.has(name);
  }

  extend(names: ReadonlySet<string>): TemplateScope {
    return names.size ? new TemplateScope(names, this) : this;
  }
}

const elementTypes = new Set([
  'RegularElement',
  'Component',
  'SvelteElement',
  'SvelteComponent',
  'SvelteSelf',
  'SvelteFragment',
  'SvelteHead',
  'SvelteBody',
  'SvelteWindow',
  'SvelteDocument',
  'SvelteBoundary',
  'SlotElement',
  'TitleElement',
]);

const templateTypes = new Set([
  ...elementTypes,
  'Fragment',
  'Text',
  'Comment',
  'ExpressionTag',
  'HtmlTag',
  'ConstTag',
  'DebugTag',
  'RenderTag',
  'AttachTag',
  'IfBlock',
  'EachBlock',
  'AwaitBlock',
  'KeyBlock',
  'SnippetBlock',
  'Attribute',
  'SpreadAttribute',
  'AnimateDirective',
  'BindDirective',
  'ClassDirective',
  'LetDirective',
  'OnDirective',
  'StyleDirective',
  'TransitionDirective',
  'UseDirective',
]);

const tMetadataProps = {
  context: 'string',
  maxChars: 'number',
  requiresReview: 'boolean',
} as const;

type TMetadata = {
  context?: string;
  maxChars?: number;
  requiresReview?: boolean;
};

type Shell =
  | { id: number; kind: 'element'; node: AnyNode }
  | { id: number; kind: 'variable'; node: AnyNode; variable: VariableExport };

type RichContentState = { nextId: number; shells: Shell[] };

const whitespace = /[\t\n\f\r ]+/g;

export type PreparedComponent = {
  /** Import sources in the component's scripts, to resolve before compiling. */
  importSources: string[];
  /** Returns `null` when the component uses nothing the plugin compiles. */
  compile(runtimeSources: ReadonlySet<string>): CompileResult | null;
};

/** Parses a component once with Svelte's own parser. */
export function prepareSvelteComponent(
  code: string,
  filename: string,
  filePath: string
): PreparedComponent {
  const ast = parse(code, { modern: true, filename }) as unknown as AnyNode;
  const scripts = [ast.module, ast.instance].filter(Boolean) as AnyNode[];
  return {
    importSources: scripts.flatMap((script) =>
      SourceCompiler.importSources(script.content as AnyNode)
    ),
    compile: (runtimeSources) =>
      new ComponentCompiler(code, filePath, ast).compile(
        runtimeSources,
        filename
      ),
  };
}

class ComponentCompiler extends SourceCompiler {
  readonly #module: AnyNode | undefined;
  readonly #instance: AnyNode | undefined;

  constructor(
    code: string,
    filePath: string,
    readonly ast: AnyNode
  ) {
    super(code, filePath);
    this.#module = ast.module as AnyNode | undefined;
    this.#instance = ast.instance as AnyNode | undefined;
  }

  compile(
    runtimeSources: ReadonlySet<string>,
    filename: string
  ): CompileResult | null {
    const moduleProgram = this.#module?.content as AnyNode | undefined;
    const instanceProgram = this.#instance?.content as AnyNode | undefined;
    if (moduleProgram) this.collectBindings(moduleProgram, runtimeSources);
    if (instanceProgram) this.collectBindings(instanceProgram, runtimeSources);
    if (!this.bindings.size) {
      this.diagnostics.throwIfAny();
      return null;
    }

    prepareForScopeAnalysis(this.ast);
    this.checkReservedNames(this.ast);
    if (moduleProgram) this.compileProgramReferences(moduleProgram, 'module');
    if (instanceProgram) {
      const moduleBindings = [...this.bindings.values()].filter(
        (binding) => binding.program === moduleProgram
      );
      this.compileProgramReferences(
        instanceProgram,
        'component',
        moduleBindings
      );
    }
    this.#walkFragment(
      this.ast.fragment as AnyNode,
      new TemplateScope(new Set())
    );

    const source = JSON.stringify(this.runtimeSource);
    return this.finish((output) => {
      if (this.usesCallSite('module')) {
        output.appendLeft(
          moduleProgram!.start,
          `\nimport { lookupString as ${lookupAlias} } from ${source};\n`
        );
      }
      if (this.usesCallSite('component')) {
        const declaration = `\nimport { getGT as ${getGTAlias} } from ${source};\nconst ${componentHandle} = ${getGTAlias}();\n`;
        if (instanceProgram)
          output.appendLeft(instanceProgram.start, declaration);
        else output.prepend(`<script>${declaration}</script>\n`);
      }
    }, filename);
  }

  #binding(name: string, scope: TemplateScope): Binding | undefined {
    return scope.has(name) ? undefined : this.bindings.get(name);
  }

  #expression(node: unknown, scope: TemplateScope): void {
    if (!node || (Array.isArray(node) && !node.length)) return;
    const root = node as AnyNode | AnyNode[];
    const references = freeReferences(root);
    if (!references.length) return;
    const parents = new Map<AnyNode, AnyNode>();
    for (const part of Array.isArray(root) ? root : [root]) {
      for (const [child, parent] of parentMap(part)) parents.set(child, parent);
    }
    for (const reference of references) {
      const binding = this.#binding(reference.identifier.name, scope);
      if (binding) {
        this.compileReference(binding, reference, parents, 'component');
      }
    }
  }

  #walkFragment(fragment: AnyNode | null | undefined, scope: TemplateScope) {
    if (!fragment) return;
    const nodes = fragment.nodes as AnyNode[];
    const names = new Set<string>();
    for (const node of nodes) {
      if (node.type === 'SnippetBlock') {
        names.add((node.expression as AnyNode).name as string);
      } else if (node.type === 'ConstTag') {
        const declaration = node.declaration as AnyNode;
        for (const declarator of declaration.declarations as AnyNode[]) {
          patternNames(declarator.id, names);
        }
      }
    }
    const inner = scope.extend(names);
    for (const node of nodes) this.#walkNode(node, inner);
  }

  #walkNode(node: AnyNode, scope: TemplateScope): void {
    switch (node.type) {
      case 'Text':
      case 'Comment':
        return;
      case 'ExpressionTag':
      case 'HtmlTag':
      case 'RenderTag':
      case 'AttachTag':
        this.#expression(node.expression, scope);
        return;
      case 'ConstTag':
        this.#expression(node.declaration, scope);
        return;
      case 'DebugTag':
        for (const identifier of node.identifiers as AnyNode[]) {
          this.#expression(identifier, scope);
        }
        return;
      case 'IfBlock':
        this.#expression(node.test, scope);
        this.#walkFragment(node.consequent as AnyNode, scope);
        this.#walkFragment(node.alternate as AnyNode | null, scope);
        return;
      case 'EachBlock': {
        this.#expression(node.expression, scope);
        const names = new Set<string>();
        patternNames(node.context, names);
        if (typeof node.index === 'string') names.add(node.index);
        const body = scope.extend(names);
        if (node.context) this.#expression([node.context as AnyNode], body);
        this.#expression(node.key, body);
        this.#walkFragment(node.body as AnyNode, body);
        this.#walkFragment(node.fallback as AnyNode | undefined, scope);
        return;
      }
      case 'AwaitBlock': {
        this.#expression(node.expression, scope);
        this.#walkFragment(node.pending as AnyNode | null, scope);
        for (const [pattern, fragment] of [
          [node.value, node.then],
          [node.error, node.catch],
        ] as const) {
          const names = new Set<string>();
          patternNames(pattern, names);
          const inner = scope.extend(names);
          if (pattern) this.#expression([pattern as AnyNode], inner);
          this.#walkFragment(fragment as AnyNode | null, inner);
        }
        return;
      }
      case 'KeyBlock':
        this.#expression(node.expression, scope);
        this.#walkFragment(node.fragment as AnyNode, scope);
        return;
      case 'SnippetBlock': {
        const parameters = node.parameters as AnyNode[];
        const names = new Set<string>();
        for (const parameter of parameters) patternNames(parameter, names);
        const body = scope.extend(names);
        this.#expression(parameters, body);
        this.#walkFragment(node.body as AnyNode, body);
        return;
      }
      case 'Component': {
        const binding = this.#binding(componentRoot(node), scope);
        if (binding?.imported === 'T') {
          this.#compileT(node, scope);
          return;
        }
        if (binding?.imported === 'gt') {
          this.diagnostics.report(node.start, directCallOnly);
          return;
        }
        this.#walkElement(node, scope);
        return;
      }
      default:
        if (elementTypes.has(node.type)) {
          this.#walkElement(node, scope);
          return;
        }
        forEachChild(node, (child) => {
          if (child.type === 'Fragment') this.#walkFragment(child, scope);
          else if (templateTypes.has(child.type)) this.#walkNode(child, scope);
          else this.#expression(child, scope);
        });
    }
  }

  #walkElement(node: AnyNode, scope: TemplateScope): void {
    if (node.type === 'SvelteElement') this.#expression(node.tag, scope);
    if (node.type === 'SvelteComponent')
      this.#expression(node.expression, scope);
    const letNames = this.#walkAttributes(node, scope);
    this.#walkFragment(node.fragment as AnyNode, scope.extend(letNames));
  }

  /** Compiles attribute expressions and returns the names `let:` directives declare. */
  #walkAttributes(node: AnyNode, scope: TemplateScope): Set<string> {
    const letNames = new Set<string>();
    for (const attribute of node.attributes as AnyNode[]) {
      switch (attribute.type) {
        case 'Attribute':
        case 'StyleDirective': {
          const value = attribute.value;
          if (value === true) break;
          for (const part of Array.isArray(value) ? value : [value]) {
            if (isExpressionTag(part)) this.#expression(part.expression, scope);
          }
          break;
        }
        case 'LetDirective':
          if (attribute.expression)
            patternNames(attribute.expression, letNames);
          else letNames.add(attribute.name as string);
          break;
        case 'UseDirective':
        case 'TransitionDirective':
        case 'AnimateDirective': {
          const name = (attribute.name as string).split('.')[0]!;
          const binding = this.#binding(name, scope);
          if (binding) {
            this.diagnostics.report(attribute.start, tagOnly(binding.local));
          }
          this.#expression(attribute.expression, scope);
          break;
        }
        default:
          this.#expression(attribute.expression, scope);
      }
    }
    return letNames;
  }

  #compileT(node: AnyNode, scope: TemplateScope): void {
    const metadata = this.#readTMetadata(node);
    const state: RichContentState = { nextId: 1, shells: [] };
    const children = this.#serializeChildren(
      (node.fragment as AnyNode).nodes as AnyNode[],
      scope,
      state,
      true
    );
    const source = toWireChildren(children);
    if (source === undefined) {
      this.diagnostics.report(node.start, emptyT);
      return;
    }
    const hash = hashSource({ source, dataFormat: 'JSX', ...metadata });
    this.entries.push({
      dataFormat: 'JSX',
      source,
      metadata: { hash, ...metadata, filePaths: [this.filePath] },
    });
    const name = node.name as string;
    const snippets = state.shells.map((shell) => this.#renderShell(shell));
    this.edits.replace(
      node.start,
      node.end,
      `<${name} ${hashProp}=${JSON.stringify(hash)} ${sourceProp}={${JSON.stringify(source)}}>${snippets.join('')}</${name}>`
    );
  }

  #readTMetadata(node: AnyNode): TMetadata {
    const metadata: Record<string, unknown> = {};
    for (const attribute of node.attributes as AnyNode[]) {
      const name = attribute.name as string;
      if (
        attribute.type !== 'Attribute' ||
        !Object.hasOwn(tMetadataProps, name)
      ) {
        this.diagnostics.report(attribute.start, unsupportedTProp);
        continue;
      }
      const value = attributeConstant(attribute.value);
      if (typeof value !== tMetadataProps[name as keyof TMetadata]) {
        this.diagnostics.report(attribute.start, unsupportedTProp);
        continue;
      }
      metadata[name] = value;
    }
    return metadata as TMetadata;
  }

  #serializeChildren(
    nodes: AnyNode[],
    scope: TemplateScope,
    state: RichContentState,
    isRoot: boolean
  ): JsxChild[] {
    const children: JsxChild[] = [];
    for (const node of nodes) {
      switch (node.type) {
        case 'Text':
          children.push(node.data as string);
          break;
        case 'Comment':
          break;
        case 'RegularElement':
          children.push(this.#serializeElement(node, scope, state));
          break;
        case 'Component': {
          const binding = this.#binding(componentRoot(node), scope);
          if (binding?.imported === 'T') {
            this.diagnostics.report(node.start, nestedT);
          } else if (binding?.imported === 'gt') {
            this.diagnostics.report(node.start, directCallOnly);
          } else if (binding && isVariableExport(binding.imported)) {
            children.push(
              this.#serializeVariable(node, binding.imported, scope, state)
            );
          } else {
            children.push(this.#serializeElement(node, scope, state));
          }
          break;
        }
        default:
          this.diagnostics.report(node.start, dynamicTContent);
      }
    }
    return normalizeText(children, isRoot);
  }

  #serializeElement(
    node: AnyNode,
    scope: TemplateScope,
    state: RichContentState
  ): JsxElement {
    const id = state.nextId++;
    state.shells.push({ id, kind: 'element', node });
    if (this.#walkAttributes(node, scope).size) {
      this.diagnostics.report(node.start, dynamicTContent);
    }
    const children = toWireChildren(
      this.#serializeChildren(
        (node.fragment as AnyNode).nodes as AnyNode[],
        scope,
        state,
        false
      )
    );
    return {
      t: node.name as string,
      i: id,
      ...(children !== undefined && { c: children }),
    };
  }

  #serializeVariable(
    node: AnyNode,
    variable: VariableExport,
    scope: TemplateScope,
    state: RichContentState
  ): Variable {
    const id = state.nextId++;
    state.shells.push({ id, kind: 'variable', node, variable });
    if (variable === 'Var') {
      if ((node.attributes as AnyNode[]).length) {
        this.diagnostics.report(node.start, varProps);
      }
      this.#walkFragment(node.fragment as AnyNode, scope);
    } else {
      this.#walkElement(node, scope);
    }
    const { name, type } = variableExports[variable];
    return { i: id, k: `_gt_${name}_${id}`, v: type };
  }

  /** A snippet that renders the authored element or value with translated children. */
  #renderShell(shell: Shell): string {
    const { node } = shell;
    const children = ((node.fragment as AnyNode | undefined)?.nodes ??
      []) as AnyNode[];
    const first = children[0];
    const last = children.at(-1);
    if (shell.kind === 'variable') {
      const content =
        shell.variable !== 'Var'
          ? this.edits.text(node.start, node.end)
          : first && last
            ? this.edits.text(first.start, last.end)
            : '';
      return `{#snippet ${snippetName(shell.id)}()}${content}{/snippet}`;
    }
    if (!first || !last) {
      return `{#snippet ${snippetName(shell.id)}()}${this.edits.text(node.start, node.end)}{/snippet}`;
    }
    return `{#snippet ${snippetName(shell.id)}(${renderParam}, ${childrenParam})}${this.edits.text(
      node.start,
      first.start
    )}{@render ${renderParam}(${childrenParam})}${this.edits.text(last.end, node.end)}{/snippet}`;
  }
}

function componentRoot(node: AnyNode): string {
  return (node.name as string).split('.')[0]!;
}

function isExpressionTag(value: unknown): value is AnyNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as AnyNode).type === 'ExpressionTag'
  );
}

function attributeConstant(
  value: unknown
): string | number | boolean | undefined {
  if (value === true) return true;
  const parts = Array.isArray(value) ? value : [value];
  if (parts.length !== 1) return undefined;
  const [part] = parts as AnyNode[];
  if (part?.type === 'Text') return part.data as string;
  if (part?.type === 'ExpressionTag') return evaluateConstant(part.expression);
  return undefined;
}

/** Collapses whitespace like Svelte does and trims it at the `<T>` boundary. */
function normalizeText(children: JsxChild[], isRoot: boolean): JsxChild[] {
  const merged: JsxChild[] = [];
  for (const child of children) {
    const previous = merged.at(-1);
    if (typeof child === 'string' && typeof previous === 'string') {
      merged[merged.length - 1] = previous + child;
    } else {
      merged.push(child);
    }
  }
  const normalized = merged.map((child) =>
    typeof child === 'string' ? child.replace(whitespace, ' ') : child
  );
  if (isRoot) {
    if (typeof normalized[0] === 'string') {
      normalized[0] = normalized[0].trimStart();
    }
    const lastIndex = normalized.length - 1;
    if (typeof normalized[lastIndex] === 'string') {
      normalized[lastIndex] = (normalized[lastIndex] as string).trimEnd();
    }
  }
  return normalized.filter((child) => child !== '');
}

function toWireChildren(children: JsxChild[]): JsxChildren | undefined {
  if (!children.length) return undefined;
  return children.length === 1 ? children[0] : children;
}
