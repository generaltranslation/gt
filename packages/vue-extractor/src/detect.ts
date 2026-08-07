/**
 * Detects declared or publicly re-exported gt-vue ownership without loading
 * the Vue compiler.
 *
 * Local wrapper packages are parsed only to prove their public provenance.
 * The full template and project extractor remains behind the `project` export.
 */
export { detectVueProject } from './internal/project/detectVueProject.js';
