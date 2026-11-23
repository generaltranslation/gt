import path from 'node:path';
import { parseSync } from 'oxc-parser';
import type * as Glint from '@glint/ember-tsc';
import type * as GlintStandalone from '@glint/ember-tsc/transform/standalone';
import { walk, type ESTree, type Node } from '../analysis/ast.js';

import { applyEdits, type Edit } from './edits.js';
import type { SourceLanguage } from './language.js';
import { mappingsFromVolar, type Mapping } from './mapping.js';

type Environment = Parameters<
  typeof GlintStandalone.rewriteModuleStandalone
>[1];

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

    return { code, lang, mappings };
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
    enter(node) {
      if (isMemberOf(node, GLINT_REF, 'this')) {
        edits.push({ start: node.object.start, end: node.property.start });
        return false;
      }

      edits.push(...arrowFunction(node), ...resolvedCall(node));
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
 * as the call it is.
 */
function resolvedCall(node: Node): Edit[] {
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

  return [
    { start: resolver.start, end: value.start },
    { start: value.end, end: resolver.end },
  ];
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
