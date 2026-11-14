import type {
  NativeGeneratedCode,
  NativeGeneratedSource,
} from '../analysis/native.js';
import {
  generateSource,
  NO_PACKAGES,
  type GeneratedFile,
  type GeneratedScript,
  type LanguageContext,
  type ParseFailure,
  type SourceLanguage,
} from './language.js';
/** What a language of the caller's, which runs in JavaScript, wrote for a file. */
export type ToolingResult =
  | { type: 'unclaimed' }
  | { type: 'failed'; failure: ParseFailure }
  | { type: 'generated'; source: NativeGeneratedSource };

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
