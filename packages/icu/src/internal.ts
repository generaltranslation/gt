/** Shared by General Translation packages; not a public API, and it may change in any release. */
export {
  buildMessageTree,
  RESERVED_NAME_PREFIX,
} from './tree/buildMessageTree';
export type {
  BuiltMessageTree,
  TemplateBranch,
  BranchingKind,
  TemplateFragment,
  TemplateHole,
} from './tree/buildMessageTree';
export { FALLBACK_BRANCH_KEY } from './settings/syntax';
export {
  DATE_TIME_CONTEXT_OPTIONS,
  NUMBER_CONTEXT_OPTIONS,
} from './settings/formatOptions';
export { forEachPlaceholder } from './tree/walk';
export { IntlCache, intlCache } from './cache/IntlCache';
