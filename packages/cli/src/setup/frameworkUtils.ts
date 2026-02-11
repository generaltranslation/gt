import { FrameworkObject, ReactFrameworkObject } from '../types/index.js';
import { Libraries } from '../react/jsx/utils/constants.js';

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
