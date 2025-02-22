import React from 'react';
import {
  TaggedElement,
  TaggedElementProps,
} from '../types/types';

export function isValidTaggedElement(target: unknown): target is TaggedElement {
  return React.isValidElement<TaggedElementProps>(target);
}

export function readAuthFromEnv(
  projectId?: string,
  devApiKey?: string
): {
  projectId: string;
  devApiKey?: string;
} {
  // vite
  try {
    return {
      projectId: projectId || import.meta.env.VITE_GT_PROJECT_ID || '',
      devApiKey: devApiKey || import.meta.env.VITE_GT_API_KEY,
    };
  } catch {}
  // everything else
  try {
    if (typeof process !== 'undefined')
      return {
        projectId:
          projectId ||
          process.env.REACT_APP_GT_PROJECT_ID ||
          process.env.NEXT_PUBLIC_GT_PROJECT_ID ||
          process.env.GATSBY_GT_PROJECT_ID ||
          '',
        devApiKey:
          devApiKey ||
          process.env.REACT_APP_GT_API_KEY ||
          process.env.NEXT_PUBLIC_GT_API_KEY ||
          process.env.GATSBY_GT_API_KEY,
      };
  } catch (e) {
    console.error(e);
  }

  return { projectId: '', devApiKey: '' };
}
