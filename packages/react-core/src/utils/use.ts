// The code in this file is adapted from gt-next's React 18/19 compatibility shim.
// It avoids statically importing `use` from React so bundlers don't attempt
// to resolve a non-existent named export in React 18.

import * as React from 'react';

// `use` is only officially available in React 19. Some environments (e.g. Next)
// vendor it earlier, but plain React 18 does not export it.
// Use an opaque property access to prevent bundlers from rewriting
// this into a static named import.
let reactUse: typeof React.use | undefined;
try {
  // Indirect property access via Function constructor avoids static analysis.
  const getProp = Function('o', 'k', 'return o[k]') as (
    o: any,
    k: string
  ) => any;
  reactUse = getProp(React as any, 'use') as typeof React.use | undefined;
} catch {
  // ignore
}

export default reactUse;
