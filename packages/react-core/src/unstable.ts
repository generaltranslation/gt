// Tagged-template translation entrypoint for React runtimes. useGT reads React
// context, so this entry is not RSC-safe; server components use their
// framework's useGT().

export { t } from './unstable/t';
export { useGT } from './unstable/useGT';
export { useMessages } from './unstable/useMessages';
export {
  date,
  derive,
  mFallback,
  msg,
  n,
  number,
  part,
  plural,
  select,
  selectordinal,
  time,
  type Fragment,
  type GT,
  type GTOptions,
  type M,
  type Msg,
  type Placeholder,
} from 'gt-i18n/unstable';
