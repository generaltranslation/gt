import { extname } from 'node:path';
import type { ParserPlugin } from '@babel/parser';
import type { SFCBlock, TemplateCompiler } from '#vue-compiler-sfc';
import type { RootNode } from '@vue/compiler-dom';
import type {
  VueCompilerOptions,
  VueExtractionOptions,
  VueExtractionOutput,
} from '../types.js';
import {
  collectVueScriptImports,
  createVueScriptAnalysis,
  exposeVueScriptImportsToTemplate,
  parseVueScript,
  type VueScriptAnalysis,
} from './script.js';
import {
  shiftCompilerAstLocations,
  shiftCompilerLocation,
} from './compilerAst.js';
import { createLocalModuleResolver } from './script/localModules.js';
import { parseVueTemplate } from './template.js';
import type { TemplateBindings, VueExtractionContext } from './types.js';
import { addVueError, createVueExtractionContext } from './utils.js';
import {
  inspectVueCompiler,
  resolveVueCompiler,
  type ResolvedVueCompiler,
} from './vueCompiler.js';

const DEFAULT_SURROUNDING_LINE_COUNT = 5;

/**
 * Extracts General Translation content from one Vue SFC or JavaScript file.
 *
 * The caller owns file discovery, I/O, hashing, and deduplication. This keeps
 * the extractor usable independently from the `gt` CLI, like the Python
 * extractor package.
 */
export async function extractFromVueSource(
  sourceCode: string,
  filePath: string,
  options: VueExtractionOptions = {}
): Promise<VueExtractionOutput> {
  const results: VueExtractionOutput['results'] = [];
  const errors: string[] = [];
  const warnings = new Set<string>();
  const context = createVueExtractionContext(
    filePath,
    sourceCode,
    options.projectRoot ?? process.cwd(),
    options.includeSourceCodeContext ?? false,
    options.surroundingLineCount ?? DEFAULT_SURROUNDING_LINE_COUNT,
    results,
    errors,
    warnings
  );
  const extension = extname(filePath).toLowerCase();
  const scriptAnalysis = createVueScriptAnalysis();
  scriptAnalysis.entryFile = filePath;
  scriptAnalysis.localModules = createLocalModuleResolver(
    options.resolveModule
  );

  if (extension === '.vue') {
    const compilerResolution =
      options.compiler !== undefined
        ? inspectVueCompiler(options.compiler)
        : resolveVueCompiler(filePath, options.projectRoot ?? process.cwd());
    if (!compilerResolution.ok) {
      addVueError(
        context,
        undefined,
        'Could not load the Vue compiler used by this single-file component',
        `Install a supported Vue 3 compiler beside the app. ${compilerResolution.details}`
      );
      return { results, errors, warnings: [...warnings] };
    }
    context.implicitSlotWhitespace =
      compilerResolution.value.implicitSlotWhitespace;
    parseVueSingleFileComponent(
      sourceCode,
      context,
      options.compilerOptions ?? {},
      compilerResolution.value,
      scriptAnalysis
    );
  } else {
    parseVueScript(
      sourceCode,
      languageFromExtension(extension),
      context,
      createTemplateBindings(),
      false,
      scriptAnalysis,
      false
    );
  }

  return { results, errors, warnings: [...warnings] };
}

