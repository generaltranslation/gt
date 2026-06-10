// Compatibility alias for the RSC-safe context surface.
// Prefer the narrower pure/components-rsc entrypoints for new internal imports
// when the full context-rsc facade is not needed.

// ===== Components ===== //
export * from './components-rsc';
export { RscT, RscT as T } from './components/translation/T.rsc';

// ===== Functions ===== //
export { getTranslationsSnapshot } from './functions/helpers/getTranslationsSnapshot';
export { t } from './functions/translation/t';

// ===== Helpers ===== //
export { getFormatLocales, getPluralBranch } from './pure';
export { getShouldTranslate } from './hooks/utils/getShouldTranslate';
export { prepareT } from './utils/translation/prepareT.shared';
export { createRenderVariable } from './utils/rendering/createRenderVariable';
export { createRenderPipeline } from './utils/rendering/createRenderPipeline';
// Pre-instantiated RSC render pipeline: bound to the RSC renderVariable, so
// consumers never thread a variable renderer through rendering calls.
export {
  renderDefaultChildren,
  renderPreparedT,
  renderTranslatedChildren,
  renderVariable,
} from './utils/rendering/renderPipeline.rsc';

// ===== Internal ===== //
export { internalInitializeGTSRA } from './setup/initializeGTSRA';
export { getReadonlyConditionStoreWithFallback } from './condition-store/singleton-operations';
export {
  getReactI18nCache,
  setReactI18nCache,
} from './i18n-cache/singleton-operations';

// ===== Types ===== //
export type {
  JsxTranslationOptions,
  PreparedT,
} from './utils/translation/prepareT.shared';
export type {
  PluralProps,
  ResolvedPluralProps,
} from './components/branches/Plural.shared';
export type {
  CurrencyProps,
  ResolvedCurrencyProps,
} from './components/variables/Currency.shared';
export type {
  DateTimeProps,
  ResolvedDateTimeProps,
} from './components/variables/DateTime.shared';
export type {
  NumProps,
  ResolvedNumProps,
} from './components/variables/Num.shared';
export type {
  RelativeTimeProps,
  ResolvedRelativeTimeProps,
} from './components/variables/RelativeTime.shared';
export type { RelativeTimeFormatOptions, RenderVariable } from './pure';
