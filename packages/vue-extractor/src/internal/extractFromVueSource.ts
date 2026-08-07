import { extname } from 'node:path';
import {
  init as initModuleLexer,
  parse as parseModuleImports,
} from 'es-module-lexer';
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
import { parseScriptAst } from './script/parser.js';
import {
  shiftCompilerAstLocations,
  shiftCompilerLocation,
} from './compilerAst.js';
import {
  createLocalModuleResolver,
  type LocalModuleResolver,
} from './script/localModules.js';
import { parseVueTemplate } from './template.js';
import type { TemplateBindings, VueExtractionContext } from './types.js';
import { addVueError, createVueExtractionContext } from './utils.js';
import {
  inspectVueCompiler,
  resolveVueCompiler,
  type ResolvedVueCompiler,
} from './vueCompiler.js';

const DEFAULT_SURROUNDING_LINE_COUNT = 5;
const MAX_MALFORMED_SUFFIX_RECOVERIES = 64;

/**
 * Extracts General Translation content from one Vue SFC or JavaScript file.
 *
 * This low-level API lets callers parse an individual in-memory source file.
 * Use `@generaltranslation/vue-extractor/project` when discovery, I/O,
 * compiler configuration, hashing, and deduplication should be handled by the
 * package as one project-level operation.
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
    if (
      options.requireGTProvenance &&
      !(await hasStandaloneGTProvenance(sourceCode, filePath, options))
    ) {
      return { results, errors, warnings: [...warnings] };
    }
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

/**
 * Uses the declared language, then permissive TSX and Flow, to prove gt-vue
 * ownership without changing the grammar used for extraction.
 *
 * The normal extraction pass still parses the file according to its extension.
 * Diagnostics caused only by GT-shaped names do not establish ownership. This
 * keeps mixed-framework dispatch from making otherwise valid React files fatal.
 */
async function hasStandaloneGTProvenance(
  sourceCode: string,
  filePath: string,
  options: VueExtractionOptions
): Promise<boolean> {
  const extension = extname(filePath).toLowerCase();
  const probeLanguages = new Set<StandaloneProbeLanguage>([
    languageFromExtension(extension),
    'tsx',
    'flow',
  ]);
  const localModules = createLocalModuleResolver(options.resolveModule);
  for (const language of probeLanguages) {
    const probe = probeStandaloneGTProvenance(
      sourceCode,
      filePath,
      options,
      language,
      localModules
    );
    if (probe.hasProvenance) return true;
    if (probe.parsed) return false;
  }
  const suffixSelection = selectMalformedSuffixLanguage(
    sourceCode,
    probeLanguages
  );
  const moduleRecovery = suffixSelection?.recoverable
    ? await recoverMalformedModuleReferences(
        sourceCode,
        filePath,
        options,
        probeLanguages,
        localModules
      )
    : { hasProvenance: false, preamble: '' };
  if (moduleRecovery.hasProvenance) {
    return true;
  }
  return hasMalformedStandaloneGTProvenance(
    sourceCode,
    filePath,
    options,
    probeLanguages,
    localModules,
    moduleRecovery.preamble
  );
}

/**
 * Recovers static module ownership without reparsing an entire malformed file.
 *
 * es-module-lexer ignores comments and literal contents while continuing past
 * unrelated syntax errors. Each declaration is then analyzed on its own,
 * preserving type-only and binding-specific local-barrel semantics. Parseable
 * declarations are also returned as a preamble for later recovered uses.
 */
async function recoverMalformedModuleReferences(
  sourceCode: string,
  filePath: string,
  options: VueExtractionOptions,
  languages: ReadonlySet<StandaloneProbeLanguage>,
  localModules: LocalModuleResolver
): Promise<{ hasProvenance: boolean; preamble: string }> {
  await initModuleLexer;
  let imports: ReturnType<typeof parseModuleImports>[0];
  try {
    [imports] = parseModuleImports(sourceCode);
  } catch {
    imports = [];
  }

  const declarations = new Set<string>();
  for (const moduleImport of imports) {
    if (!moduleImport.n) continue;
    for (const declaration of readModuleStatementCandidates(
      sourceCode,
      moduleImport.ss,
      moduleImport.se
    )) {
      for (const language of languages) {
        const probe = probeStandaloneGTProvenance(
          declaration,
          filePath,
          options,
          language,
          localModules
        );
        if (probe.hasProvenance) {
          return { hasProvenance: true, preamble: '' };
        }
        if (probe.parsed) {
          declarations.add(declaration);
          break;
        }
      }
      if (declarations.has(declaration)) break;
    }
  }
  return {
    hasProvenance: false,
    preamble: [...declarations].join('\n'),
  };
}

