import { LocaleSelectorClient } from '../locale-selector.client';
import type { LocaleSelectorProps } from './LocaleSelector.client';

// RSC facade over the interactive locale selector. Rendering a client
// component from a server component is an intentional client boundary, so
// this module may import the client implementation — but only through the
// dedicated locale-selector.client build entry, which the context build
// configs keep external so its 'use client' directive survives bundling.
// (The props type is imported from the implementation module instead so the
// emitted declarations never reference the externalized entry.) This module
// itself must stay free of hook/context imports so it can be exported from
// the context-rsc entrypoint.

function RscLocaleSelector(props: LocaleSelectorProps): React.JSX.Element {
  return <LocaleSelectorClient {...props} />;
}

// ===== Exports ===== //

export { RscLocaleSelector };
