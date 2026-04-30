import type { UnpluginBuildContext, UnpluginContext } from 'unplugin';
import type { NativeResolver } from './types';

type ViteResolutionContext = UnpluginBuildContext &
  UnpluginContext & {
    resolve?: NativeResolver;
  };

export function createViteResolver(
  ctx: UnpluginBuildContext & UnpluginContext
): NativeResolver {
  const { resolve } = ctx as ViteResolutionContext;
  if (typeof resolve !== 'function') {
    return async () => null;
  }

  return resolve.bind(ctx);
}
