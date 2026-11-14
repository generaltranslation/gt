import {
  native,
  type NativeGeneratedCode,
  type NativeGeneratedSource,
} from '../analysis/native.js';
import type {
  GeneratedScript,
  GeneratedSource,
  ParseLang,
  SourceLanguage,
} from './language.js';
import type { Mapping } from './mapping.js';

/**
 * A built-in language: the analysis writes its files itself, in Rust, with no
 * tooling of the framework's. `generate` returns what the analysis writes,
 * and throws when the file is not valid in the language.
 */
export function nativeLanguage(
  language: Omit<SourceLanguage, 'generate'>
): SourceLanguage {
  return {
    ...language,
    generate: (source, file) =>
      generatedSource(native.generateSource(file, source, language.name)),
  };
}

function generatedSource(source: NativeGeneratedSource): GeneratedSource {
  const { componentInstances, props } = source;

  return {
    ...generatedScript(source.main),
    scripts: source.scripts.map(generatedScript),
    componentFields: source.componentFields?.map((fields) => ({
      specifier: fields.specifier,
      className: fields.className ?? undefined,
      range:
        fields.start == null || fields.end == null
          ? undefined
          : { start: fields.start, end: fields.end },
    })),
    scopeObjects: source.scopeObjects ?? undefined,
    props: props && {
      calls: props.calls ?? undefined,
      members: props.members ?? undefined,
      variables: props.variables ?? undefined,
      undeclared: props.undeclared ?? undefined,
    },
    componentInstances: componentInstances && {
      via: componentInstances.via === 'new' ? 'new' : 'call',
      path: componentInstances.path,
    },
  };
}

function generatedScript({
  code,
  lang,
  mappings,
}: NativeGeneratedCode): GeneratedScript {
  const copies: Mapping[] = [];

  for (let index = 0; index < mappings.length; index += 4) {
    copies.push({
      generated: mappings[index]!,
      source: mappings[index + 1]!,
      length: mappings[index + 2]!,
      sourceLength: mappings[index + 3]!,
    });
  }

  return { code, lang: lang as ParseLang, mappings: copies };
}
