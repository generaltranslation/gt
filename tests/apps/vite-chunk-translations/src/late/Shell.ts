import { t } from 'gt-react';
import { frame } from '../shared/late/frame';

// Only the minifier is told that this is false (CHECK_LATE_REMOVAL in
// vite.config.ts), so the call below is in the code the bundler renders and
// in no chunk of the build.
declare const __CHECK_DEBUG__: boolean;

if (__CHECK_DEBUG__) {
  console.warn(t`First late message`, t`Second late message`);
}

// The frame is in the chunk of the shared modules, which so loads with the
// Shell: that chunk lists what the Shell fetches in one list
export const messages = () => ({ frame: frame() });
export const openFirst = () => import('./First');
export const openSecond = () => import('./Second');
