export {
  alphaRenameMap,
  canonicalizeTree,
  renameFormats,
  renameVariables,
  treeShape,
} from './tree.js';
export {
  convertLegacyValue,
  gtjsxToMessage,
  legacyIcuToMessage,
} from './legacy.js';
export {
  legacySourceCandidates,
  type LegacySourceCandidate,
} from './candidates.js';
export {
  fillTranslationBranches,
  migrateTranslation,
  validateMigratedTranslation,
  type MigrateTranslationInput,
  type MigrateTranslationResult,
} from './translation.js';
