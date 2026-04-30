import type { UnpluginBuildContext, UnpluginContext } from 'unplugin';
import type { NativeResolver } from './types';

type ViteResolutionContext = UnpluginBuildContext &
  UnpluginContext & {
    resolve?: NativeResolver;
  };

let warnedMissingResolve = false;

export function createViteResolver(
  ctx: UnpluginBuildContext & UnpluginContext
): NativeResolver {
  const { resolve } = ctx as ViteResolutionContext;
  if (typeof resolve !== 'function') {
    warnMissingResolve(ctx);
    return async () => null;
  }

  return resolve.bind(ctx);
}

function warnMissingResolve(ctx: UnpluginContext): void {
  if (warnedMissingResolve) return;
  warnedMissingResolve = true;
  ctx.warn(
    '[gt-compiler] Cross-file resolution is enabled, but this bundler context does not expose resolve(). Import lookups will return null.'
  );
}
