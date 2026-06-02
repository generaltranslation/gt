import type { RenderStrategy } from '../../setup/globals';

/**
 * Mode-aware boundary for runtime conditions used during lookup preparation.
 *
 * ConditionAdapter stays separate from LookupAdapter because locale and
 * enableI18n are render conditions, while LookupAdapter owns translation and
 * dictionary result policy.
 */
export type ConditionAdapter = {
  mode: RenderStrategy;
  getLocale: () => string;
  getEnableI18n: () => boolean;
};
