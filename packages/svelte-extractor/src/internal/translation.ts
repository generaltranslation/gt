import type {
  GTProp,
  JsxChild,
  JsxChildren,
  JsxElement,
  Variable,
} from '@generaltranslation/format/types';
import { HTML_CONTENT_PROPS } from '@generaltranslation/format/types';
import {
  isAcceptedPluralForm,
  minifyVariableType,
} from 'generaltranslation/internal';
import { hashSource } from 'generaltranslation/id';
import type { GTBindings, GTComponentKind } from './imports.js';
import { resolveComponent } from './imports.js';
import type { FragmentWhitespace, RenderedText } from './whitespace.js';
import { getChildWhitespace, getRenderedText } from './whitespace.js';
import type {
  GTRuntimeMetadata,
  SvelteAttribute,
  SvelteElementNode,
  SvelteNode,
  TranslationMetadata,
} from './types.js';

/** Reserved identifier prefix for everything the preprocessor generates. */
export const RESERVED_PREFIX = '__gt_';

/** Props the preprocessor adds to `<T>`; users may not set them. */
const RESERVED_T_PROPS = new Set(['_hash', '_gtm']);

const VARIABLE_TYPES = {
  Var: 'variable',
  Num: 'number',
  Currency: 'currency',
  DateTime: 'datetime',
  RelativeTime: 'relativetime',
} as const;

/** Default variable key bases, matching React's `getVariableName`. */
const DEFAULT_VARIABLE_NAMES = {
  variable: 'value',
  number: 'n',
  datetime: 'date',
  currency: 'cost',
  relativetime: 'time',
} as const;

/** Svelte nodes that would execute logic the translation cannot represent. */
const BLOCK_NODE_TYPES = new Set([
  'IfBlock',
  'EachBlock',
  'AwaitBlock',
  'KeyBlock',
  'HtmlTag',
  'ConstTag',
  'RenderTag',
  'DebugTag',
]);

const BLOCK_NAMES: Record<string, string> = {
  IfBlock: '{#if}',
  EachBlock: '{#each}',
  AwaitBlock: '{#await}',
  KeyBlock: '{#key}',
  HtmlTag: '{@html}',
  ConstTag: '{@const}',
  RenderTag: '{@render}',
  DebugTag: '{@debug}',
  SnippetBlock: '{#snippet}',
};

/** A problem found at a source offset. */
export type TranslationProblem = {
  whatHappened: string;
  fix?: string;
  offset: number;
};

/** A text replacement inside `<T>` children used for source rendering. */
export type TextEdit = { start: number; end: number; text: string };

/** The analysis and rewrite plan for one `<T>`. */
export type TranslationPlan = {
  node: SvelteElementNode;
  source: JsxChildren;
  hash: string;
  metadata: TranslationMetadata;
  runtimeMetadata: GTRuntimeMetadata;
  /** Generated `{#snippet}` declarations, one per element and variable. */
  snippets: string[];
  /**
   * Text rewrites that write out the whitespace Svelte renders, so the source
   * renders the extracted text on the server and in the browser, with or
   * without the `preserveWhitespace` compiler option.
   */
  edits: TextEdit[];
};

export type TranslationAnalysis =
  | { ok: true; plan: TranslationPlan | null }
  | { ok: false; problems: TranslationProblem[] };

/**
 * Svelte passes component props as an object literal, where a `__proto__`
 * key sets the prototype, so `<Branch>` never receives such a branch.
 */
const PROTO_BRANCH_PROBLEM = '"__proto__" cannot be used as a branch name';

type Counter = { index: number };

/** Where converted children live: what contains them, and its scoped id. */
type Parent = { kind: 'T' | 'element' | 'branch'; id: string };

/** A variable's key and id, with the scope and parent it was declared in. */
type VariableSite = { scope: string; parent: string; key: string; id: number };

