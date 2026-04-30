import type { UnpluginBuildContext, UnpluginContext } from 'unplugin';
import type { NativeResolver } from './types';

type ViteResolutionContext = UnpluginBuildContext &
  UnpluginContext & {
    resolve?: NativeResolver;
  };

export type MissingResolveWarningState = {
  value: boolean;
};

export function createViteResolver(
  ctx: UnpluginBuildContext & UnpluginContext,
  warnedMissingResolve: MissingResolveWarningState
): NativeResolver {
  const { resolve } = ctx as ViteResolutionContext;
  if (typeof resolve !== 'function') {
    warnMissingResolve(ctx, warnedMissingResolve);
    return async () => null;
  }

  return resolve.bind(ctx);
}

function warnMissingResolve(
  ctx: UnpluginContext,
  warnedMissingResolve: MissingResolveWarningState
): void {
  if (warnedMissingResolve.value) return;
  warnedMissingResolve.value = true;
  ctx.warn(
    '[gt-compiler] Cross-file resolution is enabled, but this bundler context does not expose resolve(). Import lookups will return null.'
  );
}
