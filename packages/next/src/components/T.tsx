import { isValidElement, type ComponentProps, type ReactNode } from 'react';
import { T as ReactT } from 'gt-react';
import type { GTMarker } from '@generaltranslation/react-core/pure';
import { createUnhashedClientTWarning } from '../errors/client';

/** The static text of a <T>, without the runtime values of its variables. */
function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) {
    const marker = (node.type as { _gtt?: GTMarker })._gtt;
    return marker?.kind === 'variable' ? '' : textOf(node.props.children);
  }
  return '';
}

// A function, so production builds, which fold the condition of T to ReactT,
// drop it.
function createUnhashedWarningT(): typeof ReactT {
  const warnedTexts = new Set<string>();
  function UnhashedWarningT(props: ComponentProps<typeof ReactT>) {
    if (props._hash === undefined) {
      const text = textOf(props.children);
      if (!warnedTexts.has(text)) {
        warnedTexts.add(text);
        console.warn(createUnhashedClientTWarning(text));
      }
    }
    return <ReactT {...props} />;
  }
  UnhashedWarningT._gtt = ReactT._gtt;
  return UnhashedWarningT;
}

export const T =
  process.env.NODE_ENV === 'development' &&
  process.env._GENERALTRANSLATION_SPLIT_TRANSLATIONS === 'true'
    ? createUnhashedWarningT()
    : ReactT;
