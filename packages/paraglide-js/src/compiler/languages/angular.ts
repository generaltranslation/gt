import path from 'node:path';
import type * as AngularCompiler from '@angular/compiler';
import { parse, parseFragment, type DefaultTreeAdapterMap } from 'parse5';
import { staticKeyName, topLevelClasses, type ESTree } from '../utils/ast.js';
import type { SourceRange } from '../analysis/types.js';
import { parseCode } from '../utils/parse.js';
import { GeneratedCode } from './angular/generated-code.js';
import { writeTemplate } from './angular/template.js';

import type {
  ComponentFields,
  GeneratedScript,
  GeneratedSource,
  LanguageContext,
  SourceLanguage,
} from './language.js';

type Parse5Node = DefaultTreeAdapterMap['node'];
type Parse5Element = DefaultTreeAdapterMap['element'];
type Parse5Template = DefaultTreeAdapterMap['template'];
type InlineTemplate = SourceRange & { className: string | undefined };

const REQUIRES = ['@angular/compiler'];
const SCRIPT_SEPARATOR = '\n;\n';

/** Components with an inline `template` in a `.ts` file. */
export const angularComponentLanguage: SourceLanguage = {
  name: 'angular-component',
  extensions: ['.ts'],
  requires: REQUIRES,
  detect: (source) =>
    /@Component\s*\(/.test(source) && /\btemplate\s*:/.test(source),
  mayContain: ['@Component', 'template'],
  async generate(source, file, context) {
    const compiler = await loadCompiler(context);
    if (!compiler) return undefined;

    const generated = new GeneratedCode(source);
    generated.copy(0, source.length);

    const componentFields: ComponentFields[] = [];

    for (const { start, end, className } of inlineTemplates(source, file)) {
      generated.glue('\n');

      const template = { start, end, escapedString: true };
      writeTemplate(compiler, generated, file, template);
      componentFields.push({
        specifier: '',
        className,
        range: { start, end },
      });
    }

    return {
      code: generated.code,
      // Not "tsx": `<T>value` casts and generic arrows are not JSX.
      lang: 'ts',
      mappings: generated.mappings,
      componentFields,
    };
  },
};

/** A component's `templateUrl` file; plain HTML pages with inline module scripts. */
export const angularTemplateLanguage: SourceLanguage = {
  name: 'angular-template',
  extensions: ['.html'],
  requires: REQUIRES,
  async generate(source, file, context) {
    if (isPage(source)) return pageScripts(source);

    // Every Angular app has @angular/compiler: without it, an `.html` file is
    // read like a page, not reported as a skipped template.
    const compiler = await loadCompiler(context);
    if (!compiler) return pageScripts(source);

    const generated = new GeneratedCode(source);
    writeTemplate(compiler, generated, file);

    // `user.component.html` → `./user.component.ts`; Angular 20's `user.html` → `./user.ts`.
    const componentModule = `./${path.basename(file, '.html')}.ts`;

    return {
      code: generated.code,
      lang: 'ts',
      mappings: generated.mappings,
      componentFields: [{ specifier: componentModule }],
    };
  },
};

/** Analog single-file components: `<script lang="ts">`, `<template>`, `<style>`. */
export const analogLanguage: SourceLanguage = {
  name: 'analog',
  extensions: ['.ag', '.analog'],
  requires: REQUIRES,
  async generate(source, file, context) {
    const compiler = await loadCompiler(context);
    if (!compiler) return undefined;

    const generated = new GeneratedCode(source);

    const fragment = parseFragment(source, { sourceCodeLocationInfo: true });
    const blocks = fragment.childNodes.filter(isElement);
    const scripts = blocks.filter((block) => block.tagName === 'script');
    const templates = blocks.filter((block) => block.tagName === 'template');

    // Scripts first: the template reads their bindings.
    for (const script of scripts) {
      const isInline = attributeValue(script, 'src') === undefined;
      if (isInline) copyScript(generated, script);
    }

    for (const template of templates) {
      const content = contentRange(template);
      if (content) writeTemplate(compiler, generated, file, content);
    }

    return {
      code: generated.code,
      lang: 'ts',
      mappings: generated.mappings,
    };
  },
};

function loadCompiler(context: LanguageContext) {
  return context.load<typeof AngularCompiler>('@angular/compiler');
}

function inlineTemplates(source: string, file: string): InlineTemplate[] {
  const { program } = parseCode(file, source, { lang: 'ts' });

  return topLevelClasses(program).flatMap(inlineTemplatesOf);
}

function inlineTemplatesOf(classNode: ESTree.Class): InlineTemplate[] {
  const className = classNode.id?.name;
  const templates: InlineTemplate[] = [];

  for (const decorator of classNode.decorators) {
    const template = inlineTemplate(decorator);
    if (template) templates.push({ ...template, className });
  }

  return templates;
}

/** `@Component({ template: "…" })` → the range inside the quotes or backticks. */
function inlineTemplate(decorator: ESTree.Decorator): SourceRange | undefined {
  const call = decorator.expression;
  if (call.type !== 'CallExpression' || calleeName(call.callee) !== 'Component')
    return undefined;

  const [options] = call.arguments;
  if (options?.type !== 'ObjectExpression') return undefined;

  for (const property of options.properties) {
    if (property.type !== 'Property' || staticKeyName(property) !== 'template')
      continue;

    const { value } = property;
    const isStaticString =
      (value.type === 'Literal' && typeof value.value === 'string') ||
      (value.type === 'TemplateLiteral' && value.expressions.length === 0);

    if (isStaticString) return { start: value.start + 1, end: value.end - 1 };
  }

  return undefined;
}

/** `Component` or `core.Component` */
function calleeName(callee: ESTree.Expression): string | undefined {
  if (callee.type === 'Identifier') return callee.name;

  if (
    callee.type === 'MemberExpression' &&
    callee.property.type === 'Identifier'
  ) {
    return callee.property.name;
  }

  return undefined;
}

/** `index.html` is a page, never an Angular template: only its module scripts run. */
function isPage(source: string): boolean {
  const document = parse(source, { sourceCodeLocationInfo: true });

  return document.childNodes.some((node) => {
    if (node.nodeName === '#documentType') return true;

    // parse5 adds a missing `<html>`; only one that is written has a location.
    return (
      isElement(node) &&
      node.tagName === 'html' &&
      node.sourceCodeLocation != null
    );
  });
}

/** Each `<script type="module">` is a module of its own: none sees another's names. */
function pageScripts(source: string): GeneratedSource {
  const scripts: GeneratedScript[] = [];

  const visit = (node: Parse5Node) => {
    if (isElement(node) && isInlineModuleScript(node)) {
      scripts.push(moduleScript(source, node));
    }

    if ('childNodes' in node) node.childNodes.forEach(visit);

    if (isElement(node) && isTemplate(node)) {
      node.content.childNodes.forEach(visit);
    }
  };

  const document = parse(source, { sourceCodeLocationInfo: true });
  document.childNodes.forEach(visit);

  return { code: '', lang: 'js', mappings: [], scripts };
}

function moduleScript(source: string, script: Parse5Element): GeneratedScript {
  const generated = new GeneratedCode(source);
  copyScript(generated, script);

  return { code: generated.code, lang: 'js', mappings: generated.mappings };
}

function copyScript(generated: GeneratedCode, script: Parse5Element): void {
  const content = contentRange(script);
  if (!content) return;

  generated.copy(content.start, content.end);
  generated.glue(SCRIPT_SEPARATOR);
}

function isInlineModuleScript(element: Parse5Element): boolean {
  return (
    element.tagName === 'script' &&
    attributeValue(element, 'type') === 'module' &&
    attributeValue(element, 'src') === undefined
  );
}

function contentRange(element: Parse5Element): SourceRange | undefined {
  const location = element.sourceCodeLocation;
  if (!location?.startTag) return undefined;

  const start = location.startTag.endOffset;
  const end = location.endTag?.startOffset ?? location.endOffset;

  return end > start ? { start, end } : undefined;
}

function isElement(node: Parse5Node): node is Parse5Element {
  return 'tagName' in node;
}

function isTemplate(element: Parse5Element): element is Parse5Template {
  return element.tagName === 'template';
}

function attributeValue(
  element: Parse5Element,
  name: string
): string | undefined {
  return element.attrs.find((attribute) => attribute.name === name)?.value;
}