/**
 * Analyzes one `<T>` component and builds its serialized JSX children,
 * hash, runtime metadata, and generated snippets.
 *
 * Text keeps the whitespace Svelte renders for it. Element and variable ids,
 * variable keys, and branch numbering replicate React's `addGTIdentifier`
 * and `writeChildrenAsObjects` over Babel's JSX output, so the hash matches
 * a React `<T>` whose text has the same whitespace.
 */
export function analyzeTranslation(
  source: string,
  node: SvelteElementNode,
  bindings: GTBindings,
  variableEdits: TextEdit[] = [],
  /** Whitespace handling where `<T>` is rendered. */
  whitespace: FragmentWhitespace = {
    preserve: false,
    svg: false,
    svgText: false,
  }
): TranslationAnalysis {
  return new TranslationBuilder(source, bindings, variableEdits).build(
    node,
    getChildWhitespace(whitespace, node)
  );
}

class TranslationBuilder {
  private problems: TranslationProblem[] = [];
  private snippets: string[] = [];
  private edits: TextEdit[] = [];
  private runtimeMetadata: GTRuntimeMetadata = {};
  private variables: VariableSite[] = [];
  /**
   * Per enclosing element or branch body, the snippets declared directly in
   * it, by name. Generated snippets are declared directly under `<T>`, so
   * they redeclare these to keep the names their content uses in scope.
   */
  private localSnippets: Map<string, string>[] = [];

  constructor(
    private readonly source: string,
    private readonly bindings: GTBindings,
    /** Variable rewrites, which generated snippets must also apply. */
    private readonly variableEdits: TextEdit[]
  ) {}

  build(
    node: SvelteElementNode,
    whitespace: FragmentWhitespace
  ): TranslationAnalysis {
    const metadata = this.readMetadata(node);
    const children = this.convertChildren(
      node.fragment.nodes,
      '',
      { index: 0 },
      { kind: 'T', id: '' },
      whitespace
    );
    this.addVariableMetadata();

    if (this.problems.length > 0) {
      return { ok: false, problems: this.problems };
    }
    if (children === undefined) {
      return { ok: true, plan: null };
    }

    const hash = hashSource({
      source: children,
      ...(metadata.context && { context: metadata.context }),
      ...(metadata.maxChars != null && { maxChars: metadata.maxChars }),
      ...(metadata.requiresReview === true && { requiresReview: true }),
      dataFormat: 'JSX',
    });

    return {
      ok: true,
      plan: {
        node,
        source: children,
        hash,
        metadata,
        runtimeMetadata: this.runtimeMetadata,
        snippets: this.snippets,
        edits: this.edits,
      },
    };
  }

  // ===== <T> metadata ===== //

  private readMetadata(node: SvelteElementNode): TranslationMetadata {
    const metadata: TranslationMetadata = {};
    for (const attribute of node.attributes) {
      if (attribute.type !== 'Attribute') {
        if (attribute.type === 'SpreadAttribute') {
          this.problem(
            attribute.start,
            'Spread props are not supported on <T> because its metadata must be known at build time'
          );
        }
        continue;
      }
      const { name } = attribute as SvelteAttribute;
      if (RESERVED_T_PROPS.has(name)) {
        this.problem(
          attribute.start,
          `The "${name}" prop on <T> is reserved for the gt-svelte preprocessor`
        );
        continue;
      }
      switch (name) {
        case 'context':
        case 'id': {
          const value = getStaticString(attribute as SvelteAttribute);
          if (value === undefined) {
            this.problem(
              attribute.start,
              `The "${name}" prop on <T> must be a static string`
            );
          } else if (value) {
            metadata[name] = value;
          }
          break;
        }
        case 'maxChars': {
          const value = getStaticNumber(attribute as SvelteAttribute);
          if (value === undefined || !Number.isInteger(value)) {
            this.problem(
              attribute.start,
              'The "maxChars" prop on <T> must be a static integer'
            );
          } else {
            // The sign is ignored, as at runtime.
            metadata.maxChars = Math.abs(value);
          }
          break;
        }
        case 'requiresReview': {
          const value = getStaticBoolean(attribute as SvelteAttribute);
          if (value === undefined) {
            this.problem(
              attribute.start,
              'The "requiresReview" prop on <T> must be a static boolean'
            );
          } else if (value) {
            metadata.requiresReview = true;
          }
          break;
        }
      }
    }
    return metadata;
  }

