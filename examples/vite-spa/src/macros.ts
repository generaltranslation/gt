import { t as translate } from 'gt-react';

declare global {
  var t: typeof translate;
}

globalThis.t = translate;
