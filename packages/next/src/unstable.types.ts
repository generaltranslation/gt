// Backs the "types" condition of gt-next/unstable. Only its declarations ship.
// No `t`, like the root entry: Next has no synchronous global locale store
// (RSC's is async), so use useGT() or gt-next/unstable/server getGT().

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
} from 'gt-react/unstable';
