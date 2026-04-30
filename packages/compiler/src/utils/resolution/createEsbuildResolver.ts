import path from 'path';
import type { NativeResolver, ResolvedId } from './types';

interface EsbuildResolveResult {
  errors?: unknown[];
  external?: boolean;
  path?: string;
}

interface EsbuildResolveBuild {
  resolve(
    source: string,
    options: {
      resolveDir: string;
      importer: string;
      kind: 'import-statement';
    }
  ): Promise<EsbuildResolveResult>;
}

export function createEsbuildResolver(
  build: EsbuildResolveBuild
): NativeResolver {
  return async function resolveImport(source, importer) {
    if (!importer) return null;

    const result = await build.resolve(source, {
      resolveDir: path.dirname(importer),
      importer,
      kind: 'import-statement',
    });
    if (result.errors?.length) return null;
    if (result.external) {
      return {
        id: source,
        external: true,
      };
    }
    if (result.path) {
      return {
        id: result.path,
      } satisfies ResolvedId;
    }
    return null;
  };
}
