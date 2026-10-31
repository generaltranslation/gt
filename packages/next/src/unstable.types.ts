// Backs the "types" condition of gt-next/unstable. Only its declarations ship.
// No `t`, like the root entry: Next has no synchronous global locale store
// (RSC's is async), so use useGT() or gt-next/unstable/server getGT().

export {
  date,
  derive,
  n,
  number,
  part,
  plural,
  select,
  selectordinal,
  useGT,
  type Fragment,
  type GT,
  type GTOptions,
  type Placeholder,
} from 'gt-react/unstable';
