import path from 'path';
import type { WebpackCompiler } from 'unplugin';
import type { NativeResolver } from './types';

export function createWebpackResolver(
  compiler: WebpackCompiler
): NativeResolver {
  const webpackResolver = compiler.resolverFactory.get('normal');

  return async function resolveImport(source, importer) {
    if (!importer) return null;

    return new Promise((resolve) => {
      webpackResolver.resolve(
        {},
        path.dirname(importer),
        source,
        {},
        (error: Error | null, result?: string | false) => {
          if (error) {
            resolve(null);
            return;
          }

          if (result === false) {
            resolve({
              id: source,
              external: true,
            });
            return;
          }

          if (typeof result === 'string') {
            resolve({ id: result });
            return;
          }

          resolve(null);
        }
      );
    });
  };
}
