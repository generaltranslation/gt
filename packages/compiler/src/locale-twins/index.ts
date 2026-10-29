export { generateLocaleTwins } from './generateLocaleTwins';
export type {
  GenerateLocaleTwinsInput,
  GenerateLocaleTwinsResult,
  LocaleTwinInputFile,
  LocaleTwinReport,
  LocaleTwinSourceMap,
} from './generateLocaleTwins';
export {
  createInvalidTwinLocaleDiagnostic,
  createMissingTranslationsDiagnostic,
} from './diagnostics';
export type { MissingLocaleTwinTranslations } from './diagnostics';
export {
  LOCALE_TWIN_BOOTSTRAP_FILE_PREFIX,
  LOCALE_TWIN_REPORT_FILE,
  writeLocaleTwinReport,
  writeLocaleTwinSpaDocuments,
  writeLocaleTwins,
} from './writeLocaleTwins';
export type {
  LocaleTwinBuildReport,
  LocaleTwinSpaReport,
  WriteLocaleTwinSpaDocumentsInput,
  WriteLocaleTwinsInput,
  WriteLocaleTwinsResult,
} from './writeLocaleTwins';
export { rewriteLocaleTwinDocument } from './spaDocument';
export type {
  RewriteLocaleTwinDocumentInput,
  RewriteLocaleTwinDocumentResult,
} from './spaDocument';
export { createLocaleTwinsViteHooks } from './vite/localeTwinsViteHooks';
export {
  LOCALE_TWIN_MANIFEST_MODULE_ID,
  RESOLVED_LOCALE_TWIN_MANIFEST_MODULE_ID,
} from './vite/manifestModule';
