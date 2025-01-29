import React from "react";
import {
  TaggedElement,
  TaggedElementProps,
  TranslatedContent,
} from "../types/types";

export function isTranslatedContent(
  target: unknown
): target is TranslatedContent {
  if (typeof target === "string") {
    return true;
  }

  if (!Array.isArray(target)) {
    return false;
  }

  return target.every((item) => {
    if (typeof item === "string") {
      return true;
    }

    if (typeof item === "object" && item !== null) {
      const hasKey = "key" in item && typeof item.key === "string";
      const hasValidVariable =
        item.variable === undefined || typeof item.variable === "string";
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
