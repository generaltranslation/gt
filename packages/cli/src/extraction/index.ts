export type { ExtractionResult, ExtractionMetadata } from './types.js';
export { mapExtractionResultsToUpdates } from './mapToUpdates.js';
export {
  calculateHashes,
  dedupeUpdates,
  linkStaticUpdates,
} from './postProcess.js';