  // ===== Children ===== //

  /**
   * Converts a node list into JSX children: `undefined` when empty, a single
   * child when there is exactly one, and an array otherwise, matching how
   * React receives `props.children`.
   */
  private convertChildren(
    nodes: SvelteNode[],
    scope: string,
    counter: Counter,
    parent: Parent,
    whitespace: FragmentWhitespace
  ): JsxChildren | undefined {
    const children: JsxChild[] = [];
    const rendered = getRenderedText(nodes, whitespace);
    for (const child of nodes) {
      const converted =
        child.type === 'Text'
          ? this.convertText(child, rendered.get(child))
          : this.convertNode(child, scope, counter, parent, whitespace);
      if (converted !== undefined) children.push(converted);
    }
    if (children.length === 0) return undefined;
    return children.length === 1 ? children[0] : children;
  }

  private convertNode(
    node: SvelteNode,
    scope: string,
    counter: Counter,
    parent: Parent,
    whitespace: FragmentWhitespace
  ): JsxChild | undefined {
    switch (node.type) {
      case 'Comment':
        // Equivalent to an empty JSX expression container, which JSX drops.
        return undefined;
      case 'ExpressionTag':
        return this.convertExpressionTag(node);
      case 'RegularElement':
      case 'SvelteElement':
        return this.convertElement(
          node as SvelteElementNode,
          scope,
          counter,
          whitespace
        );
      case 'Component':
        return this.convertComponent(
          node as SvelteElementNode,
          scope,
          counter,
          parent,
          whitespace
        );
      case 'SnippetBlock': {
        if (parent.kind === 'T') {
          this.problem(
            node.start,
            '{#snippet} cannot be declared directly inside <T> because Svelte would pass it to <T> as a prop',
            'Move the snippet outside <T>'
          );
          return undefined;
        }
        // Inside elements, snippets are opaque declarations kept verbatim,
        // so a <T> inside one would never be transformed.
        const nested = findComponent(node.body, this.bindings, 'T');
        if (nested) {
          this.problem(nested.start, '<T> cannot be nested inside another <T>');
        }
        return undefined;
      }
      default:
        if (BLOCK_NODE_TYPES.has(node.type)) {
          this.problem(
            node.start,
            `${BLOCK_NAMES[node.type]} is not supported inside <T>`,
            'Move it outside <T> or wrap it in <Var>'
          );
          return undefined;
        }
        this.problem(
          node.start,
          `<${String(node.name ?? node.type)}> is not supported inside <T>`
        );
        return undefined;
    }
  }

  /** Converts a text node, given the text Svelte renders for it. */
  private convertText(
    node: SvelteNode,
    rendered: RenderedText | undefined
  ): string | undefined {
    // Writing out the text Svelte renders keeps the source rendering it when
    // the compiler is configured to preserve whitespace, which the extractor
    // cannot see. It also makes whitespace written as an entity, which
    // Svelte trims on the server but not in the browser, render the same.
    const markup = rendered ? escapeText(rendered.markup) : '';
    if (markup !== node.raw) {
      this.edits.push({ start: node.start, end: node.end, text: markup });
    }
    return rendered?.text || undefined;
  }

  private convertExpressionTag(node: SvelteNode): string | undefined {
    const value = getStaticExpressionValue(node.expression as SvelteNode);
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    this.problem(
      node.start,
      'Dynamic content inside <T> must be wrapped in a variable component',
      'Wrap it in <Var>, <Num>, <Currency>, <DateTime>, or <RelativeTime>'
    );
    return undefined;
  }