/** Returns small statement slices enclosing one lexed module reference. */
function readModuleStatementCandidates(
  sourceCode: string,
  statementStart: number,
  specifierEnd: number
): string[] {
  const precedingBoundaries = [';', '\n', '{', '}']
    .map((separator) => sourceCode.lastIndexOf(separator, statementStart - 1))
    .filter((offset) => offset >= 0)
    .map((offset) => offset + 1);
  precedingBoundaries.push(0);
  const followingBoundaries = [';', '\n', '}']
    .map((separator) => sourceCode.indexOf(separator, specifierEnd))
    .filter((offset) => offset >= 0)
    .map((offset) => offset + 1);
  const starts = [
    ...precedingBoundaries.sort((left, right) => right - left),
    statementStart,
  ];
  const ends = [
    ...followingBoundaries.sort((left, right) => left - right),
    specifierEnd,
  ];
  const candidates = new Set<string>();
  for (const start of starts) {
    for (const end of ends) {
      if (end <= start) continue;
      const candidate = sourceCode.slice(start, end).trim();
      if (candidate) candidates.add(candidate);
    }
  }
  return [...candidates];
}

type StandaloneProbeLanguage = 'flow' | 'js' | 'jsx' | 'ts' | 'tsx';

/** Runs one syntax-tolerant, read-only provenance classification pass. */
function probeStandaloneGTProvenance(
  sourceCode: string,
  filePath: string,
  options: VueExtractionOptions,
  language: StandaloneProbeLanguage,
  localModules: LocalModuleResolver
): { hasProvenance: boolean; parsed: boolean } {
  const results: VueExtractionOutput['results'] = [];
  const errors: string[] = [];
  const warnings = new Set<string>();
  const projectRoot = options.projectRoot ?? process.cwd();
  const context = createVueExtractionContext(
    filePath,
    sourceCode,
    projectRoot,
    false,
    options.surroundingLineCount ?? DEFAULT_SURROUNDING_LINE_COUNT,
    results,
    errors,
    warnings
  );
  const analysis = createVueScriptAnalysis();
  analysis.entryFile = filePath;
  analysis.localModules = localModules;
  const parsed = parseVueScript(
    sourceCode,
    language,
    context,
    createTemplateBindings(),
    false,
    analysis,
    false
  );
  if (results.length > 0 || analysisHasGTProvenance(analysis)) {
    return { hasProvenance: true, parsed };
  }
  return { hasProvenance: false, parsed };
}

/**
 * Finds concrete module references when malformed syntax prevents a full AST.
 *
 * Each supported grammar recovers a complete prefix, then the grammar that
 * parsed furthest gets a bounded suffix search. Unterminated literal errors
 * never receive suffix recovery, so literal contents cannot become code.
 */
function hasMalformedStandaloneGTProvenance(
  sourceCode: string,
  filePath: string,
  options: VueExtractionOptions,
  languages: ReadonlySet<StandaloneProbeLanguage>,
  localModules: LocalModuleResolver,
  recoveredPreamble: string
): boolean {
  for (const language of languages) {
    if (
      leadingStatementPrefixHasGTProvenance(
        sourceCode,
        filePath,
        options,
        language,
        localModules
      )
    ) {
      return true;
    }
  }
  const suffixSelection = selectMalformedSuffixLanguage(sourceCode, languages);
  return Boolean(
    suffixSelection?.recoverable &&
    malformedSuffixHasGTProvenance(
      sourceCode,
      filePath,
      options,
      suffixSelection.language,
      localModules,
      recoveredPreamble
    )
  );
}

/** Preserves CommonJS and TypeScript import ownership before a syntax error. */
function leadingStatementPrefixHasGTProvenance(
  sourceCode: string,
  filePath: string,
  options: VueExtractionOptions,
  language: StandaloneProbeLanguage,
  localModules: LocalModuleResolver
): boolean {
  let errorOffset: number;
  try {
    parseScriptAst(sourceCode, language);
    return false;
  } catch (error) {
    const offset = (error as { pos?: unknown }).pos;
    if (typeof offset !== 'number') return false;
    errorOffset = offset;
  }
  const boundary = Math.max(
    sourceCode.lastIndexOf(';', errorOffset - 1) + 1,
    sourceCode.lastIndexOf('\n', errorOffset - 1) + 1,
    sourceCode.lastIndexOf('}', errorOffset - 1) + 1
  );
  if (boundary <= 0) return false;
  const prefix = sourceCode.slice(0, boundary).trimEnd();
  if (!prefix) return false;
  const probe = probeStandaloneGTProvenance(
    prefix,
    filePath,
    options,
    language,
    localModules
  );
  return probe.hasProvenance;
}

