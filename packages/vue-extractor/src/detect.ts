/**
 * Detects declared gt-vue ownership without loading the parser or Vue compiler.
 *
 * This lightweight entrypoint is safe for host CLIs to import during command
 * routing; the heavier project extractor remains behind the `project` export.
 */
export { detectVueProject } from './internal/project/detectVueProject.js';
