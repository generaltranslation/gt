/**
 * Public entry point for the gt migrate engine. The gt CLI loads this module on
 * demand and calls `runMigration`, then applies the returned edits and prints
 * the report. Everything interactive or process-level is injected through the
 * `MigrateIO` object, so the engine pulls in no CLI UI dependencies.
 */
export {
  runMigration,
  MIGRATE_INTERFACE_VERSION,
} from './pipeline/runMigration.js';
export { buildReport } from './report/report.js';
// Resets the per-run i18next config cache; used between programmatic runs and by
// the CLI's integration tests.
export { clearI18nextConfigCache } from './config/reactI18nextConfig.js';

export type { MigrateIO } from './pipeline/io.js';
export type {
  MigrateOptions,
  MigrationContext,
  FileEdit,
  TodoEntry,
  MessageCatalogs,
  RoutingInfo,
  SourceResult,
} from './pipeline/types.js';
export type { SourceAdapter } from './adapters/types.js';