function parseVueSingleFileComponent(
  source: string,
  context: VueExtractionContext,
  compilerOptions: VueCompilerOptions,
  resolvedCompiler: ResolvedVueCompiler,
  scriptAnalysis: VueScriptAnalysis
): void {
  const { compiler } = resolvedCompiler;
  if (
    compilerOptions.delimiters &&
    !resolvedCompiler.templateCompiler &&
    !resolvedCompiler.templateParseOptionsSupported
  ) {
    addVueError(
      context,
      undefined,
      'Could not safely apply custom Vue template delimiters with the supplied compiler',
      'Let the extractor resolve the consuming app compiler, or supply a Vue compiler that applies templateParseOptions during SFC parsing'
    );
    return;
  }
  const expressionPlugins: ParserPlugin[] = sourceUsesTypeScript(source)
    ? ['typescript']
    : [];
  const templateCompiler = createConfiguredTemplateCompiler(
    resolvedCompiler,
    compilerOptions,
    expressionPlugins,
    true
  );
  const result = compiler.parse(source, {
    ...(templateCompiler && { compiler: templateCompiler }),
    filename: context.file,
    pad: 'space',
    sourceMap: false,
    templateParseOptions: {
      ...compilerOptions,
      comments: true,
      expressionPlugins,
    },
  });

  for (const error of result.errors) {
    const compilerError =
      typeof error === 'string'
        ? undefined
        : (error as SyntaxError & {
            loc?: Parameters<typeof normalizeCompilerLocation>[0];
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
  // Vue's SFC parser recovers a partial AST for malformed markup. Publishing
  // translations from that recovery tree can replace complete catalogs with
  // an incomplete source set, so structural parse errors are file-fatal.
  if (result.errors.length > 0) return;

  const bindings = createTemplateBindings();
  collectScriptBlockImports(result.descriptor.script, scriptAnalysis);
  collectScriptBlockImports(result.descriptor.scriptSetup, scriptAnalysis);
  const scriptValid = parseScriptBlock(
    result.descriptor.script,
    false,
    context,
    bindings,
    scriptAnalysis
  );
  if (result.descriptor.scriptSetup) {
    exposeVueScriptImportsToTemplate(scriptAnalysis, bindings);
  }
  const scriptSetupValid = parseScriptBlock(
    result.descriptor.scriptSetup,
    true,
    context,
    bindings,
    scriptAnalysis
  );
  if (!scriptValid || !scriptSetupValid) {
    context.results.length = 0;
    return;
  }

  const template = result.descriptor.template;
  if (!template) return;
  if (template.lang && template.lang !== 'html') {
    addVueError(
      context,
      template.loc,
      `Found unsupported Vue template language "${template.lang}"`,
      'Use a standard HTML Vue template for gt-vue extraction'
    );
    context.results.length = 0;
    return;
  }
  if (template.src) {
    addVueError(
      context,
      template.loc,
      'Found an externally sourced Vue template',
      'Keep the template in the .vue file so gt-vue can extract it'
    );
    context.results.length = 0;
    return;
  }
  const templateAst = resolvedCompiler.parseTemplate
    ? parseTemplateWithCompiler(
        template.content,
        compilerOptions,
        expressionPlugins,
        true,
        context,
        resolvedCompiler.parseTemplate,
        template.loc.start
      )
    : template.ast;
  if (templateAst) {
    const templateResultStart = context.results.length;
    const templateErrorStart = context.errors.length;
    parseVueTemplate(templateAst, bindings, expressionPlugins, context);
    if (
      context.errors.length === templateErrorStart &&
      template.content.includes('<!--') &&
      !matchesProductionTemplate(
        source,
        compilerOptions,
        expressionPlugins,
        bindings,
        context,
        templateResultStart,
        resolvedCompiler
      )
    ) {
      context.results.length = templateResultStart;
      addVueError(
        context,
        template.loc,
        'Found translatable Vue content whose hash changes between development and production',
        'Remove comments that split translatable text or whitespace, or move those comments outside gt-vue <T> components'
      );
    }
  }
}

/**
 * Verifies that Vite's production comment stripping preserves extracted data.
 *
 * Vue parses templates with comments in development and without them in
 * production. Removing a comment can renormalize adjacent whitespace, so a
 * single persisted catalog key cannot serve both builds. The second parse is
 * limited to templates that contain comments and never executes project code.
 */
function matchesProductionTemplate(
  source: string,
  compilerOptions: VueCompilerOptions,
  expressionPlugins: ParserPlugin[],
  bindings: TemplateBindings,
  context: VueExtractionContext,
  developmentResultStart: number,
  resolvedCompiler: ResolvedVueCompiler
): boolean {
  const { compiler } = resolvedCompiler;
  const templateCompiler = createConfiguredTemplateCompiler(
    resolvedCompiler,
    compilerOptions,
    expressionPlugins,
    false
  );
  const production = compiler.parse(source, {
    ...(templateCompiler && { compiler: templateCompiler }),
    filename: context.file,
    pad: 'space',
    sourceMap: false,
    templateParseOptions: {
      ...compilerOptions,
      comments: false,
      expressionPlugins,
    },
  });
  const template = production.descriptor.template;
  if (production.errors.length > 0 || !template) return false;

  const productionContext: VueExtractionContext = {
    ...context,
    errors: [],
    results: [],
    warnings: new Set(),
  };
  const templateAst = resolvedCompiler.parseTemplate
    ? parseTemplateWithCompiler(
        template.content,
        compilerOptions,
        expressionPlugins,
        false,
        productionContext,
        resolvedCompiler.parseTemplate,
        template.loc.start
      )
    : template.ast;
  if (!templateAst) return false;
  parseVueTemplate(templateAst, bindings, expressionPlugins, productionContext);
  if (productionContext.errors.length > 0) return false;

  const developmentResults = context.results.slice(developmentResultStart);
  return (
    comparableTemplateResults(developmentResults) ===
    comparableTemplateResults(productionContext.results)
  );
}

/**
 * Applies hash-affecting options during compiler-sfc's structural parse.
 *
 * Vue 3.3 ignores `templateParseOptions`, which can make delimiter-shaped text
 * close an SFC block before the exact template-content parse runs. Supplying
 * the adjacent compiler-dom parser makes the descriptor structural parse use
 * the same delimiters and whitespace. Vue 3.3 caches SFC parses using the
 * parser function's string form, so its deterministic identity includes every
 * closure-captured option to prevent cross-option cache poisoning.
 */
function createConfiguredTemplateCompiler(
  resolvedCompiler: ResolvedVueCompiler,
  compilerOptions: VueCompilerOptions,
  expressionPlugins: ParserPlugin[],
  comments: boolean
): TemplateCompiler | undefined {
  const templateCompiler = resolvedCompiler.templateCompiler;
  if (!templateCompiler) return undefined;

  const parse: TemplateCompiler['parse'] = (source, baseOptions) =>
    templateCompiler.parse(source, {
      ...baseOptions,
      ...compilerOptions,
      comments,
      expressionPlugins,
    });
  const identity = JSON.stringify({
    comments,
    delimiters: compilerOptions.delimiters,
    expressionPlugins,
    version: resolvedCompiler.version,
    whitespace: compilerOptions.whitespace,
  });
  Object.defineProperty(parse, 'toString', {
    value: () => `gtVueTemplateParse:${identity}`,
  });

  return { compile: templateCompiler.compile, parse };
}

/** Parses template content with the exact compiler-dom beside consumer Vue. */
function parseTemplateWithCompiler(
  source: string,
  compilerOptions: VueCompilerOptions,
  expressionPlugins: ParserPlugin[],
  comments: boolean,
  context: VueExtractionContext,
  parseTemplate: NonNullable<ResolvedVueCompiler['parseTemplate']>,
  origin: CompilerPosition
): RootNode | undefined {
  const errors: Array<SyntaxError & { loc?: ExtractionLocationLike }> = [];
  const ast = parseTemplate(source, {
    ...compilerOptions,
    comments,
    expressionPlugins,
    onError(error) {
      errors.push(error as SyntaxError & { loc?: ExtractionLocationLike });
    },
  });
  if (errors.length === 0) {
    shiftCompilerAstLocations(ast, origin);
    return ast;
  }
  const shiftedErrorPositions = new WeakSet<object>();
  for (const error of errors) {
    if (error.loc) {
      shiftCompilerLocation(error.loc, origin, shiftedErrorPositions);
    }
    addVueError(
      context,
      error.loc ? normalizeCompilerLocation(error.loc) : undefined,
      `Could not parse a gt-vue template: ${error.message}`,
      'Fix the Vue template syntax before extracting translations'
    );
  }
  return undefined;
}

type ExtractionLocationLike = Parameters<typeof normalizeCompilerLocation>[0];
type CompilerPosition = {
  column: number;
  line: number;
  offset: number;
};

/** Omits location-only metadata while comparing persisted template content. */
function comparableTemplateResults(
  results: VueExtractionOutput['results']
): string {
  return JSON.stringify(
    results.map((result) => ({
      dataFormat: result.dataFormat,
      context: result.metadata.context,
      source: result.source,
    }))
  );
}

function collectScriptBlockImports(
  block: SFCBlock | null,
  scriptAnalysis: VueScriptAnalysis
): void {
  if (!block || block.src || !isSupportedScriptLanguage(block.lang)) return;
  collectVueScriptImports(block.content, block.lang, scriptAnalysis);
}

function parseScriptBlock(
  block: SFCBlock | null,
  exposeToTemplate: boolean,
  context: VueExtractionContext,
  bindings: TemplateBindings,
  scriptAnalysis: VueScriptAnalysis
): boolean {
  if (!block) return true;
  if (block.src) {
    addVueError(
      context,
      block.loc,
      'Found an externally sourced Vue script block',
      'Keep translation calls and gt-vue imports in the .vue file'
    );
    return false;
  }
  if (!isSupportedScriptLanguage(block.lang)) {
    addVueError(
      context,
      block.loc,
      `Found unsupported Vue script language "${block.lang}"`,
      'Use JavaScript or TypeScript for gt-vue extraction'
    );
    return false;
  }

  return parseVueScript(
    block.content,
    block.lang,
    context,
    bindings,
    exposeToTemplate,
    scriptAnalysis
  );
}

function createTemplateBindings(): TemplateBindings {
  return {
    arrayLengths: new Map(),
    componentFactories: new Set(),
    components: new Map(),
    containerKinds: new Map(),
    possibleGTContainers: new Set(),
    gtContainerFactories: new Set(),
    directBindings: new Set(),
    registeredComponents: new Map(),
    registeredVueBuiltins: new Map(),
    staticValues: new Map(),
    identityFunctions: new Set(),
    possibleStaticStrings: new Map(),
    stringFunctions: new Map(),
    uncertainStringFunctions: new Set(),
    uncertainComponents: new Set(),
    uncertainGTComponents: new Set(),
    gtComponentFactories: new Set(),
    uncertainRegisteredComponents: new Set(),
    uncertainRegisteredGTComponents: new Set(),
    vueBuiltins: new Map(),
  };
}

function sourceUsesTypeScript(source: string): boolean {
  let offset = 0;
  while (offset < source.length) {
    const start = source.indexOf('<script', offset);
    if (start === -1) return false;
    const boundary = source[start + '<script'.length];
    if (boundary !== '>' && !boundary?.match(/\s/)) {
      offset = start + '<script'.length;
      continue;
    }

    const end = findOpeningTagEnd(source, start + '<script'.length);
    if (end === -1) return false;
    const language = readOpeningTagAttribute(
      source.slice(start + '<script'.length, end),
      'lang'
    );
    if (typeof language === 'string' && /^tsx?$/i.test(language)) return true;
    offset = end + 1;
  }
  return false;
}

function isSupportedScriptLanguage(language: string | undefined): boolean {
  const normalizedLanguage = language?.toLowerCase();
  return (
    normalizedLanguage === undefined ||
    normalizedLanguage === 'js' ||
    normalizedLanguage === 'jsx' ||
    normalizedLanguage === 'ts' ||
    normalizedLanguage === 'tsx'
  );
}

/** Finds an opening tag boundary while respecting quoted attribute values. */
function findOpeningTagEnd(source: string, start: number): number {
  let quote: '"' | "'" | undefined;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote) quote = undefined;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '>') {
      return index;
    }
  }
  return -1;
}

