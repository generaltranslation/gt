import {
  LocaleSelectorClient,
  type LocaleSelectorProps,
} from 'gt-react/internal/locale-selector-client';

// RSC facade over the interactive locale selector. Rendering a client
// component from a server component is an intentional client boundary, so
// this module may import the client implementation — but only through the
// dedicated package subpath, whose build output keeps the 'use client'
// directive. This module itself must stay free of hook/context imports so it
// can be exported from the context-rsc entrypoint.

function RscLocaleSelector(props: LocaleSelectorProps): React.JSX.Element {
  return <LocaleSelectorClient {...props} />;
}

// ===== Exports ===== //

export { RscLocaleSelector };
