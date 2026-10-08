import { FrameworkObject, ReactFrameworkObject } from '../types/index.js';
import { Libraries } from '../types/libraries.js';

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
  if (frameworkObject.name === 'tanstack-start') {
    return 'TanStack Start';
  }
  if (frameworkObject.name === 'react-router') {
    return 'React Router';
  }
  if (frameworkObject.type === 'react') {
    return 'React';
  }
  return 'another framework';
}

export function getReactFrameworkLibrary(
  frameworkObject: ReactFrameworkObject
): string {
  if (frameworkObject.name === 'next-app') return Libraries.GT_NEXT;
  if (frameworkObject.name === 'tanstack-start') {
    return Libraries.GT_TANSTACK_START;
  }
  return Libraries.GT_REACT;
}
