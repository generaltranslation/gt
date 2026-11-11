import path from 'node:path';
import type { ESTree } from '../analysis/ast.js';
import type { ParsedModule } from '../analysis/module-graph.js';
import { isScript } from '../utils/paths.js';
import type { SourceElement } from './elements.js';
import { remapProgram, type Mapping } from './mapping.js';
import {
  mayHaveTaggedTemplates,
  taggedTemplateElements,
} from './tagged-templates.js';

export type ParseLang = 'js' | 'jsx' | 'ts' | 'tsx';

type ParseError = {
  severity: string;
  message: string;
  labels?: ReadonlyArray<{ start: number }>;
};

/** e.g. oxc-parser's `parseSync` with `{ lang, range: true, astType: "ts" }`. */
export type ParseFunction = (
  file: string,
  code: string,
  lang: ParseLang
) => { program: ESTree.Program; errors: readonly ParseError[] };

/** A class whose fields a template reads undeclared, e.g. Angular's `{{ m.greeting() }}`. */
export type ComponentFields = {
  /** The module that declares the class, relative to this file; "" for this file. */
  specifier: string;
  /** Default: the decorated classes whose `templateUrl` names this file, else all of them. */
  className?: string;
};

/**
 * A component file as one JavaScript/TypeScript module, written by the
 * framework's own tooling. Code without a mapping never counts as a usage.
 */
export type GeneratedSource = {
  code: string;
  lang: ParseLang;
  mappings: readonly Mapping[];
  /** The file's markup. Without it, usages in generated JSX report the JSX's elements. */
  elements?: readonly SourceElement[];
  componentFields?: readonly ComponentFields[];
  /** Objects whose members resolve like names of the module, e.g. Vue's `__VLS_ctx.title`. */
  scopeObjects?: readonly string[];
  props?: PropsReads;
  /**
   * How the generated code renders imported components, besides JSX:
   * `new C(argument)` or `C(argument)`, where `C` may be a `const` of the import
   * or a call wrapping it. The props are at `path` in the argument.
   */
  componentInstances?: { via: 'new' | 'call'; path: readonly string[] };
};

/** Where a component reads the props its call sites pass. */
export type PropsReads = {
  /** Functions that return the props: Svelte's `$props`, Vue's `defineProps`. */
  calls?: readonly string[];
  /** Expressions that hold the props: `Astro.props`. */
  members?: readonly string[];
  /** Source offsets of variables that are the props of their name: Svelte 4's `export let`. */
  variables?: readonly number[];
  /** Names the module does not declare are props, as in Vue's templates. */
  undeclared?: boolean;
};

/** What a language can use besides the file itself. */
export type LanguageContext = {
  /** Imports a package installed in the project; undefined if it is not installed. */
  load<T = unknown>(specifier: string): Promise<T | undefined>;
};

export const NO_PACKAGES: LanguageContext = { load: async () => undefined };

/** A non-JavaScript file format, e.g. Vue components. */
export type SourceLanguage = {
  name: string;
  extensions: readonly string[];
  /** Required to claim script extensions, e.g. Angular components in `.ts` files. */
  detect?(source: string, file: string): boolean;
  /** The packages it needs in the project, named when one is missing. */
  requires?: readonly string[];
  /** The package that brings a required one: `@vue/language-core` comes with `vue-tsc`. */
  installedWith?: Readonly<Record<string, string>>;
  /**
   * The file as one module. Returns undefined when the tooling is not installed
   * and throws when it rejects the file; either way the file is skipped.
   */
  generate(
    source: string,
    file: string,
    context: LanguageContext
  ): GeneratedSource | undefined | Promise<GeneratedSource | undefined>;
};

/** Why a file was not analyzed. */
export type ParseFailure = {
  error: string;
  /** Set, with `missing`, when the language's tools are unavailable. */
  language?: string;
  missing?: readonly string[];
  /** Why an installed tool is unusable. */
  reason?: string;
};

type LanguageMatch = { language: SourceLanguage; extension: string };

/** Thrown by a language whose tool is installed but cannot be used; the file is skipped. */
export class UnusableToolError extends Error {
  override name = 'UnusableToolError';
}

export function typescriptWithoutApiError(neededBy: string): UnusableToolError {
  return new UnusableToolError(
    `the project's typescript has no JavaScript API (TypeScript 7), which ${neededBy} needs; it works with typescript 5 or 6`
  );
}

