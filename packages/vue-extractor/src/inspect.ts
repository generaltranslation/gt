/**
 * Inspects root and workspace Vue ownership without loading the Vue compiler
 * or full source analyzer.
 *
 * Pass the returned plan to `extractFromVueProject` to avoid repeating
 * workspace traversal during mixed-framework extraction.
 */
export {
  inspectVueProject,
  inspectVueProjectAsync,
  readVueSfcExclusionPatterns,
} from './internal/project/inspectVueProject.js';
export type { VueProjectInspection } from './types.js';
