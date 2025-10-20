import getVariableName from '../variables/getVariableName';
import { TaggedChild, TaggedChildren, TaggedElement } from '../types-dir/types';
import { isValidTaggedElement } from '../utils/utils';
import {
  JsxChild,
  JsxChildren,
  JsxElement,
  minifyVariableType,
} from 'generaltranslation/internal';
import {
  GTProp,
  HTML_CONTENT_PROPS,
  HtmlContentPropKeysRecord,
  Transformation,
  Variable,
} from 'generaltranslation/types';

/**
 * Gets the tag name of a React element.
 * @param {ReactElement} child - The React element.
 * @returns {string} - The tag name of the React element.
 */
const getTagName = (child: TaggedElement): string => {
  if (!child) return '';
  const { type, props } = child;
  if (type && typeof type === 'function') {
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
const createGTProp = (
  transformation: Transformation,
  props: Record<string, any>,
  branches?: Record<string, TaggedChildren>
): GTProp | undefined => {
  // Add translatable HTML content props
  let newGTProp: GTProp = Object.entries(HTML_CONTENT_PROPS).reduce<GTProp>(
    (acc, [minifiedName, fullName]) => {
      if (props[fullName]) {
        acc[minifiedName as keyof HtmlContentPropKeysRecord] = props[fullName];
      }
      return acc;
    },
    {}
  );

  // Check if plural
  if (transformation === 'plural' && branches) {
    const newBranches: Record<string, JsxChildren> = {};
    Object.entries(branches).forEach(
      ([key, value]: [string, TaggedChildren]) => {
        newBranches[key] = writeChildrenAsObjects(value);
      }
    );
    newGTProp = { ...newGTProp, b: newBranches, t: 'p' };
  }
  if (transformation === 'branch' && branches) {
    const newBranches: Record<string, JsxChildren> = {};
    Object.entries(branches).forEach(
      ([key, value]: [string, TaggedChildren]) => {
        newBranches[key] = writeChildrenAsObjects(value);
      }
    );
    newGTProp = { ...newGTProp, b: newBranches, t: 'b' };
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
    const transformation = generaltranslation.transformation;
    if (transformation === 'variable') {
      const variableType = generaltranslation.variableType || 'variable';
      const variableName = getVariableName(props, variableType);
      const minifiedVariableType = minifyVariableType(variableType);
      return {
        i: generaltranslation.id,
        k: variableName,
        v: minifiedVariableType,
      };
    }

    // Add id
    minifiedElement.i = generaltranslation.id;

    // Add GT prop
    minifiedElement.d = createGTProp(
      transformation as Transformation,
      props,
      generaltranslation.branches
    );

    // Add translatable HTML content props
    let newGTProp: GTProp = Object.entries(HTML_CONTENT_PROPS).reduce<GTProp>(
      (acc, [minifiedName, fullName]) => {
        if (props[fullName]) {
          acc[minifiedName as keyof HtmlContentPropKeysRecord] =
            props[fullName];
        }
        return acc;
      },
      {}
    );

    // Check if plural
    if (transformation === 'plural' && generaltranslation.branches) {
      const newBranches: Record<string, JsxChildren> = {};
      Object.entries(generaltranslation.branches).forEach(
        ([key, value]: [string, TaggedChildren]) => {
          newBranches[key] = writeChildrenAsObjects(value);
        }
      );
      newGTProp = { ...newGTProp, b: newBranches, t: 'p' };
    }
    if (transformation === 'branch' && generaltranslation.branches) {
      const newBranches: Record<string, JsxChildren> = {};
      Object.entries(generaltranslation.branches).forEach(
        ([key, value]: [string, TaggedChildren]) => {
          newBranches[key] = writeChildrenAsObjects(value);
        }
      );
      newGTProp = { ...newGTProp, b: newBranches, t: 'b' };
    }

    minifiedElement.d = Object.keys(newGTProp).length ? newGTProp : undefined;
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
export default function writeChildrenAsObjects(
  children: TaggedChildren
): JsxChildren {
  const result = Array.isArray(children)
    ? children.map(handleSingleChild)
    : handleSingleChild(children);
  return result;
}
