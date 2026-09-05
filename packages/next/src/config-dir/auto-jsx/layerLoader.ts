import path from 'path';
import {
  createGtNextPluginDiagnostic,
  formatDiagnosticErrorDetails,
} from '../../errors/diagnostics';

type LoaderCallback = (
  error: Error | null,
  source?: string,
  sourceMap?: unknown,
  metadata?: unknown
) => void;

type LayerLoaderContext = {
  context: string;
  rootContext: string;
  resourcePath: string;
  async: () => LoaderCallback;
  getResolve: (
    options: Record<string, never>
  ) => (
    directory: string,
    request: string,
    callback: (error: Error | null, resolved?: string | false) => void
  ) => void;
};

/** Attach the actual graph's JSX default before the SWC auto-insertion pass. */
export function autoJsxLayerLoader(
  this: LayerLoaderContext,
  source: string,
  sourceMap?: unknown,
  metadata?: unknown
) {
  const callback = this.async();
  this.getResolve({})(this.rootContext, 'gt-next', (error, resolved) => {
    const entry = resolved && path.basename(resolved);
    if (
      error ||
      !entry ||
      !/^index\.(?:rsc|server|client)\.(?:mjs|js)$/.test(entry)
    ) {
      callback(
        new Error(
          createGtNextPluginDiagnostic({
            severity: 'Error',
            whatHappened:
              'The JSX runtime for this module could not be determined',
            why: 'Automatic JSX injection with Emotion needs the current React server condition',
            fix: 'Make sure gt-next resolves to its installed package entry points',
            details: [
              this.resourcePath,
              error ? formatDiagnosticErrorDetails(error) : String(resolved),
            ].filter((detail): detail is string => detail !== undefined),
          })
        )
      );
      return;
    }
    const importSource = entry.startsWith('index.rsc.')
      ? 'react'
      : '@emotion/react';
    // Append so directives, shebangs, comments and existing source offsets stay
    // intact. SWC consumes this exact marker and its separator before any pass.
    callback(
      null,
      `${source}\n;\n"__GT_AUTO_JSX_IMPORT_SOURCE__:${importSource}";\n`,
      sourceMap,
      metadata
    );
  });
}
