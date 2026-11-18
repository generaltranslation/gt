import { hashSource } from 'generaltranslation/id';
import type {
  JsxChild,
  JsxChildren,
  JsxElement,
  Variable,
} from 'generaltranslation/types';
import { parse, preprocess } from 'svelte/compiler';
import {
  childrenParam,
  componentHandle,
  handleAlias,
  hashProp,
  isVariableExport,
  lookupAlias,
  renderParam,
  snippetName,
  sourceProp,
  textParam,
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

type Namespace = 'html' | 'svg' | 'mathml';

const namespaceUris = {
  svg: 'http://www.w3.org/2000/svg',
  mathml: 'http://www.w3.org/1998/Math/MathML',
} as const;

type Shell =
  | { id: number; kind: 'element'; node: AnyNode; namespace: Namespace }
  | { id: number; kind: 'variable'; node: AnyNode; variable: VariableExport };

type RichContentState = { nextId: number; shells: Shell[] };

/** How the text inside an element renders. */
type TextContext = { isRoot: boolean; preserve: boolean };

/** Elements whose whitespace renders as written. */
const preformattedElements = new Set(['pre', 'textarea']);

/** Elements whose content Svelte accepts only as text and expressions. */
const rawTextElements = new Set(['textarea']);

const whitespace = /[\t\n\f\r ]+/g;
const leadingWhitespace = /^[\t\n\f\r ]+/;
const trailingWhitespace = /[\t\n\f\r ]+$/;

export type PreparedComponent = {
  /** Import sources in the component's scripts, to resolve before compiling. */
  importSources: string[];
  /** Returns `null` when the component uses nothing the plugin compiles. */
  compile(runtimeSources: ReadonlySet<string>): CompileResult | null;
};

const unparsable: PreparedComponent = {
  importSources: [],
  compile: () => null,
};

/**
 * The component with every `<style>` body replaced by spaces, so style
 * languages such as SCSS do not have to parse as CSS. Offsets stay the same.
 */
export async function withoutStyleContent(
  code: string,
  filename: string
): Promise<string> {
  if (!code.includes('<style')) return code;
  const { code: blanked } = await preprocess(
    code,
    { style: ({ content }) => ({ code: content.replace(/[^\n]/g, ' ') }) },
    { filename }
  );
  return blanked.length === code.length ? blanked : code;
}

/**
 * Parses a component once with Svelte's own parser.
 *
 * `parseSource` must have the same offsets as `code`; edits apply to `code`.
 * A component Svelte cannot parse is left for Svelte to report.
 */
export function prepareSvelteComponent(
  code: string,
  filename: string,
  filePath: string,
  parseSource: string = code
): PreparedComponent {
  let ast: AnyNode;
  try {
    ast = parse(parseSource, { modern: true, filename }) as unknown as AnyNode;
  } catch {
    return unparsable;
  }
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
    const options = this.ast.options as { namespace?: Namespace } | null;
    this.#walkFragment(
      this.ast.fragment as AnyNode,
      new TemplateScope(new Set()),
      options?.namespace ?? 'html'
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
        const declaration = `\nimport { createGTHandle as ${handleAlias} } from ${source};\nconst ${componentHandle} = ${handleAlias}();\n`;
        const bind = `\n;${componentHandle}.bind();\n`;
        if (instanceProgram) {
          output.appendLeft(instanceProgram.start, declaration);
          output.appendLeft(instanceProgram.end, bind);
        } else {
          output.prepend(`<script>${declaration}${bind}</script>\n`);
        }
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

  #walkFragment(
    fragment: AnyNode | null | undefined,
    scope: TemplateScope,
    namespace: Namespace
  ) {
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
    for (const node of nodes) this.#walkNode(node, inner, namespace);
  }

  #walkNode(node: AnyNode, scope: TemplateScope, namespace: Namespace): void {
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
        this.#walkFragment(node.consequent as AnyNode, scope, namespace);
        this.#walkFragment(node.alternate as AnyNode | null, scope, namespace);
        return;
      case 'EachBlock': {
        this.#expression(node.expression, scope);
        const names = new Set<string>();
        patternNames(node.context, names);
        if (typeof node.index === 'string') names.add(node.index);
        const body = scope.extend(names);
        if (node.context) this.#expression([node.context as AnyNode], body);
        this.#expression(node.key, body);
        this.#walkFragment(node.body as AnyNode, body, namespace);
        this.#walkFragment(
          node.fallback as AnyNode | undefined,
          scope,
          namespace
        );
        return;
      }
      case 'AwaitBlock': {
        this.#expression(node.expression, scope);
        this.#walkFragment(node.pending as AnyNode | null, scope, namespace);
        for (const [pattern, fragment] of [
          [node.value, node.then],
          [node.error, node.catch],
        ] as const) {
          const names = new Set<string>();
          patternNames(pattern, names);
          const inner = scope.extend(names);
          if (pattern) this.#expression([pattern as AnyNode], inner);
          this.#walkFragment(fragment as AnyNode | null, inner, namespace);
        }
        return;
      }
      case 'KeyBlock':
        this.#expression(node.expression, scope);
        this.#walkFragment(node.fragment as AnyNode, scope, namespace);
        return;
      case 'SnippetBlock': {
        const parameters = node.parameters as AnyNode[];
        const names = new Set<string>();
        for (const parameter of parameters) patternNames(parameter, names);
        const body = scope.extend(names);
        this.#expression(parameters, body);
        this.#walkFragment(node.body as AnyNode, body, namespace);
        return;
      }
      case 'Component': {
        const binding = this.#binding(componentRoot(node), scope);
        if (binding?.imported === 'T') {
          this.#compileT(node, scope, namespace);
          return;
        }
        if (binding?.imported === 'gt') {
          this.diagnostics.report(node.start, directCallOnly);
          return;
        }
        this.#walkElement(node, scope, namespace);
        return;
      }
      default:
        if (elementTypes.has(node.type)) {
          this.#walkElement(node, scope, namespace);
          return;
        }
        forEachChild(node, (child) => {
          if (child.type === 'Fragment') {
            this.#walkFragment(child, scope, namespace);
          } else if (templateTypes.has(child.type)) {
            this.#walkNode(child, scope, namespace);
          } else {
            this.#expression(child, scope);
          }
        });
    }
  }

  #walkElement(node: AnyNode, scope: TemplateScope, namespace: Namespace) {
    if (node.type === 'SvelteElement') this.#expression(node.tag, scope);
    if (node.type === 'SvelteComponent')
      this.#expression(node.expression, scope);
    const letNames = this.#walkAttributes(node, scope);
    this.#walkFragment(
      node.fragment as AnyNode,
      scope.extend(letNames),
      contentNamespace(node, namespace)
    );
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

  #compileT(node: AnyNode, scope: TemplateScope, namespace: Namespace) {
    const metadata = this.#readTMetadata(node);
    const state: RichContentState = { nextId: 1, shells: [] };
    const children = this.#serializeChildren(
      (node.fragment as AnyNode).nodes as AnyNode[],
      scope,
      state,
      namespace,
      { isRoot: true, preserve: false }
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
    namespace: Namespace,
    text: TextContext
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
          children.push(
            this.#serializeElement(node, scope, state, namespace, text)
          );
          break;
        case 'Component': {
          const binding = this.#binding(componentRoot(node), scope);
          if (binding?.imported === 'T') {
            this.diagnostics.report(node.start, nestedT);
          } else if (binding?.imported === 'gt') {
            this.diagnostics.report(node.start, directCallOnly);
          } else if (binding && isVariableExport(binding.imported)) {
            children.push(
              this.#serializeVariable(
                node,
                binding.imported,
                scope,
                state,
                namespace
              )
            );
          } else {
            children.push(
              this.#serializeElement(node, scope, state, namespace, text)
            );
          }
          break;
        }
        default:
          this.diagnostics.report(node.start, dynamicTContent);
      }
    }
    return normalizeText(children, text);
  }

  #serializeElement(
    node: AnyNode,
    scope: TemplateScope,
    state: RichContentState,
    parentNamespace: Namespace,
    parentText: TextContext
  ): JsxElement {
    const id = state.nextId++;
    const namespace = ownNamespace(node, parentNamespace);
    state.shells.push({ id, kind: 'element', node, namespace });
    if (this.#walkAttributes(node, scope).size) {
      this.diagnostics.report(node.start, dynamicTContent);
    }
    const preformatted =
      node.type === 'RegularElement' &&
      preformattedElements.has(node.name as string);
    const serialized = this.#serializeChildren(
      (node.fragment as AnyNode).nodes as AnyNode[],
      scope,
      state,
      contentNamespace(node, parentNamespace),
      {
        isRoot: false,
        preserve: parentText.preserve || preformatted,
      }
    );
    // The HTML parser drops one newline right after a <pre> or <textarea> tag.
    if (preformatted && typeof serialized[0] === 'string') {
      serialized[0] = serialized[0].replace(/^\r?\n/, '');
      if (!serialized[0]) serialized.shift();
    }
    const children = toWireChildren(serialized);
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
    state: RichContentState,
    namespace: Namespace
  ): Variable {
    const id = state.nextId++;
    state.shells.push({ id, kind: 'variable', node, variable });
    if (variable === 'Var') {
      if ((node.attributes as AnyNode[]).length) {
        this.diagnostics.report(node.start, varProps);
      }
      this.#walkFragment(node.fragment as AnyNode, scope, namespace);
    } else {
      this.#walkElement(node, scope, namespace);
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
    const name = node.name as string;
    const tag = elementTag(node, shell.namespace);
    if (!first || !last) {
      const markup = this.edits.text(node.start, node.end);
      const content = tag
        ? `${tag.open}${markup.slice(name.length + 1)}`.replace(
            new RegExp(`</${escapeRegExp(name)}\\s*>$`),
            tag.close
          )
        : markup;
      return `{#snippet ${snippetName(shell.id)}()}${content}{/snippet}`;
    }
    const open = this.edits.text(node.start, first.start);
    const close = this.edits.text(last.end, node.end);
    const content = rawTextElements.has(name)
      ? `{${textParam}}`
      : `{@render ${renderParam}(${childrenParam})}`;
    return `{#snippet ${snippetName(shell.id)}(${renderParam}, ${childrenParam}, ${textParam})}${
      tag ? tag.open + open.slice(name.length + 1) : open
    }${content}${tag ? tag.close : close}{/snippet}`;
  }
}

