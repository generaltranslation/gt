/** Shared by General Translation packages; not a public API, and it may change in any release. */
export {
  templateToMessage,
  RESERVED_NAME_PREFIX,
} from './tree/templateToMessage';
export type {
  TemplateMessage,
  TemplateBranch,
  BranchingKind,
  TemplateFragment,
  TemplateHole,
} from './tree/templateToMessage';
export { FALLBACK_BRANCH_KEY, PLURAL_CATEGORIES } from './settings/syntax';
export {
  DATE_FIELD_OPTIONS,
  DATE_TIME_CONTEXT_OPTIONS,
  NUMBER_CONTEXT_OPTIONS,
} from './settings/formatOptions';
export {
  DEFAULT_DATE_TIME_STYLE,
  toPluralRulesNumber,
} from './formatter/formatMessageTree';
export { forEachPlaceholder } from './tree/walk';
export { IntlCache, intlCache } from './cache/IntlCache';
