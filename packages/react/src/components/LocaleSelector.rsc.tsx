import { LocaleSelector as LocaleSelectorClient } from '../context.client';
import type { CustomMapping } from 'generaltranslation/types';

// RSC facade over the interactive locale selector. Rendering a client
// component from a server component is an intentional client boundary, so
// this module may reference the client implementation — but only through the
// context.client entrypoint, whose build artifact carries the 'use client'
// directive. The context-rsc build config keeps this import external and
// rewrites it to the built context.client artifact (see tsdown.config.mts);
// bundling it instead would drop the directive and silently break the
// boundary. This module itself must stay free of hook/context imports so it
// can be exported from the context-rsc entrypoint.

// Mirrors the LocaleSelector props; declared locally so the emitted
// declarations never reference the externalized client artifact.
type LocaleSelectorProps = {
  locales?: string[];
  customNames?: { [key: string]: string };
  customMapping?: CustomMapping;
  [key: string]: any;
};

function RscLocaleSelector(props: LocaleSelectorProps): React.JSX.Element {
  return <LocaleSelectorClient {...props} />;
}

// ===== Exports ===== //

export { RscLocaleSelector };
