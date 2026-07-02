// Pure helper shared by hook-based and RSC code paths. This module must stay
// free of hook/context imports so it can be reached from the components-rsc
// entrypoint.
export { getFormatLocales } from 'gt-i18n/internal';
