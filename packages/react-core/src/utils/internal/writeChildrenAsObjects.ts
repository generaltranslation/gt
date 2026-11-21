import {
  GTTag,
  TaggedChild,
  TaggedChildren,
  TaggedElement,
} from '../../utils/types';
import { isValidTaggedElement } from '../../utils/utils';
import {
  GTProp,
  HTML_CONTENT_PROPS,
  HtmlContentPropKeysRecord,
  JsxChild,
  JsxChildren,
  JsxElement,
  Variable,
} from '@generaltranslation/format';

/**
 * Gets the tag name of a React element.
 * @param {ReactElement} child - The React element.
 * @returns {string} - The tag name of the React element.
 */
const getTagName = (child: TaggedElement): string => {
  const { type, props } = child;
  if (typeof type === 'function') {
    if (
      'displayName' in type &&
      typeof type.displayName === 'string' &&
      type.displayName
    )
      return type.displayName;
    if ('name' in type && typeof type.name === 'string' && type.name)
      return type.name;
  }
  if (type && typeof type === 'string') return type;
  if (props.href) return 'a';
  if (props['data-_gt']?.id) return `C${props['data-_gt'].id}`;
  return 'function';
};
/** What each kind of branching element is stored as. */
const TRANSFORMATION_CODES = {
  branch: 'b',
  plural: 'p',
  ordinal: 'o',
} as const;

const createGTProp = (
  tag: GTTag,
  props: Record<string, unknown>
): GTProp | undefined => {
  // Add translatable HTML content props
  let newGTProp: GTProp = Object.entries(HTML_CONTENT_PROPS).reduce<GTProp>(
    (acc, [minifiedName, fullName]) => {
      const value = props[fullName];
      if (typeof value === 'string') {
        acc[minifiedName as keyof HtmlContentPropKeysRecord] = value;
      }
      return acc;
    },
    {}
  );

  // Check if plural or branch
  if ('branches' in tag && tag.branches) {
    const newBranches: Record<string, JsxChildren> = {};
    Object.entries(tag.branches).forEach(
      ([key, value]: [string, TaggedChildren]) => {
        // Empty children render as the fallback, but are no content to store.
        if (
          key === 'other' &&
          (value == null || value === false || value === '')
        )
          return;
        newBranches[key] = writeChildrenAsObjects(value);
      }
    );
    if (Object.keys(newBranches).length)
      newGTProp = {
        ...newGTProp,
        b: newBranches,
        t: TRANSFORMATION_CODES[tag.transformation],
      };
  }

  return Object.keys(newGTProp).length ? newGTProp : undefined;
};

/**
 * Handles a single child element.
 * @param {TaggedElement} child - The child to handle.
 * @returns {JsxElement | Variable} The minified element.
 */
const handleSingleChildElement = (
  child: TaggedElement
): JsxElement | Variable => {
  const { props } = child;
  const minifiedElement: JsxElement = {
    t: getTagName(child),
  };
  if (props['data-_gt']) {
    // Get generaltranslation props
    const generaltranslation = props['data-_gt'];

    // Check if variable
    if (generaltranslation.transformation === 'variable') {
      return {
        i: generaltranslation.id,
        ...(typeof props.name === 'string' &&
          props.name !== '' && { k: props.name }),
        v: generaltranslation.variableType,
      };
    }

    // Add id
    minifiedElement.i = generaltranslation.id;

    // Add GT prop
    minifiedElement.d = createGTProp(generaltranslation, props);
  }
  if (props.children) {
    minifiedElement.c = writeChildrenAsObjects(props.children);
  }
  return minifiedElement;
};

const handleSingleChild = (child: TaggedChild): JsxChild => {
  if (isValidTaggedElement(child)) {
    return handleSingleChildElement(child);
  }
  if (typeof child === 'number') return child.toString();
  return child as JsxChild;
};

/**
 * Transforms children elements into objects, processing each child recursively if needed.
 * TaggedChildren are transformed into JsxChildren
 * @param {Children} children - The children to process.
 * @returns {object} The processed children as objects.
 */
export function writeChildrenAsObjects(children: TaggedChildren): JsxChildren {
  const result = Array.isArray(children)
    ? children.map(handleSingleChild)
    : handleSingleChild(children);
  return result;
}