/** Recovers later imports and CommonJS calls after a bounded number of errors. */
function malformedSuffixHasGTProvenance(
  sourceCode: string,
  filePath: string,
  options: VueExtractionOptions,
  language: StandaloneProbeLanguage,
  localModules: LocalModuleResolver,
  recoveredPreamble: string
): boolean {
  let remaining = sourceCode;
  for (let attempt = 0; attempt < MAX_MALFORMED_SUFFIX_RECOVERIES; attempt++) {
    let errorOffset: number;
    try {
      parseScriptAst(remaining, language);
      const recoveredSource = recoveredPreamble
        ? `${recoveredPreamble}\n${remaining}`
        : remaining;
      const recoveredProbe = probeStandaloneGTProvenance(
        recoveredSource,
        filePath,
        options,
        language,
        localModules
      );
      if (recoveredProbe.parsed) return recoveredProbe.hasProvenance;
      // The remaining suffix may already contain the declaration retained in
      // the preamble. Probe it alone to avoid a duplicate-binding parse error.
      return probeStandaloneGTProvenance(
        remaining,
        filePath,
        options,
        language,
        localModules
      ).hasProvenance;
    } catch (error) {
      const parseError = readRecoverableParseError(error);
      if (!parseError) return false;
      errorOffset = parseError.offset;
    }
    const boundary = findMalformedRecoveryBoundary(remaining, errorOffset);
    if (boundary <= 0 || boundary >= remaining.length) return false;
    remaining = remaining.slice(boundary);
    const recoveredSource = recoveredPreamble
      ? `${recoveredPreamble}\n${remaining}`
      : remaining;
    let probe = probeStandaloneGTProvenance(
      recoveredSource,
      filePath,
      options,
      language,
      localModules
    );
    if (!probe.parsed && recoveredPreamble) {
      const trimmedRemaining = trimTrailingRecoveryClosers(remaining);
      if (trimmedRemaining !== remaining) {
        probe = probeStandaloneGTProvenance(
          `${recoveredPreamble}\n${trimmedRemaining}`,
          filePath,
          options,
          language,
          localModules
        );
      }
    }
    if (probe.hasProvenance) return true;
    if (probe.parsed) return false;
  }
  return false;
}

/** Removes block closers orphaned when recovery starts inside a function. */
function trimTrailingRecoveryClosers(sourceCode: string): string {
  return sourceCode.replace(/(?:\s*\}\s*)+$/u, '').trimEnd();
}

/** Chooses the grammar that parsed furthest before a recoverable error. */
function selectMalformedSuffixLanguage(
  sourceCode: string,
  languages: ReadonlySet<StandaloneProbeLanguage>
): { language: StandaloneProbeLanguage; recoverable: boolean } | undefined {
  let selected:
    | { language: StandaloneProbeLanguage; recoverable: boolean }
    | undefined;
  let furthestOffset = -1;
  for (const language of languages) {
    try {
      parseScriptAst(sourceCode, language);
    } catch (error) {
      const parseError = readParseError(error);
      if (parseError && parseError.offset > furthestOffset) {
        selected = {
          language,
          recoverable: parseError.recoverable,
        };
        furthestOffset = parseError.offset;
      }
    }
  }
  return selected;
}

/** Rejects recovery that could reinterpret unterminated literal contents. */
function readRecoverableParseError(
  error: unknown
): { offset: number } | undefined {
  const parsed = readParseError(error);
  return parsed?.recoverable ? { offset: parsed.offset } : undefined;
}

/** Reads one Babel parser error without trusting unterminated literal state. */
function readParseError(
  error: unknown
): { offset: number; recoverable: boolean } | undefined {
  const parsed = error as { pos?: unknown; reasonCode?: unknown };
  if (typeof parsed.pos !== 'number') return undefined;
  const unsafeReasonCodes = new Set([
    'UnterminatedComment',
    'UnterminatedJsxContent',
    'UnterminatedRegExp',
    'UnterminatedString',
    'UnterminatedTemplate',
  ]);
  return {
    offset: parsed.pos,
    recoverable:
      typeof parsed.reasonCode !== 'string' ||
      !unsafeReasonCodes.has(parsed.reasonCode),
  };
}

/** Selects the first statement-like boundary after a parser error. */
function findMalformedRecoveryBoundary(
  sourceCode: string,
  errorOffset: number
): number {
  const candidates = [';', '\n', '}']
    .map((separator) => sourceCode.indexOf(separator, errorOffset))
    .filter((offset) => offset >= 0);
  return candidates.length > 0 ? Math.min(...candidates) + 1 : -1;
}

/** Returns whether permissive analysis reached a concrete gt-vue identity. */
function analysisHasGTProvenance(analysis: VueScriptAnalysis): boolean {
  return analysis.hasGTSourceReference;
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

function languageFromExtension(
  extension: string
): Exclude<StandaloneProbeLanguage, 'flow'> {
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
