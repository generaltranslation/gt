// Kept off the root entry: setting GT up reaches I18nConfig, and through it the
// ICU string parser, which code that only translates messages never needs.
export { initializeGT, type InitializeGTParams } from './setup/initializeGT';
export { setLocale, onLocaleChange } from './setup/setLocale';
