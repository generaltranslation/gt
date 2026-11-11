export type TargetFile = {
  /** Absolute, with forward slashes. */
  file: string;
  /** The Paraglide outdir containing the file, absolute, with forward slashes. */
  outdir: string | undefined;
  /** Relative to `outdir`, e.g. "messages.js". */
  outdirPath: string | undefined;
};

export type SymbolSpec =
  | { type: 'namespace'; member(name: string): SymbolSpec | undefined }
  | {
      type: 'value';
      name: string;
      /** Methods whose calls also count, e.g. `.parts()` on messages. */
      methods?: readonly string[];
    };

/** Defines which resolved files belong to Paraglide and what their exports are. */
export type ParaglideTarget = {
  name: string;
  matches(file: TargetFile): boolean;
  /** Return undefined to not track an export. */
  exportSymbol(exportName: string, file: TargetFile): SymbolSpec | undefined;
};

export function defineTarget(target: ParaglideTarget): ParaglideTarget {
  return target;
}

/** A file in outdir whose every export is tracked, e.g. "runtime.js". */
export function generatedFileTarget(
  name: string,
  outdirPath: string
): ParaglideTarget {
  return {
    name,
    matches: (file) => file.outdirPath === outdirPath,
    exportSymbol: (exportName) => ({ type: 'value', name: exportName }),
  };
}

/** An installed package whose named exports are tracked. */
export function packageTarget(
  name: string,
  packageName: string
): ParaglideTarget {
  const segment = `/node_modules/${packageName}/`;
  return {
    name,
    matches: (file) => file.file.includes(segment),
    exportSymbol: (exportName) =>
      exportName === 'default'
        ? undefined
        : { type: 'value', name: exportName },
  };
}

const createMessageExportSymbol = (id: string): SymbolSpec => ({
  type: 'value',
  name: id,
  methods: ['parts'],
});

/** `messages.js` (with the `m` namespace) and every module in `messages/`. */
export const messagesTarget: ParaglideTarget = {
  name: 'message',
  matches: ({ outdirPath = '' }) =>
    outdirPath === 'messages.js' ||
    (outdirPath.startsWith('messages/') && outdirPath.endsWith('.js')),
  exportSymbol: (exportName, file) =>
    file.outdirPath === 'messages.js' && exportName === 'm'
      ? { type: 'namespace', member: createMessageExportSymbol }
      : createMessageExportSymbol(exportName),
};

export const runtimeTarget = generatedFileTarget('runtime', 'runtime.js');
export const serverTarget = generatedFileTarget('server', 'server.js');
export const registryTarget = generatedFileTarget('registry', 'registry.js');

/**
 * Paraglide's official framework adapters: their components and helpers, e.g.
 * `<Message message={m.tos} />`. Paraglide 2 and 3: `@inlang/paraglide-js-*`;
 * Paraglide 1: the SvelteKit, Next.js and Astro adapters.
 */
export const adapterTargets: readonly ParaglideTarget[] = [
  '@inlang/paraglide-js-react',
  '@inlang/paraglide-js-solid',
  '@inlang/paraglide-js-svelte',
  '@inlang/paraglide-js-vue',
  '@inlang/paraglide-sveltekit',
  '@inlang/paraglide-next',
  '@inlang/paraglide-astro',
].map((packageName) => packageTarget(packageName, packageName));

export const defaultTargets: readonly ParaglideTarget[] = [
  messagesTarget,
  runtimeTarget,
  serverTarget,
  registryTarget,
  ...adapterTargets,
];
