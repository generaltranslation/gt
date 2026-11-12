import path from 'node:path';
import { parseSync } from 'oxc-parser';
import type * as Glint from '@glint/ember-tsc';
import type * as GlintStandalone from '@glint/ember-tsc/transform/standalone';
import { walk, type ESTree, type Node } from '../analysis/ast.js';
import type { SourceRange } from '../analysis/types.js';
import { applyEdits, type Edit } from './edits.js';
import {
  openingTagEnd,
  type SourceAttribute,
  type SourceElement,
} from './elements.js';
import type { SourceLanguage } from './language.js';
import { mappingsFromVolar, type Mapping } from './mapping.js';

type TransformedModule = NonNullable<
  ReturnType<typeof GlintStandalone.rewriteModuleStandalone>
>;
type MappingTree = NonNullable<
  TransformedModule['correlatedSpans'][number]['glimmerAstMapping']
>;
type Environment = Parameters<
  typeof GlintStandalone.rewriteModuleStandalone
>[1];
type GlimmerElement = SourceRange & {
  tag: string;
  attributes: Map<object, SourceAttribute>;
};

const GLINT_DSL = '__glintDSL__';
const GLINT_REF = '__glintRef__';

const environments = new Map<string, Environment>();

/**
 * Ember's template tag format (`.gjs`, `.gts`), through Glint: its transform
 * turns each `<template>` into TypeScript that calls Glint's template DSL.
 */
export const emberLanguage: SourceLanguage = {
  name: 'ember',
  extensions: ['.gjs', '.gts'],
  requires: ['@glint/ember-tsc'],
  async generate(source, file, context) {
    const [glint, standalone] = await Promise.all([
      context.load<typeof Glint>('@glint/ember-tsc'),
      context.load<typeof GlintStandalone>(
        '@glint/ember-tsc/transform/standalone'
      ),
    ]);
    if (!glint || !standalone) return undefined;

    const script = { filename: file, contents: source };
    const environment = environmentFor(glint, path.dirname(file));
    const transformed = standalone.rewriteModuleStandalone(
      { script },
      environment
    );
    if (!transformed) throw new Error('Glint did not transform the file');

    const [error] = transformed.errors;
    if (error) throw new Error(`Glint: ${error.message.split('\n')[0]}`);

    const lang = file.endsWith('.gts') ? 'ts' : 'js';
    const glintCode = transformed.transformedContents;
    const glintMappings = mappingsFromVolar(transformed.toVolarMappings());
    const { code, mappings } = normalizeGlintCode(
      glintCode,
      glintMappings,
      lang
    );
    const elements = sourceElements(transformed, source);

    return { code, lang, mappings, elements };
  },
};

function environmentFor(glint: typeof Glint, directory: string): Environment {
  let environment = environments.get(directory);

  if (!environment) {
    // The default config takes TypeScript, which the transform does not use.
    const config =
      projectConfig(glint, directory) ??
      glint.createDefaultConfig(undefined as never, directory);

    environment = config.environment;
    environments.set(directory, environment);
  }

  return environment;
}

function projectConfig(glint: typeof Glint, directory: string) {
  try {
    return glint.findConfig(directory);
  } catch {
    // A broken or foreign config.
    return null;
  }
}

/** Makes Glint's output read like the template it was generated from. */
function normalizeGlintCode(
  code: string,
  mappings: readonly Mapping[],
  lang: 'js' | 'ts'
): { code: string; mappings: Mapping[] } {
  const { program } = parseSync(`glint.${lang}`, code, { lang });
  const edits: Edit[] = [];

  walk(program, {
    enter(node, ancestors) {
      if (isMemberOf(node, GLINT_REF, 'this')) {
        edits.push({ start: node.object.start, end: node.property.start });
        return false;
      }

      edits.push(
        ...arrowFunction(node),
        ...resolvedCall(node, ancestors.at(-1))
      );
      return true;
    },
  });

  return applyEdits(code, mappings, edits);
}

/**
 * `function (__glintRef__, …) { … __glintRef__.this.label … }` →
 * `(__glintRef__, …) => { … this.label … }`: a class's template then reads the
 * class's members.
 */
