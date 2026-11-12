import type * as Astro2Tsx from '@astrojs/astro2tsx';
import type * as AstroCompiler from '@astrojs/compiler';
import type { EncodedSourceMap } from '@jridgewell/trace-mapping';
import { jsxElements } from './jsx-elements.js';
import type {
  GeneratedScript,
  LanguageContext,
  SourceLanguage,
} from './language.js';
import { mappingsFromSourceMap, type Mapping } from './mapping.js';
import { parseSkippingUnparsable } from './recover.js';

type BundledScript = { start: number; content: string };

type Tsx = {
  code: string;
  mappings: Mapping[];
  /** The scripts Astro bundles, which the TSX does not contain. */
  bundledScripts: BundledScript[];
};

const BUNDLED_SCRIPT = 'processed-module';

/**
 * `.astro` components, through `@astrojs/astro2tsx` (Astro 7), else
 * `@astrojs/compiler` (Astro 6 and older).
 */
export const astroLanguage: SourceLanguage = {
  name: 'astro',
  extensions: ['.astro'],
  requires: ['@astrojs/astro2tsx'],
  installedWith: { '@astrojs/astro2tsx': '@astrojs/check' },
  async generate(source, file, context) {
    const tsx =
      (await convertWithAstro2Tsx(source, file, context)) ??
      (await convertWithCompiler(source, file, context));
    if (!tsx) return undefined;

    const { mappings } = tsx;
    const { code } = parseSkippingUnparsable(file, tsx.code, 'tsx', mappings, {
      skipCopiedText: true,
    });
    const elements = jsxElements(file, code, 'tsx', mappings, source);

    return {
      code,
      lang: 'tsx',
      mappings,
      elements,
      props: { members: ['Astro.props'] },
      scripts: tsx.bundledScripts.map((script) => clientScript(file, script)),
    };
  },
};

async function convertWithAstro2Tsx(
  source: string,
  file: string,
  context: LanguageContext
): Promise<Tsx | undefined> {
  const tool = await context.load<typeof Astro2Tsx>('@astrojs/astro2tsx');
  if (!tool?.convertToTsx) return undefined;

  const tsx = tool.convertToTsx(source, { filename: file });

  const mappings = tsx.mappings
    // Wrappers the tool inserted stand for no source text.
    .filter(([, length, , sourceLength]) => length > 0 && sourceLength > 0)
    .map(([generated, length, source, sourceLength]) => ({
      generated,
      length,
      source,
      sourceLength,
    }));

  const bundledScripts = tsx.scripts
    .filter((script) => script.type === BUNDLED_SCRIPT)
    .map((script) => ({
      start: script.position.start,
      content: script.content,
    }));

  return { code: tsx.code, mappings, bundledScripts };
}

async function convertWithCompiler(
  source: string,
  file: string,
  context: LanguageContext
): Promise<Tsx | undefined> {
  const compiler =
    await context.load<typeof AstroCompiler>('@astrojs/compiler');
  if (!compiler?.convertToTSX) return undefined;

  const tsx = await compiler.convertToTSX(source, {
    filename: file,
    // In the TSX, a script would be wrapped in a function.
    includeScripts: false,
    includeStyles: false,
  });

  const error = tsx.diagnostics.find((diagnostic) => diagnostic.severity === 1);
  if (error) throw new Error(error.text);

  const code = tsx.code.replace(/\n\/\/# sourceMappingURL=.*$/s, '\n');

  const bundledScripts = (tsx.metaRanges.scripts ?? []).flatMap((script) => {
    if (script.type !== BUNDLED_SCRIPT) return [];

    const start = scriptStart(source, script.position.start, script.content);

    return start === undefined ? [] : [{ start, content: script.content }];
  });

  // The compiler types the map's `version` as a number.
  const mappings = mappingsFromSourceMap(
    tsx.map as EncodedSourceMap,
    code,
    source
  );

  return { code, mappings, bundledScripts };
}

/**
 * A bundled script is a module of its own, in the browser: its `m` is not the
 * frontmatter's, nor another script's. One that does not parse is skipped.
 */
function clientScript(file: string, script: BundledScript): GeneratedScript {
  const lang = 'ts';
  const mappings = [
    { generated: 0, source: script.start, length: script.content.length },
  ];
  const { code } = parseSkippingUnparsable(
    file,
    script.content,
    lang,
    mappings,
    { skipCopiedText: true }
  );

  return { code, lang, mappings };
}

/** `@astrojs/compiler` reports positions in UTF-8 bytes, not string offsets. */
function scriptStart(
  source: string,
  bytePosition: number,
  content: string
): number | undefined {
  if (source.startsWith(content, bytePosition)) return bytePosition;

  const offset = Buffer.from(source)
    .subarray(0, bytePosition)
    .toString('utf8').length;
  if (source.startsWith(content, offset)) return offset;

  const firstOccurrence = source.indexOf(content);

  return firstOccurrence === -1 ? undefined : firstOccurrence;
}