  private convertComponent(
    node: SvelteElementNode,
    scope: string,
    counter: Counter,
    parent: Parent,
    whitespace: FragmentWhitespace
  ): JsxChild | undefined {
    const kind = resolveComponent(this.bindings, node.name);
    if (kind === 'T') {
      this.problem(node.start, '<T> cannot be nested inside another <T>');
      return undefined;
    }
    if (kind && kind in VARIABLE_TYPES) {
      return this.convertVariable(node, kind, scope, counter, parent);
    }
    if (kind === 'Branch' || kind === 'Plural') {
      return this.convertBranch(node, kind, scope, counter, whitespace);
    }
    return this.convertElement(node, scope, counter, whitespace);
  }

  // ===== Elements ===== //

  private convertElement(
    node: SvelteElementNode,
    scope: string,
    counter: Counter,
    whitespace: FragmentWhitespace
  ): JsxElement | undefined {
    const id = ++counter.index;
    for (const attribute of node.attributes) {
      if (attribute.type === 'AnimateDirective') {
        this.problem(
          attribute.start,
          'animate: directives are not supported inside <T>'
        );
      }
      if (attribute.type === 'LetDirective') {
        // Translated content renders from snippets declared directly under
        // <T>, where the slot props a let: directive binds do not exist.
        this.problem(
          attribute.start,
          'let: directives are not supported inside <T>',
          'Move <T> inside the component that provides the slot props'
        );
      }
    }
    if (
      node.type === 'Component' &&
      node.fragment.nodes.some(
        (child) =>
          child.type === 'SnippetBlock' && getSnippetName(child) === 'children'
      )
    ) {
      this.problem(
        node.start,
        'Components inside <T> cannot declare an explicit children snippet',
        'Pass the content as regular children instead'
      );
    }

    const element: JsxElement = { t: getTagName(node), i: id };
    const d = getContentProps(node);
    const enclosing = this.enclosingSnippets();
    const children = this.withLocalSnippets(node.fragment.nodes, () =>
      this.convertChildren(
        node.fragment.nodes,
        scope,
        counter,
        { kind: 'element', id: `${scope}${id}` },
        getChildWhitespace(whitespace, node)
      )
    );
    if (children !== undefined) element.c = children;
    if (d) element.d = d;

    this.snippets.push(
      `{#snippet ${RESERVED_PREFIX}e_${scope}${id}(${RESERVED_PREFIX}kids, ${RESERVED_PREFIX}d)}${enclosing}${this.renderElementTemplate(node)}{/snippet}`
    );
    return element;
  }

  /**
   * Copies an element's source with its children replaced by the
   * translated children and its translatable attributes made overridable.
   * Nested snippet declarations are kept because they are component props.
   */
  private renderElementTemplate(node: SvelteElementNode): string {
    const replacements: TextEdit[] = [];
    for (const attribute of node.attributes) {
      if (attribute.type !== 'Attribute') continue;
      const { name } = attribute as SvelteAttribute;
      const minified = CONTENT_PROP_NAMES.get(name);
      if (!minified) continue;
      const value = getStaticString(attribute as SvelteAttribute);
      if (value === undefined) continue;
      replacements.push({
        start: attribute.start,
        end: attribute.end,
        text: `${name}={${RESERVED_PREFIX}d?.${minified} ?? ${JSON.stringify(value)}}`,
      });
    }

    const childNodes = node.fragment.nodes;
    if (childNodes.length > 0) {
      const preserved = childNodes
        .filter((child) => child.type === 'SnippetBlock')
        .map((child) => this.slice(child.start, child.end))
        .join('');
      replacements.push({
        start: childNodes[0].start,
        end: childNodes[childNodes.length - 1].end,
        text: `${preserved}{@render ${RESERVED_PREFIX}kids()}`,
      });
    }

    return applyReplacements(this.source, node.start, node.end, replacements);
  }