/** Reads one case-sensitive SFC attribute with quoted or unquoted syntax. */
function readOpeningTagAttribute(
  attributes: string,
  requestedName: string
): string | true | undefined {
  let offset = 0;
  while (offset < attributes.length) {
    while (offset < attributes.length && /\s/.test(attributes[offset])) {
      offset += 1;
    }
    if (attributes[offset] === '/') {
      offset += 1;
      continue;
    }
    const nameStart = offset;
    while (offset < attributes.length && !/[\s=]/.test(attributes[offset])) {
      offset += 1;
    }
    const name = attributes.slice(nameStart, offset);
    if (!name) break;

    while (offset < attributes.length && /\s/.test(attributes[offset])) {
      offset += 1;
    }
    let value: string | true = true;
    if (attributes[offset] === '=') {
      offset += 1;
      while (offset < attributes.length && /\s/.test(attributes[offset])) {
        offset += 1;
      }
      const quote = attributes[offset];
      if (quote === '"' || quote === "'") {
        offset += 1;
        const valueStart = offset;
        while (offset < attributes.length && attributes[offset] !== quote) {
          offset += 1;
        }
        value = attributes.slice(valueStart, offset);
        if (attributes[offset] === quote) offset += 1;
      } else {
        const valueStart = offset;
        while (offset < attributes.length && !/\s/.test(attributes[offset])) {
          offset += 1;
        }
        value = attributes.slice(valueStart, offset);
      }
    }
    if (name === requestedName) return value;
  }
  return undefined;
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