export function isSourceFile(
  file: string,
  languages: readonly SourceLanguage[]
): boolean {
  return (
    isScript(file) ||
    languages.some((language) => extensionOf(file, language) !== undefined)
  );
}

export async function parseSource(
  file: string,
  code: string,
  parse: ParseFunction,
  languages: readonly SourceLanguage[],
  context: LanguageContext = NO_PACKAGES
): Promise<{ module: ParsedModule } | ParseFailure> {
  const match = languageOf(file, code, languages);
  if (match) return parseWithLanguage(file, code, parse, match, context);

  if (isScript(file)) return parseScript(file, code, parse);

  const { program } = parse(file, '', 'js');

  return { module: { code, program } };
}

function languageOf(
  file: string,
  code: string,
  languages: readonly SourceLanguage[]
): LanguageMatch | undefined {
  for (const language of languages) {
    const extension = extensionOf(file, language);
    if (extension === undefined) continue;

    const isInLanguage = language.detect
      ? language.detect(code, file)
      : !isScript(file);
    if (isInLanguage) return { language, extension };
  }

  return undefined;
}

async function parseWithLanguage(
  file: string,
  code: string,
  parse: ParseFunction,
  { language, extension }: LanguageMatch,
  context: LanguageContext
): Promise<{ module: ParsedModule } | ParseFailure> {
  let generated: GeneratedSource | undefined;

  try {
    generated = await language.generate(code, file, context);
  } catch (error) {
    return generationFailure(language, error);
  }

  if (!generated) return missingToolsFailure(language);

  const { program, errors } = parse(file, generated.code, generated.lang);

  const error = firstError(errors);
  if (error) {
    return {
      error: `${language.name} tooling produced unparsable code: ${error.message}`,
    };
  }

  remapProgram(program, generated.mappings, generated.code.length);

  const component = path.basename(file, extension).replace(/\.component$/, '');

  return { module: generatedModule(code, program, component, generated) };
}

function generationFailure(
  language: SourceLanguage,
  error: unknown
): ParseFailure {
  const message = firstLine((error as Error).message);

  if (error instanceof UnusableToolError) {
    return {
      error: message,
      language: language.name,
      missing: [],
      reason: message,
    };
  }

  return { error: message };
}

function missingToolsFailure(language: SourceLanguage): ParseFailure {
  const missing = language.requires ?? [];

  return {
    error: `${language.name} files need ${missing.join(' and ')} in the project`,
    language: language.name,
    missing,
  };
}

function generatedModule(
  code: string,
  program: ESTree.Program,
  component: string,
  generated: GeneratedSource
): ParsedModule {
  return {
    code,
    program,
    component,
    generated: true,
    sourceElements: generated.elements,
    componentFields: generated.componentFields,
    scopeObjects: generated.scopeObjects,
    props: generated.props,
    componentInstances: generated.componentInstances,
  };
}

function parseScript(
  file: string,
  code: string,
  parse: ParseFunction
): { module: ParsedModule } | ParseFailure {
  const { program, errors } = parse(file, code, scriptLang(file));

  // The parser recovers from syntax errors: a program with errors may be incomplete.
  const error = firstError(errors);
  if (error) return { error: error.message };

  const elements = mayHaveTaggedTemplates(code)
    ? taggedTemplateElements(program, code)
    : [];
  const module =
    elements.length > 0 ? { code, program, elements } : { code, program };

  return { module };
}

function scriptLang(file: string): ParseLang {
  if (file.endsWith('.tsx')) return 'tsx';

  // `.js` often contains JSX.
  return /\.[cm]?ts$/.test(file) ? 'ts' : 'jsx';
}

function extensionOf(
  file: string,
  language: SourceLanguage
): string | undefined {
  const isDeclarationFile = /\.d\.[cm]?ts$/.test(file);
  if (isDeclarationFile) return undefined;

  return language.extensions.find((extension) => file.endsWith(extension));
}

function firstError(errors: readonly ParseError[]): ParseError | undefined {
  return errors.find((error) => error.severity === 'Error');
}

function firstLine(text: string): string {
  const lineEnd = text.indexOf('\n');

  return lineEnd === -1 ? text : text.slice(0, lineEnd);
}
