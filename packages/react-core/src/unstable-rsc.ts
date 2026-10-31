// Hook-free tagged-template translation entrypoint, safe for React Server
// Components. Do not export modules that import React context or hooks.

export { t } from './unstable/t.shared';
export {
  date,
  derive,
  n,
  number,
  part,
  plural,
  select,
  selectordinal,
  type Fragment,
  type GT,
  type GTOptions,
  type Placeholder,
} from 'gt-i18n/unstable';