  // ===== Variables ===== //

  private convertVariable(
    node: SvelteElementNode,
    kind: GTComponentKind,
    scope: string,
    counter: Counter,
    parent: Parent
  ): Variable | undefined {
    const id = ++counter.index;
    const variableType = VARIABLE_TYPES[kind as keyof typeof VARIABLE_TYPES];
    let key = `_gt_${DEFAULT_VARIABLE_NAMES[variableType]}_${id}`;
    const nameAttribute = findAttribute(node, 'name');
    if (nameAttribute) {
      const name = getStaticString(nameAttribute);
      if (name === undefined) {
        this.problem(
          nameAttribute.start,
          `The "name" prop on <${node.name}> must be a static string inside <T>`
        );
        return undefined;
      }
      key = name;
    }
    if (containsComponent(node.fragment, this.bindings, 'T')) {
      this.problem(node.start, '<T> cannot be nested inside another <T>');
      return undefined;
    }

    this.variables.push({ scope, parent: parent.id, key, id });
    this.snippets.push(
      `{#snippet ${RESERVED_PREFIX}v_${scope}${id}()}${this.enclosingSnippets()}${this.slice(node.start, node.end)}{/snippet}`
    );
    return { i: id, k: key, v: minifyVariableType(variableType) };
  }

  // ===== Branch / Plural ===== //

  private convertBranch(
    node: SvelteElementNode,
    kind: 'Branch' | 'Plural',
    scope: string,
    counter: Counter,
    whitespace: FragmentWhitespace
  ): JsxElement | undefined {
    const id = ++counter.index;
    // No inherited keys, so names like "constructor" are ordinary branches.
    const branches: Record<string, JsxChildren> = Object.create(null);
    // Branch names in declaration order. A branch's scope is named after its
    // position here, because joining raw names, which may contain `$`, could
    // give two different branches the same scope.
    const branchNames: string[] = [];

    // Attribute branches: static strings, like React string props.
    for (const attribute of node.attributes) {
      if (attribute.type === 'SpreadAttribute') {
        this.problem(
          attribute.start,
          `Spread props are not supported on <${node.name}> because its branches must be known at build time`
        );
        continue;
      }
      if (attribute.type !== 'Attribute') continue;
      const { name } = attribute as SvelteAttribute;
      if (!isBranchName(kind, name)) continue;
      if (name === '__proto__') {
        this.problem(attribute.start, PROTO_BRANCH_PROBLEM);
        continue;
      }
      const value = getStaticString(attribute as SvelteAttribute);
      if (value === undefined) {
        this.problem(
          attribute.start,
          `The "${name}" branch of <${node.name}> must be a static string or a {#snippet ${name}()}`
        );
        continue;
      }
      branches[name] = value;
      branchNames.push(name);
    }

    // Snippet branches: each body is a fragment numbered from the branch id.
    const childNodes: SvelteNode[] = [];
    for (const child of node.fragment.nodes) {
      if (child.type !== 'SnippetBlock') {
        childNodes.push(child);
        continue;
      }
      const name = getSnippetName(child);
      if (!name || !isBranchName(kind, name)) {
        this.problem(
          child.start,
          kind === 'Plural'
            ? `{#snippet ${name}()} is not a plural form`
            : `{#snippet ${name}()} cannot be used as a <${node.name}> branch`
        );
        continue;
      }
      if ((child.parameters as unknown[]).length > 0) {
        this.problem(
          child.start,
          `The {#snippet ${name}()} branch cannot take parameters`
        );
        continue;
      }
      if (name === '__proto__') {
        this.problem(child.start, PROTO_BRANCH_PROBLEM);
        continue;
      }
      if (Object.hasOwn(branches, name)) {
        this.problem(
          child.start,
          `The "${name}" branch of <${node.name}> is declared twice`
        );
        continue;
      }
      const branchScope = `${scope}b${id}_${branchNames.length}$`;
      branchNames.push(name);
      const branchCounter = { index: id };
      const fragmentId = ++branchCounter.index;
      const body = child.body as { nodes: SvelteNode[] };
      const content = this.withLocalSnippets(body.nodes, () =>
        this.convertChildren(
          body.nodes,
          branchScope,
          branchCounter,
          { kind: 'branch', id: `${branchScope}${fragmentId}` },
          getChildWhitespace(whitespace, child)
        )
      );
      const fragment: JsxElement = { t: `C${fragmentId}`, i: fragmentId };
      if (content !== undefined) fragment.c = content;
      this.snippets.push(
        `{#snippet ${RESERVED_PREFIX}e_${branchScope}${fragmentId}(${RESERVED_PREFIX}kids)}{@render ${RESERVED_PREFIX}kids()}{/snippet}`
      );
      branches[name] = fragment;
    }

    const element: JsxElement = { t: getTagName(node), i: id };
    let d = getContentProps(node);
    if (branchNames.length > 0) {
      d = {
        ...d,
        b: branches,
        t: kind === 'Plural' ? 'p' : 'b',
      };
    }
    // Fallback children keep the running counter, like React.
    const children = this.convertChildren(
      childNodes,
      scope,
      counter,
      { kind: 'element', id: `${scope}${id}` },
      getChildWhitespace(whitespace, node)
    );
    if (children !== undefined) element.c = children;
    if (d) element.d = d;

    const selector = findAttribute(node, kind === 'Plural' ? 'n' : 'branch');
    const snippetName = `${RESERVED_PREFIX}e_${scope}${id}`;
    (this.runtimeMetadata.b ??= {})[`${scope}${id}`] = {
      t: kind === 'Plural' ? 'p' : 'b',
      b: branchNames,
    };
    this.snippets.push(
      `{#snippet ${snippetName}(${RESERVED_PREFIX}pick)}${this.enclosingSnippets()}{@render ${RESERVED_PREFIX}pick(${
        selector ? attributeValueExpression(this.source, selector) : 'undefined'
      })}{/snippet}`
    );
    return element;
  }

