// Tagged-template translation entrypoint for React runtimes. useGT reads React
// context, so this entry is not RSC-safe; server components use their
// framework's useGT(). The message helpers (msg, plural, ...) come from
// gt-i18n/unstable; the framework facades re-export them.

export { t } from './unstable/t';
export { useGT } from './unstable/useGT';
export { useMessages } from './unstable/useMessages';
