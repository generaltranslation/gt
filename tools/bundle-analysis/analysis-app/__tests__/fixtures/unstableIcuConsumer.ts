// An app that opts in to ICU-string translations with a bare import, which a
// bundler keeps only because gt-i18n lists the entry in `sideEffects`.
import 'gt-i18n/unstable/icu';
export { t } from 'gt-i18n/unstable';