  /**
   * Records each scope's variable keys. A key used more than once in a scope
   * also gets a per-parent entry, because gt-react resolves a translated
   * variable among the source children of the same parent.
   */
  private addVariableMetadata() {
    const counts = new Map<string, number>();
    for (const { scope, key } of this.variables) {
      const scopeKey = JSON.stringify([scope, key]);
      counts.set(scopeKey, (counts.get(scopeKey) ?? 0) + 1);
    }
    const metadata: GTRuntimeMetadata = {};
    for (const { scope, parent, key, id } of this.variables) {
      // Variable names are keys, so the maps have no inherited properties.
      ((metadata.v ??= {})[scope] ??= Object.create(null))[key] = id;
      if ((counts.get(JSON.stringify([scope, key])) ?? 0) > 1) {
        ((metadata.s ??= {})[parent] ??= Object.create(null))[key] = id;
      }
    }
    this.runtimeMetadata = { ...metadata, ...this.runtimeMetadata };
  }

  /** Converts `nodes` with the snippets declared among them in scope. */
  private withLocalSnippets<Result>(
    nodes: SvelteNode[],
    convert: () => Result
  ): Result {
    const declared = new Map<string, string>();
    for (const node of nodes) {
      const name = node.type === 'SnippetBlock' && getSnippetName(node);
      if (name) declared.set(name, this.slice(node.start, node.end));
    }
    this.localSnippets.push(declared);
    try {
      return convert();
    } finally {
      this.localSnippets.pop();
    }
  }

