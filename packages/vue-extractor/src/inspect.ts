/**
 * Inspects root and workspace Vue ownership without loading source parsers.
 *
 * Pass the returned plan to `extractFromVueProject` to avoid repeating
 * workspace traversal during mixed-framework extraction.
 */
export {
  inspectVueProject,
  readVueSfcExclusionPatterns,
} from './internal/project/inspectVueProject.js';
export type { VueProjectInspection } from './types.js';