/** The namespace an element renders in, given the namespace around it. */
function ownNamespace(node: AnyNode, parent: Namespace): Namespace {
  if (node.type !== 'RegularElement') return parent;
  if (node.name === 'svg') return 'svg';
  if (node.name === 'math') return 'mathml';
  return parent;
}

/** The namespace of an element's children. */
function contentNamespace(node: AnyNode, parent: Namespace): Namespace {
  const own = ownNamespace(node, parent);
  return own === 'svg' && node.name === 'foreignObject' ? 'html' : own;
}

/**
 * A snippet outside its `<svg>` or `<math>` parent compiles as HTML, so an
 * element that renders in another namespace names it explicitly.
 */
function elementTag(
  node: AnyNode,
  namespace: Namespace
): { open: string; close: string } | undefined {
  if (
    namespace === 'html' ||
    node.type !== 'RegularElement' ||
    node.name === 'svg' ||
    node.name === 'math'
  ) {
    return undefined;
  }
  return {
    // A static xmlns does not reach Svelte's client namespace check, which
    // would then create MathML elements as SVG; an expression does.
    open: `<svelte:element this=${JSON.stringify(node.name)} xmlns={${JSON.stringify(namespaceUris[namespace])}}`,
    close: '</svelte:element>',
  };
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

/**
 * Collapses ASCII whitespace like Svelte does and trims it at the `<T>`
 * boundary. Preformatted text and non-breaking spaces stay as written.
 */
function normalizeText(
  children: JsxChild[],
  { isRoot, preserve }: TextContext
): JsxChild[] {
  const merged: JsxChild[] = [];
  for (const child of children) {
    const previous = merged.at(-1);
    if (typeof child === 'string' && typeof previous === 'string') {
      merged[merged.length - 1] = previous + child;
    } else {
      merged.push(child);
    }
  }
  if (preserve) return merged.filter((child) => child !== '');
  const normalized = merged.map((child) =>
    typeof child === 'string' ? child.replace(whitespace, ' ') : child
  );
  if (isRoot) {
    if (typeof normalized[0] === 'string') {
      normalized[0] = normalized[0].replace(leadingWhitespace, '');
    }
    const lastIndex = normalized.length - 1;
    if (typeof normalized[lastIndex] === 'string') {
      normalized[lastIndex] = (normalized[lastIndex] as string).replace(
        trailingWhitespace,
        ''
      );
    }
  }
  return normalized.filter((child) => child !== '');
}

function toWireChildren(children: JsxChild[]): JsxChildren | undefined {
  if (!children.length) return undefined;
  return children.length === 1 ? children[0] : children;
}
