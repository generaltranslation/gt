import getVariableName from '../variables/getVariableName';
import { TaggedChild, TaggedChildren, TaggedElement } from '../types/types';
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

const handleSingleChildElement = (
  child: TaggedElement
): JsxElement | Variable => {
  const { props } = child;
  const objectElement: JsxElement = {
    t: getTagName(child),
    props: {},
  };
  if (props['data-_gt']) {
    const generaltranslation = props['data-_gt'];
    objectElement.i = generaltranslation.id;
    // Add translatable HTML content props
    let newGTProp: GTProp = Object.entries(HTML_CONTENT_PROPS).reduce(
      (acc, [minifiedName, fullName]) => {
        if (props[fullName]) {
          newGTProp[minifiedName as keyof HtmlContentPropKeysRecord] =
            props[fullName];
        }
        return acc;
      },
      {}
    );

    // Check if variable
    const transformation = generaltranslation.transformation;
    if (transformation === 'variable') {
      const variableType = minifyVariableType(
        generaltranslation.variableType || 'variable'
      );
      const variableName = getVariableName(props, variableType);
      return {
        v: variableType,
        k: variableName,
        i: generaltranslation.id,
      };
    }

    // Check if plural
    if (transformation === 'plural' && generaltranslation.branches) {
      const newBranches: Record<string, any> = {};
      Object.entries(generaltranslation.branches).forEach(
        ([key, value]: any) => {
          newBranches[key] = writeChildrenAsObjects(value);
        }
      );
      newGTProp = { ...newGTProp, b: newBranches, t: 'p' };
    }
    if (transformation === 'branch' && generaltranslation.branches) {
      const newBranches: Record<string, any> = {};
      Object.entries(generaltranslation.branches).forEach(
        ([key, value]: any) => {
          newBranches[key] = writeChildrenAsObjects(value);
        }
      );
      newGTProp = { ...newGTProp, b: newBranches, t: 'b' };
    }

    objectElement.props.d = newGTProp;
  }
  if (props.children) {
    objectElement.props.c = writeChildrenAsObjects(props.children);
  }
  return objectElement;
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
  return Array.isArray(children)
    ? children.map(handleSingleChild)
    : handleSingleChild(children);
}
