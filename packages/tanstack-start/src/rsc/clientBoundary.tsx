'use client';

import { LocaleSelector as ReactLocaleSelector } from 'gt-react';
import type { ComponentProps } from 'react';

// gt-react's react-server entry has no selector that renders, so a server
// component takes this one, a reference to a client module.
export function LocaleSelector(
  props: ComponentProps<typeof ReactLocaleSelector>
) {
  return <ReactLocaleSelector {...props} />;
}
