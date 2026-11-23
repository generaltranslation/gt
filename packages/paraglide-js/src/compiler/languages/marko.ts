import path from 'node:path';
import type * as MarkoCompiler from '@marko/compiler';
import type * as MarkoTools from '@marko/language-tools';
import type { SourceLanguage } from './language.js';
import type { Mapping } from './mapping.js';

type Tools = typeof MarkoTools;

let hasDefaultCompiler = false;

/**
 * Marko templates, through `@marko/language-tools`: `extractScript` writes the
 * template as TypeScript, with tag variables hoisted as Marko scopes them.
 */
export const markoLanguage: SourceLanguage = {
  name: 'marko',
  extensions: ['.marko'],
  requires: ['@marko/language-tools', '@marko/compiler'],
  async generate(source, file, context) {
    const [tools, compiler] = await Promise.all([
      context.load<Tools>('@marko/language-tools'),
      context.load<typeof MarkoCompiler>('@marko/compiler'),
    ]);
    if (!tools || !compiler) return undefined;

    const directory = path.dirname(file);
    const lookup = tagLookup(tools, compiler, directory);
    const parsed = tools.parse(source, file);

    const scriptLang = tools.ScriptLang.ts;
    const { translator } = tools.Project.getConfig(directory);
    const extracted = tools.extractScript({
      parsed,
      lookup,
      scriptLang,
      translator,
    });

    const code = extracted.toString();
    const mappings = copyMappings(code, (offset) =>
      extracted.sourceOffsetAt(offset)
    );

    return { code, lang: 'ts', mappings };
  },
};

/**
 * The project's tags, from the `@marko/compiler` and translator installed next
 * to the file. A file with none there (outside the project) still gets the core
 * tags, from a default compiler that has no translator.
 */
function tagLookup(
  tools: Tools,
  compiler: typeof MarkoCompiler,
  directory: string
) {
  try {
    return tools.Project.getTagLookup(directory);
  } catch (error) {
    if (hasDefaultCompiler) throw error;

    hasDefaultCompiler = true;
    tools.Project.setDefaultCompilerMeta(compiler, {
      translator: { taglibs: [] },
    });

    return tools.Project.getTagLookup(directory);
  }
}

/** The tooling maps one offset at a time: runs of consecutive offsets are copies. */
function copyMappings(
  code: string,
  sourceOffsetAt: (offset: number) => number | undefined
): Mapping[] {
  const mappings: Mapping[] = [];
  let current: Mapping | undefined;

  for (let offset = 0; offset < code.length; offset++) {
    const source = sourceOffsetAt(offset);

    if (source === undefined) {
      current = undefined;
    } else if (current && source === current.source + current.length) {
      current.length++;
    } else {
      current = { generated: offset, source, length: 1 };
      mappings.push(current);
    }
  }

  return mappings;
}
