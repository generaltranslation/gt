// React Server Component-safe context surface.
//
// This entrypoint may import client components only through explicit
// 'use client' boundaries. Do not re-export from context.client, context.server,
// or @generaltranslation/react-core/context here.

export { GTProvider, LocaleSelector } from 'gt-react/client-boundary';

export {
  Branch,
  Derive,
  GtInternalBranch,
  GtInternalDerive,
  GtInternalVar,
  Var,
} from '@generaltranslation/react-core/components-rsc';

export {
  decodeMsg,
  decodeOptions,
  decodeVars,
  declareVar,
  derive,
  getPluralBranch,
  gtFallback,
  mFallback,
  msg,
} from '@generaltranslation/react-core/pure';

export type {
  RelativeTimeFormatOptions,
  RenderVariable,
} from '@generaltranslation/react-core/pure';
