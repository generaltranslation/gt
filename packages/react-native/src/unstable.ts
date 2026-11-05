// Tagged-template translation entrypoint. Keep in parity with gt-react/unstable,
// except `t`: like the root entry, React Native registers no global locale
// store for it to read (the provider keeps it in context). Use useGT().

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
  useGT,
  useMessages,
  type Fragment,
  type GT,
  type GTOptions,
  type M,
  type Msg,
  type Placeholder,
} from '@generaltranslation/react-core/unstable';
