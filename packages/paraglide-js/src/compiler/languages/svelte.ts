import type { EncodedSourceMap } from '@jridgewell/trace-mapping';
import type * as Svelte2Tsx from 'svelte2tsx';
import type * as SvelteCompiler from 'svelte/compiler';
import type { SourceLanguage } from './language.js';
import { mappingsFromSourceMap } from './mapping.js';
import { parseSkippingUnparsable } from './recover.js';
import { parseComponent, propDeclarationOffsets } from './svelte/component.js';

/** Svelte components, read by `svelte2tsx` with the project's own Svelte (3, 4 or 5). */
export const svelteLanguage: SourceLanguage = {
  name: 'svelte',
  extensions: ['.svelte'],
  requires: ['svelte2tsx', 'svelte'],
  installedWith: { svelte2tsx: 'svelte-check' },
  async generate(source, file, context) {
    const [tools, compiler] = await Promise.all([
      context.load<typeof Svelte2Tsx>('svelte2tsx'),
      context.load<typeof SvelteCompiler>('svelte/compiler'),
    ]);
    if (!tools?.svelte2tsx || !compiler?.parse) return undefined;

    const ast = parseComponent(compiler, source);
    const { code, map } = convertToTsx(tools, compiler, source, file);

    // svelte2tsx types the map's `version` as a number.
    const mappings = mappingsFromSourceMap(
      map as EncodedSourceMap,
      code,
      source
    );

    const recovered = parseSkippingUnparsable(file, code, 'ts', mappings, {
      skipCopiedText: true,
    });

    return {
      code: recovered.code,
      lang: 'ts',
      mappings,
      props: { calls: ['$props'], variables: propDeclarationOffsets(ast) },
      // `const $$_C = __sveltets_2_ensureComponent(C); new $$_C({ target, props: { … } })`
      componentInstances: { via: 'new', path: ['props'] },
    };
  },
};

function convertToTsx(
  tools: typeof Svelte2Tsx,
  compiler: typeof SvelteCompiler,
  source: string,
  file: string
) {
  return tools.svelte2tsx(source, {
    filename: file,
    // Also for JavaScript components: the analysis reads TypeScript either way.
    isTsFile: true,
    mode: 'ts',
    parse: compiler.parse,
    version: compiler.VERSION,
    // A template expression with a syntax error is copied as it is, and skipped afterwards.
    emitOnTemplateError: true,
  });
}