function arrowFunction(node: Node): Edit[] {
  if (
    node.type !== 'FunctionExpression' ||
    node.id ||
    node.async ||
    node.generator
  )
    return [];

  const [firstParameter] = node.params;
  const takesGlintRef =
    firstParameter?.type === 'Identifier' && firstParameter.name === GLINT_REF;
  if (!node.body || !takesGlintRef) return [];

  return [
    { start: node.start, end: node.start + 'function'.length },
    { start: node.body.start, end: node.body.start, text: '=> ' },
  ];
}

/**
 * `__glintDSL__.resolve(helper)(args)` → `helper(args)`: `{{m.title}}` then reads
 * as the call it is. A component keeps the wrapper: in
 * `emitComponent(__glintDSL__.resolve(Card)(…))`, `Card` is a component tag.
 */
function resolvedCall(node: Node, parent: Node | undefined): Edit[] {
  if (node.type !== 'CallExpression') return [];

  const resolver = node.callee;
  if (resolver.type !== 'CallExpression') return [];
  if (!isMemberOf(resolver.callee, GLINT_DSL, 'resolve', 'resolveOrReturn'))
    return [];

  const [value] = resolver.arguments;
  if (
    !value ||
    resolver.arguments.length !== 1 ||
    value.type === 'SpreadElement'
  )
    return [];

  const isComponent =
    parent?.type === 'CallExpression' &&
    parent.arguments.some((argument) => argument === node) &&
    isMemberOf(parent.callee, GLINT_DSL, 'emitComponent');
  if (isComponent) return [];

  return [
    { start: resolver.start, end: value.start },
    { start: value.end, end: resolver.end },
  ];
}

function sourceElements(
  transformed: TransformedModule,
  source: string
): SourceElement[] {
  const elements = glimmerElements(transformed);

  return elements.map((element) => sourceElement(element, source));
}

function glimmerElements(transformed: TransformedModule): GlimmerElement[] {
  const elements = new Map<object, GlimmerElement>();

  const visit = (
    tree: MappingTree,
    templateStart: number,
    parent: GlimmerElement | undefined
  ) => {
    const node = tree.sourceNode;
    const start = templateStart + tree.originalRange.start;
    const end = templateStart + tree.originalRange.end;
    let element = parent;

    if (node.type === 'ElementNode') {
      element = elements.get(node) ?? {
        tag: node.tag,
        start,
        end,
        attributes: new Map(),
      };
      elements.set(node, element);
      extend(element, start, end);
    } else if (node.type === 'AttrNode' && parent) {
      const attribute = parent.attributes.get(node) ?? {
        name: node.name,
        start,
        end,
      };
      parent.attributes.set(node, attribute);
      extend(attribute, start, end);
    }

    for (const child of tree.children) visit(child, templateStart, element);
  };

  for (const span of transformed.correlatedSpans) {
    if (span.glimmerAstMapping)
      visit(span.glimmerAstMapping, span.originalStart, undefined);
  }

  return [...elements.values()];
}

function sourceElement(element: GlimmerElement, source: string): SourceElement {
  const { tag, start, end } = element;
  const nameStart = start + 1;
  const nameEnd = nameStart + tag.length;

  const attributes = [...element.attributes.values()];
  const attributeEnds = attributes.map((attribute) => attribute.end);

  // `<Card>`, `<@block>`, `<this.Card>`, `<ui.Card>`; not `<:named>` blocks.
  const isComponent = /^[A-Z@]/.test(tag) || /^[\w$]+\./.test(tag);

  return {
    name: tag,
    start: nameEnd,
    end,
    nameStart,
    nameEnd,
    openEnd: openingTagEnd(source, nameEnd, attributeEnds),
    component: isComponent,
    attributes,
  };
}

function isMemberOf(
  node: Node,
  object: string,
  ...properties: string[]
): node is ESTree.StaticMemberExpression {
  return (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.object.type === 'Identifier' &&
    node.object.name === object &&
    node.property.type === 'Identifier' &&
    properties.includes(node.property.name)
  );
}

/** Glint maps a node in parts: the widest range is the node's. */
function extend(range: SourceRange, start: number, end: number): void {
  range.start = Math.min(range.start, start);
  range.end = Math.max(range.end, end);
}
