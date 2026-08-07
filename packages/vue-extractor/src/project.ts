/**
 * Extracts all statically discoverable gt-vue messages owned by a project.
 *
 * The project boundary owns workspace discovery, Vue compiler configuration,
 * Vite aliases, local-module resolution, file matching, hashing, and atomic
 * diagnostics so callers do not need any Vue-specific orchestration.
 */
export { extractFromVueProject } from './internal/project/extractFromVueProject.js';
export type {
  VueProjectExtractionOptions,
  VueProjectExtractionOutput,
  VueProjectExtractionResult,
} from './types.js';
