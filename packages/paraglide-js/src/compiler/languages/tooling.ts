import type {
  NativeGeneratedCode,
  NativeGeneratedSource,
} from '../analysis/native.js';
import { projectPackages } from '../project/packages.js';
import { defaultLanguages } from './index.js';
import {
  generateSource,
  NO_PACKAGES,
  type GeneratedFile,
  type GeneratedScript,
  type LanguageContext,
  type ParseFailure,
  type SourceLanguage,
} from './language.js';
import type {
  ToolingRequest,
  ToolingResponse,
  ToolingWorkerData,
} from './tooling-pool.js';

/**
 * What a language's tooling made of a file, as the analysis takes it: data
 * only, so that a thread of its own can make it.
 */
export type ToolingResult =
  /** No language claims the file. */
  | { type: 'unclaimed' }
  | { type: 'failed'; failure: ParseFailure }
  | { type: 'generated'; source: NativeGeneratedSource };

/** Runs the tooling of the language that claims `file`, if one does. */
export async function runTooling(
  file: string,
  code: string,
  languages: readonly SourceLanguage[],
  packages: LanguageContext = NO_PACKAGES
): Promise<ToolingResult> {
  const generated = await generateSource(file, code, languages, packages);

  if (!generated) return { type: 'unclaimed' };
  if ('error' in generated) return { type: 'failed', failure: generated };

  return { type: 'generated', source: nativeSource(generated) };
}

/** What a thread of `ToolingPool` answers each request with. */
export function toolingHandler({
  languages,
  packagesRoot,
}: ToolingWorkerData): (request: ToolingRequest) => Promise<ToolingResponse> {
  const ownLanguages = languages.map((index) => defaultLanguages[index]!);
  const packages =
    packagesRoot === undefined ? NO_PACKAGES : projectPackages(packagesRoot);

  return async ({ id, file, code }) => {
    try {
      return {
        id,
        result: await runTooling(file, code, ownLanguages, packages),
      };
    } catch (error) {
      return { id, error: String(error) };
    }
  };
}

/** The buffers of a result, which a thread hands over rather than copies. */
export function transferables(result: ToolingResult): ArrayBuffer[] {
  if (result.type !== 'generated') return [];

  const { main, scripts } = result.source;

  return [main, ...scripts].map(
    ({ mappings }) => mappings.buffer as ArrayBuffer
  );
}

function nativeSource({
  language,
  generated,
}: GeneratedFile): NativeGeneratedSource {
  return {
    main: nativeCode(generated),
    scripts: (generated.scripts ?? []).map(nativeCode),
    language: language.name,
    componentFields: generated.componentFields?.map((fields) => ({
      specifier: fields.specifier,
      className: fields.className,
      start: fields.range?.start,
      end: fields.range?.end,
    })),
    scopeObjects: generated.scopeObjects && [...generated.scopeObjects],
    props: generated.props && {
      calls: generated.props.calls && [...generated.props.calls],
      members: generated.props.members && [...generated.props.members],
      variables: generated.props.variables && [...generated.props.variables],
      undeclared: generated.props.undeclared,
    },
    componentInstances: generated.componentInstances && {
      via: generated.componentInstances.via,
      path: [...generated.componentInstances.path],
    },
  };
}

function nativeCode({
  code,
  lang,
  mappings,
}: GeneratedScript): NativeGeneratedCode {
  const flat = new Int32Array(mappings.length * 4);

  mappings.forEach((mapping, index) => {
    flat[index * 4] = mapping.generated;
    flat[index * 4 + 1] = mapping.source;
    flat[index * 4 + 2] = mapping.length;
    flat[index * 4 + 3] = mapping.sourceLength ?? mapping.length;
  });

  return { code, lang, mappings: flat };
}