  /**
   * The snippet declarations in scope where the current node is converted.
   * An inner declaration shadows an outer one with the same name.
   */
  private enclosingSnippets(): string {
    const inScope = new Map<string, string>();
    for (const declared of this.localSnippets) {
      for (const [name, text] of declared) {
        inScope.delete(name);
        inScope.set(name, text);
      }
    }
    return [...inScope.values()].join('');
  }

  /** Copies source markup with the variable rewrites inside it applied. */
  private slice(start: number, end: number): string {
    const edits = this.variableEdits.filter(
      (edit) => edit.start >= start && edit.end <= end
    );
    return applyReplacements(this.source, start, end, edits);
  }

  private problem(offset: number, whatHappened: string, fix?: string) {
    this.problems.push({ offset, whatHappened, ...(fix && { fix }) });
  }
}

// ===== Helpers ===== //

const MARKUP_CHARACTERS: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '{': '&#123;',
  '}': '&#125;',
};

/** Escapes text so Svelte parses it back as the same text. */
function escapeText(text: string): string {
  return text.replace(/[&<{}]/g, (char) => MARKUP_CHARACTERS[char]);
}

const CONTENT_PROP_NAMES = new Map<string, string>(
  Object.entries(HTML_CONTENT_PROPS).map(([minified, full]) => [full, minified])
);

function isBranchName(kind: 'Branch' | 'Plural', name: string): boolean {
  if (kind === 'Plural') return isAcceptedPluralForm(name);
  return name !== 'branch' && name !== 'children' && !name.startsWith('data-');
}

function getTagName(node: SvelteElementNode): string {
  if (node.type === 'SvelteElement') {
    const tag = (node as SvelteNode & { tag?: SvelteNode | string }).tag;
    if (typeof tag === 'string') return tag;
    const value =
      tag && tag.type === 'Literal' ? (tag as { value?: unknown }).value : null;
    if (typeof value === 'string') return value;
    const thisAttribute = findAttribute(node, 'this');
    const staticThis = thisAttribute && getStaticString(thisAttribute);
    return staticThis || 'svelte:element';
  }
  return node.name;
}

/** Collects static translatable attributes into a GTProp, like React. */
function getContentProps(node: SvelteElementNode): GTProp | undefined {
  const d: GTProp = {};
  for (const [minified, full] of Object.entries(HTML_CONTENT_PROPS)) {
    const attribute = findAttribute(node, full);
    if (!attribute) continue;
    const value = getStaticString(attribute);
    if (value !== undefined) {
      d[minified as keyof typeof HTML_CONTENT_PROPS] = value;
    }
  }
  return Object.keys(d).length > 0 ? d : undefined;
}

export function findAttribute(
  node: SvelteElementNode,
  name: string
): SvelteAttribute | undefined {
  return node.attributes.find(
    (attribute): attribute is SvelteAttribute =>
      attribute.type === 'Attribute' &&
      (attribute as SvelteAttribute).name === name
  );
}

function getSnippetName(node: SvelteNode): string | undefined {
  return (node.expression as { name?: string } | undefined)?.name;
}

/** Returns the attribute's value when it is a compile-time string. */
export function getStaticString(
  attribute: SvelteAttribute
): string | undefined {
  const { value } = attribute;
  if (value === true) return undefined;
  if (Array.isArray(value)) {
    let result = '';
    for (const part of value) {
      if (part.type === 'Text') {
        result += part.data as string;
        continue;
      }
      if (part.type === 'ExpressionTag') {
        const partValue = getStaticExpressionValue(
          part.expression as SvelteNode
        );
        if (typeof partValue !== 'string') return undefined;
        result += partValue;
        continue;
      }
      return undefined;
    }
    return result;
  }
  if (value.type === 'ExpressionTag') {
    const expressionValue = getStaticExpressionValue(
      value.expression as SvelteNode
    );
    return typeof expressionValue === 'string' ? expressionValue : undefined;
  }
  return undefined;
}

