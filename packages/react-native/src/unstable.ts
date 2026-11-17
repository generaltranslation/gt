// Tagged-template translation entrypoint. Keep in parity with gt-react/unstable,
// except `t` and `m`: like the root entry, React Native registers no global
// locale store for them to read (the provider keeps it in context). Use useGT()
// and useMessages().

export { useGT, useMessages } from '@generaltranslation/react-core/unstable';
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
