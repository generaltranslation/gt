import fs from 'node:fs';
import path from 'node:path';
import { parse, type SFCBlock } from '@vue/compiler-sfc';
import type { ParserPlugin } from '@babel/parser';
import type { Updates } from '../../types/index.js';
import type { GTParsingFlags } from '../../types/parsing.js';
import { matchFiles } from '../../fs/matchFiles.js';
import { DEFAULT_VUE_SRC_PATTERNS } from '../../config/generateSettings.js';
import {
  calculateHashes,
  dedupeUpdates,
} from '../../extraction/postProcess.js';
import { parseVueScript } from './script.js';
import { parseVueTemplate } from './template.js';
import type { TemplateBindings } from './types.js';
import { addVueError, createVueExtractionContext } from './utils.js';

const SCRIPT_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
]);

export async function createVueInlineUpdates(
  filePatterns: string[] | undefined,
  parsingFlags: GTParsingFlags
): Promise<{ updates: Updates; errors: string[]; warnings: string[] }> {
  const updates: Updates = [];
  const errors: string[] = [];
  const warnings = new Set<string>();
  const files = matchFiles(
    process.cwd(),
    filePatterns ?? DEFAULT_VUE_SRC_PATTERNS
  );

  for (const file of files) {
    const extension = path.extname(file).toLowerCase();
    if (extension !== '.vue' && !SCRIPT_EXTENSIONS.has(extension)) continue;

    const source = await fs.promises.readFile(file, 'utf8');
    const context = createVueExtractionContext(
      file,
      parsingFlags.includeSourceCodeContext,
      updates,
      errors,
      warnings
    );
    if (extension === '.vue') {
      parseVueSingleFileComponent(source, context);
    } else {
      parseVueScript(
        source,
        languageFromExtension(extension),
        context,
        createTemplateBindings(),
        false
      );
    }
  }

  await calculateHashes(updates);
  dedupeUpdates(updates);
  return { updates, errors, warnings: [...warnings] };
}

function parseVueSingleFileComponent(
  source: string,
  context: ReturnType<typeof createVueExtractionContext>
): void {
  const expressionPlugins: ParserPlugin[] = sourceUsesTypeScript(source)
    ? ['typescript']
    : [];
  const result = parse(source, {
    filename: context.file,
    pad: 'space',
    sourceMap: false,
    templateParseOptions: { expressionPlugins },
  });

  for (const error of result.errors) {
    const compilerError =
      typeof error === 'string'
        ? undefined
        : (error as SyntaxError & {
            loc?: ReturnType<typeof normalizeCompilerLocation>;
          });
    addVueError(
      context,
      compilerError?.loc
        ? normalizeCompilerLocation(compilerError.loc)
        : undefined,
      `Could not parse a gt-vue single-file component: ${typeof error === 'string' ? error : error.message}`,
      'Fix the Vue template syntax before extracting translations'
    );
  }

  const bindings = createTemplateBindings();
  parseScriptBlock(result.descriptor.script, false, context, bindings);
  parseScriptBlock(result.descriptor.scriptSetup, true, context, bindings);

  const template = result.descriptor.template;
  if (!template) return;
  if (template.lang && template.lang !== 'html') {
    addVueError(
      context,
      template.loc,
      `Found unsupported Vue template language "${template.lang}"`,
      'Use a standard HTML Vue template for gt-vue extraction'
    );
    return;
  }
  if (template.src) {
    addVueError(
      context,
      template.loc,
      'Found an externally sourced Vue template',
      'Keep the template in the .vue file so gt-vue can extract it'
    );
    return;
  }
  if (template.ast) {
    parseVueTemplate(template.ast, bindings, expressionPlugins, context);
  }
}

function parseScriptBlock(
  block: SFCBlock | null,
  exposeToTemplate: boolean,
  context: ReturnType<typeof createVueExtractionContext>,
  bindings: TemplateBindings
): void {
  if (!block) return;
  if (block.src) {
    addVueError(
      context,
      block.loc,
      'Found an externally sourced Vue script block',
      'Keep translation calls and gt-vue imports in the .vue file'
    );
    return;
  }
  if (!isSupportedScriptLanguage(block.lang)) {
    addVueError(
      context,
      block.loc,
      `Found unsupported Vue script language "${block.lang}"`,
      'Use JavaScript or TypeScript for gt-vue extraction'
    );
    return;
  }
  // compiler-sfc's space padding preserves full-file lines, columns, and
  // offsets while keeping each block independently parseable by Babel.
  parseVueScript(
    block.content,
    block.lang,
    context,
    bindings,
    exposeToTemplate
  );
}

function createTemplateBindings(): TemplateBindings {
  return { components: new Map(), stringFunctions: new Map() };
}

function sourceUsesTypeScript(source: string): boolean {
  return /<script\b[^>]*\blang\s*=\s*["']tsx?["']/i.test(source);
}

function isSupportedScriptLanguage(language: string | undefined): boolean {
  return (
    language === undefined ||
    language === 'js' ||
    language === 'jsx' ||
    language === 'ts' ||
    language === 'tsx'
  );
}

function languageFromExtension(extension: string): string {
  if (extension === '.ts' || extension === '.mts' || extension === '.cts') {
    return 'ts';
  }
  if (extension === '.tsx') return 'tsx';
  if (extension === '.jsx') return 'jsx';
  return 'js';
}

function normalizeCompilerLocation(location: {
  end?: { column?: number; line?: number; offset?: number };
  start?: { column?: number; line?: number; offset?: number };
}) {
  const start = location.start ?? {};
  const end = location.end ?? start;
  return {
    start: {
      column: start.column ?? 1,
      line: start.line ?? 1,
      offset: start.offset ?? 0,
    },
    end: {
      column: end.column ?? start.column ?? 1,
      line: end.line ?? start.line ?? 1,
      offset: end.offset ?? start.offset ?? 0,
    },
  };
}