function getStaticNumber(attribute: SvelteAttribute): number | undefined {
  const { value } = attribute;
  if (value === true || Array.isArray(value)) return undefined;
  if (value.type !== 'ExpressionTag') return undefined;
  const expressionValue = getStaticExpressionValue(
    value.expression as SvelteNode
  );
  return typeof expressionValue === 'number' ? expressionValue : undefined;
}

function getStaticBoolean(attribute: SvelteAttribute): boolean | undefined {
  const { value } = attribute;
  if (value === true) return true;
  if (Array.isArray(value) || value.type !== 'ExpressionTag') return undefined;
  const expression = value.expression as SvelteNode & { value?: unknown };
  return expression.type === 'Literal' && typeof expression.value === 'boolean'
    ? expression.value
    : undefined;
}

/**
 * Evaluates the expressions JSX treats as static text: string and number
 * literals, negated number literals, and template literals without
 * interpolations.
 */
export function getStaticExpressionValue(
  expression: SvelteNode
): string | number | undefined {
  if (expression.type === 'Literal') {
    const { value } = expression as { value?: unknown };
    if (typeof value === 'string' || typeof value === 'number') return value;
    return undefined;
  }
  if (expression.type === 'TemplateLiteral') {
    const { expressions, quasis } = expression as unknown as {
      expressions: unknown[];
      quasis: { value: { cooked?: string | null; raw: string } }[];
    };
    if (expressions.length > 0) return undefined;
    return quasis[0].value.cooked ?? quasis[0].value.raw;
  }
  if (
    expression.type === 'UnaryExpression' &&
    (expression as { operator?: string }).operator === '-'
  ) {
    const argument = getStaticExpressionValue(
      expression.argument as SvelteNode
    );
    return typeof argument === 'number' ? -argument : undefined;
  }
  return undefined;
}

/** Builds a JavaScript expression that evaluates to the attribute's value. */
function attributeValueExpression(
  source: string,
  attribute: SvelteAttribute
): string {
  const { value } = attribute;
  if (value === true) return 'true';
  if (!Array.isArray(value)) {
    const expression = value.expression as SvelteNode;
    return `(${source.slice(expression.start, expression.end)})`;
  }
  const parts = value.map((part) =>
    part.type === 'Text'
      ? JSON.stringify(part.data)
      : `String(${source.slice(
          (part.expression as SvelteNode).start,
          (part.expression as SvelteNode).end
        )})`
  );
  return parts.length === 0 ? '""' : `(${parts.join(' + ')})`;
}

function applyReplacements(
  source: string,
  start: number,
  end: number,
  replacements: TextEdit[]
): string {
  const sorted = [...replacements].sort((a, b) => a.start - b.start);
  let result = '';
  let cursor = start;
  for (const replacement of sorted) {
    result += source.slice(cursor, replacement.start) + replacement.text;
    cursor = replacement.end;
  }
  return result + source.slice(cursor, end);
}

/** Whether a fragment subtree contains a component resolving to `kind`. */
export function containsComponent(
  value: unknown,
  bindings: GTBindings,
  kind: GTComponentKind
): boolean {
  return findComponent(value, bindings, kind) !== undefined;
}

/** Finds the first component in a fragment subtree resolving to `kind`. */
function findComponent(
  value: unknown,
  bindings: GTBindings,
  kind: GTComponentKind
): SvelteNode | undefined {
  if (!value || typeof value !== 'object') return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findComponent(item, bindings, kind);
      if (found) return found;
    }
    return undefined;
  }
  const node = value as SvelteNode;
  if (
    node.type === 'Component' &&
    resolveComponent(bindings, node.name as string) === kind
  ) {
    return node;
  }
  for (const key in node) {
    if (key === 'metadata' || key === 'loc' || key === 'name_loc') continue;
    const found = findComponent(node[key], bindings, kind);
    if (found) return found;
  }
  return undefined;
}
