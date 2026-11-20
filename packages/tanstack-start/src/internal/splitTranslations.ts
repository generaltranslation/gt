// Redirected by the gt-tanstack-start Vite plugin to splitTranslations.server
// or splitTranslations.client in a production build that splits translations.
// Otherwise the split is off and apps ship none of its code.
import type { SplitPayload, SplitRouter } from '../split/types';

export const getSplitPayload: (
  locale: string,
  router: SplitRouter
) => Promise<SplitPayload | undefined> = async () => undefined;

export const getSplitShellPayload: (
  router: SplitRouter
) => SplitPayload | undefined = () => undefined;

export const preloadSplitFiles: (payload: SplitPayload) => void = () =>
  undefined;

export const hydrateSplit: (
  payload: SplitPayload,
  locale: string
) => Promise<void> = async () => undefined;

export const splitLoadTranslations:
  | ((locale: string) => Promise<Record<string, unknown>>)
  | undefined = undefined;
