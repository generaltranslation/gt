import {
  FrameworkObject,
  ReactFrameworkObject,
  SupportedReactFrameworks,
} from '../types/index.js';
import { Libraries } from '../types/libraries.js';

export type ReactRenderingMode = 'spa' | 'ssr';

export type ReactSetupContext = {
  framework: SupportedReactFrameworks;
  renderingMode: ReactRenderingMode;
};

export function getFrameworkDisplayName(
  frameworkObject: FrameworkObject
): string {
  if (frameworkObject.name === 'mintlify') {
    return 'Mintlify';
  }
  if (frameworkObject.name === 'next-app') {
    return 'Next.js App Router';
  }
  if (frameworkObject.name === 'next-pages') {
    return 'Next.js Pages Router';
  }
  if (frameworkObject.name === 'vite') {
    return 'Vite + React';
  }
  if (frameworkObject.name === 'gatsby') {
    return 'Gatsby';
  }
  if (frameworkObject.name === 'redwood') {
    return 'RedwoodJS';
  }
  if (frameworkObject.type === 'react') {
    return 'React';
  }
  return 'another framework';
}

export function getReactFrameworkLibrary(
  frameworkObject: ReactFrameworkObject
): string {
  return frameworkObject.name === 'next-app'
    ? Libraries.GT_NEXT
    : Libraries.GT_REACT;
}

export function getDefaultReactRenderingMode(
  frameworkObject: ReactFrameworkObject
): ReactRenderingMode | undefined {
  if (frameworkObject.name === 'vite') {
    return 'spa';
  }
  if (frameworkObject.name === 'react') {
    return undefined;
  }
  return 'ssr';
}

export function getReactSetupSummary(
  frameworkObject: ReactFrameworkObject,
  renderingMode = getDefaultReactRenderingMode(frameworkObject)
): string {
  const library = getReactFrameworkLibrary(frameworkObject);

  if (frameworkObject.name === 'next-app') {
    return `${library} with GTProvider`;
  }
  if (renderingMode === 'spa') {
    return `${library} for a browser-rendered SPA (no GTProvider)`;
  }
  if (renderingMode === 'ssr') {
    return `${library} for server-rendered React (GTProvider receives only locale and translations)`;
  }
  return `${library} for React (choose SPA or server rendering during setup)`;
}

export function getLoadTranslationsSetupInstruction(
  setupContext?: ReactSetupContext
): string {
  if (setupContext?.renderingMode === 'spa') {
    return 'Pass this function to initializeGTSPA(). SPAs do not use GTProvider.';
  }
  if (
    setupContext?.renderingMode === 'ssr' &&
    setupContext.framework !== 'next-app'
  ) {
    return 'Pass this function to initializeGT(). GTProvider should receive only the resolved locale and translations.';
  }
  return 'Connect this function through your library or framework initialization, not through GTProvider.';
}
