import React from 'react';
import {
  TaggedElement,
  TaggedElementProps,
  TranslatedContent,
} from '../types/types';
import { createNoAuthError } from '../messages/createMessages';
export function isTranslatedContent(
  target: unknown
): target is TranslatedContent {
  if (typeof target === 'string') {
    return true;
  }

  if (!Array.isArray(target)) {
    return false;
  }

  return target.every((item) => {
    if (typeof item === 'string') {
      return true;
    }

    if (typeof item === 'object' && item !== null) {
      const hasKey = 'key' in item && typeof item.key === 'string';
      const hasValidVariable =
        item.variable === undefined || typeof item.variable === 'string';
      return hasKey && hasValidVariable;
    }

    return false;
  });
}

export function isValidTaggedElement(target: unknown): target is TaggedElement {
  return React.isValidElement<TaggedElementProps>(target);
}

export function isEmptyReactFragment(
  target: unknown
): target is React.ReactElement {
  if (React.isValidElement(target) && target.type === React.Fragment) {
    const props = target.props as { children?: React.ReactNode };
    return !props.children || React.Children.count(props.children) === 0;
  }
  return false;
}

export function getAuth(
  projectId?: string,
  devApiKey?: string
): {
  projectId?: string;
  devApiKey?: string;
} {
  // vite
  try {
    return {
      projectId: projectId || import.meta.env.VITE_GT_PROJECT_ID,
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
          process.env.GATSBY_GT_PROJECT_ID,
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
