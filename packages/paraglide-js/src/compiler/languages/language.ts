import type { SourceRange } from '../analysis/types.js';
import { isScript } from '../utils/paths.js';
import type { Mapping } from './mapping.js';

export type ParseLang = 'js' | 'jsx' | 'ts' | 'tsx';

/** A class whose fields a template reads undeclared, e.g. Angular's `{{ m.greeting() }}`. */
export type ComponentFields = {
  /** The module that declares the class, relative to this file; "" for this file. */
  specifier: string;
  /** Default: the decorated classes whose `templateUrl` names this file, else all of them. */
  className?: string;
  /**
   * The part of this file that reads the fields, e.g. the class's inline
   * template: a file can hold several. Default: the whole file.
   */
  range?: SourceRange;
};

/**
 * A component file as one JavaScript/TypeScript module, written by the
 * framework's own tooling. Code without a mapping never counts as a usage.
 */
export type GeneratedSource = {
  code: string;
  lang: ParseLang;
  mappings: readonly Mapping[];
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
  /**
   * Modules of their own in the file, e.g. an Astro page's client scripts or a
   * page's `<script type="module">` tags: none shares names with another, or
   * with `code`.
   */
  scripts?: readonly GeneratedScript[];
};

export type GeneratedScript = Pick<
  GeneratedSource,
  'code' | 'lang' | 'mappings'
>;

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
  /**
   * Texts that every file `detect` accepts contains, e.g. "@Component". A file
   * without all of them is not the language's, and `detect` is not asked: it
   * spares reading every script in JavaScript.
   */
  mayContain?: readonly string[];
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

/** A file's language, and what its tooling wrote for the file. */
export type GeneratedFile = {
  language: SourceLanguage;
  generated: GeneratedSource;
};

/**
 * The file as its language's tooling writes it; undefined for a file that is
 * no language's, e.g. a script.
 */
export async function generateSource(
  file: string,
  code: string,
  languages: readonly SourceLanguage[],
  context: LanguageContext = NO_PACKAGES
): Promise<GeneratedFile | ParseFailure | undefined> {
  const language = languageOf(file, code, languages);
  if (!language) return undefined;

  let generated: GeneratedSource | undefined;

  try {
    generated = await language.generate(code, file, context);
  } catch (error) {
    return generationFailure(language, error);
  }

  if (!generated) return missingToolsFailure(language);

  return { language, generated };
}

/** The scripts a language may claim: `detect` decides, for the files that contain `mayContain`. */
export function detectedExtensions(
  languages: readonly SourceLanguage[]
): Array<{ extension: string; hints: string[] }> {
  return languages.flatMap((language) => {
    if (!language.detect) return [];

    return language.extensions
      .filter((extension) => isScript(`file${extension}`))
      .map((extension) => ({
        extension,
        hints: [...(language.mayContain ?? [])],
      }));
  });
}

function languageOf(
  file: string,
  code: string,
  languages: readonly SourceLanguage[]
): SourceLanguage | undefined {
  return languages.find((language) => {
    if (extensionOf(file, language) === undefined) return false;

    return language.detect ? language.detect(code, file) : !isScript(file);
  });
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

/** The extensions of the formats that are analyzed besides scripts, e.g. ".vue". */
export function languageExtensions(
  languages: readonly SourceLanguage[]
): string[] {
  return [...new Set(languages.flatMap((language) => language.extensions))];
}

function extensionOf(
  file: string,
  language: SourceLanguage
): string | undefined {
  const isDeclarationFile = /\.d\.[cm]?ts$/.test(file);
  if (isDeclarationFile) return undefined;

  return language.extensions.find((extension) => file.endsWith(extension));
}

function firstLine(text: string): string {
  const lineEnd = text.indexOf('\n');

  return lineEnd === -1 ? text : text.slice(0, lineEnd);
}
