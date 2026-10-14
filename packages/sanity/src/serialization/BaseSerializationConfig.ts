// Adapted from https://github.com/sanity-io/sanity-naive-html-serializer

import type { PortableTextBlockStyle } from '@portabletext/types';

import {
  defaultComponents,
  PortableTextBlockComponent,
  PortableTextListComponent,
  PortableTextListItemComponent,
  PortableTextMarkComponent,
  PortableTextHtmlComponents,
} from '@portabletext/to-html';

import { htmlToBlocks } from '@portabletext/block-tools';
import { blockContentType } from './deserialize/helpers';
import { PortableTextTextBlock, TypedObject } from 'sanity';
import { attachGTData, detachGTData } from './data';
import {
  escapeHTML,
  INLINE_OBJECT_KEY_FIELD,
  MARKED_LINE_BREAK,
} from './helpers';
import type { CustomDeserializers } from './types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const defaultStopTypes = [
  'reference',
  'date',
  'datetime',
  'file',
  'geopoint',
  'image',
  'number',
  'crop',
  'hotspot',
  'boolean',
  'url',
  'color',
  'code',
];

/**
 * Annotations (marks backed by an entry in the block's `markDefs`, such as
 * links) carry their whole markDef, so every field and the original `_key`
 * survive the round trip. Decorators keep the default rendering.
 */
// Marks annotations exported by the built-in serializers. They are restored
// after the user's additionalBlockDeserializers, so a user rule for `<a>`
// still sees every link first.
const BUILTIN_ATTRIBUTE = 'data-gt-builtin';

const annotationMark =
  (
    fallback: PortableTextMarkComponent
  ): PortableTextMarkComponent<TypedObject> =>
  (props) => {
    const { value, children, markType } = props;
    if (!(isRecord(value) && typeof value._key === 'string')) {
      return fallback(props);
    }
    // keep href on links as context for the translator
    const href =
      markType === 'link' && typeof value.href === 'string'
        ? ` href="${escapeHTML(value.href)}"`
        : '';
    const tag = markType === 'link' ? 'a' : 'span';
    return attachGTData(
      `<${tag}${href} ${BUILTIN_ATTRIBUTE}="">${children}</${tag}>`,
      value as unknown as Record<string, unknown>,
      'markDef'
    );
  };

/**
 * Decorators without a standard HTML element are carried by name, so custom
 * decorators survive the round trip.
 */
const DECORATOR_ATTRIBUTE = 'data-gt-decorator';

const decoratorMark: PortableTextMarkComponent = ({ children, markType }) =>
  `<span ${DECORATOR_ATTRIBUTE}="${escapeHTML(markType)}">${children}</span>`;

// Decorators rendered as their own element. block-tools only restores the
// ones the generic import schema declares, so these are restored by name
// (fallbackBlockDeserializers).
const DECORATOR_ELEMENTS: Record<string, string> = {
  sup: 'sup',
  sub: 'sub',
  u: 'underline',
};

export const defaultMarks: Record<string, PortableTextMarkComponent> = {
  link: annotationMark(
    defaultComponents.marks.link as PortableTextMarkComponent
  ),
  // annotations share the mark registry, so an annotation named like one of
  // these decorators keeps its markDef
  sup: annotationMark(({ children }) => `<sup>${children}</sup>`),
  sub: annotationMark(({ children }) => `<sub>${children}</sub>`),
  underline: annotationMark(({ children }) => `<u>${children}</u>`),
};

export const defaultPortableTextBlockStyles: Record<
  PortableTextBlockStyle,
  PortableTextBlockComponent | undefined
> = {
  normal: ({ value, children }) => `<p id="${value._key}">${children}</p>`,
  blockquote: ({ value, children }) =>
    `<blockquote id="${value._key}">${children}</blockquote>`,
  h1: ({ value, children }) => `<h1 id="${value._key}">${children}</h1>`,
  h2: ({ value, children }) => `<h2 id="${value._key}">${children}</h2>`,
  h3: ({ value, children }) => `<h3 id="${value._key}">${children}</h3>`,
  h4: ({ value, children }) => `<h4 id="${value._key}">${children}</h4>`,
  h5: ({ value, children }) => `<h5 id="${value._key}">${children}</h5>`,
  h6: ({ value, children }) => `<h6 id="${value._key}">${children}</h6>`,
};

const defaultLists: Record<'number' | 'bullet', PortableTextListComponent> = {
  number: ({ value, children }) =>
    `<ol id="${value._key.replace('-parent', '')}">${children}</ol>`,
  bullet: ({ value, children }) =>
    `<ul id="${value._key.replace('-parent', '')}">${children}</ul>`,
};

const defaultListItem: PortableTextListItemComponent = ({
  value,
  children,
}) => {
  const { _key, level } = value;
  return `<li id="${(_key || '').replace('-parent', '')}" data-level="${level}">${children}</li>`;
};

const unknownBlockFunc: PortableTextBlockComponent = ({ value, children }) =>
  `<p id="${value._key}" data-type="unknown-block-style" data-style="${value.style}">${children}</p>`;

const INLINE_OBJECT_CONTENT = '\u200B';

export const customSerializers: Partial<PortableTextHtmlComponents> = {
  // Inline objects must stay inline: a <div> inside a <p> closes the
  // paragraph and the rest of its text is dropped on import. The object is
  // carried as data and restored by the inline-object rule below. The
  // zero-width space keeps the span non-empty: HTML formatters (GT's
  // included) collapse the spaces on both sides of an empty element into one.
  unknownType: ({ value, isInline }) =>
    isInline
      ? attachGTData(
          `<span class="${escapeHTML(value._type)}">${INLINE_OBJECT_CONTENT}</span>`,
          value as unknown as Record<string, unknown>,
          'inlineObject'
        )
      : `<div class="${escapeHTML(value._type)}"></div>`,
  unknownMark: annotationMark(decoratorMark),
  types: {},
  marks: defaultMarks,
  block: defaultPortableTextBlockStyles,
  list: defaultLists,
  listItem: defaultListItem,
  unknownBlockStyle: unknownBlockFunc,
};

export const customDeserializers: CustomDeserializers = { types: {} };

// Inline elements Portable Text marks are rendered as
const MARK_ELEMENTS = new Set([
  'a',
  'b',
  'code',
  'del',
  'em',
  'i',
  's',
  'span',
  'strike',
  'strong',
  'sub',
  'sup',
  'u',
]);

// Restores an annotation from the markDef attached to its element
const markDefRule = (claims: (el: HTMLElement) => boolean) => ({
  deserialize(
    node: Node,
    next: (
      elements: Node | Node[] | NodeList
    ) => TypedObject | TypedObject[] | undefined
  ): TypedObject | undefined {
    if (node.nodeType !== 1) {
      return undefined;
    }
    const el = node as HTMLElement;
    if (
      !el.hasChildNodes() ||
      !el.getAttribute('data-gt-internal') ||
      !claims(el)
    ) {
      return undefined;
    }

    const markDef = detachGTData(el.outerHTML).data?.markDef;
    if (!isRecord(markDef) || typeof markDef._key !== 'string') {
      return undefined;
    }

    // block-tools' inline annotation form: the markDef (with its original
    // _key) is added to the enclosing block and applied to every child,
    // without splitting the block or trimming whitespace around it
    return {
      _type: '__annotation',
      markDef,
      children: next(el.childNodes),
    } as TypedObject;
  },
});

const decoratorRule = (
  decoratorName: (el: HTMLElement) => string | null | undefined
) => ({
  deserialize(
    node: Node,
    next: (
      elements: Node | Node[] | NodeList
    ) => TypedObject | TypedObject[] | undefined
  ): TypedObject | undefined {
    if (node.nodeType !== 1) {
      return undefined;
    }
    const name = decoratorName(node as HTMLElement);
    if (!name) {
      return undefined;
    }
    return {
      _type: '__decorator',
      name,
      children: next(node.childNodes),
    } as TypedObject;
  },
});

export const customBlockDeserializers: Array<unknown> = [
  // keep whitespace-only text inside a mark (`Note:<strong> </strong>The`,
  // or next to a nested mark: `<strong><em>Note:</em> </strong>The`):
  // block-tools drops it and glues the words on either side together
  {
    deserialize(node: Node): TypedObject | undefined {
      const parent = node.parentElement;
      if (
        node.nodeType !== 3 ||
        !node.textContent ||
        node.textContent.trim() ||
        !parent ||
        !MARK_ELEMENTS.has(parent.tagName.toLowerCase())
      ) {
        return undefined;
      }
      return {
        _type: 'span',
        marks: [],
        text: node.textContent.replace(/[\t\n\f\r ]+/g, ' '),
      } as TypedObject;
    },
  },
  // handle inline objects with data-gt-internal
  {
    deserialize(node: Node): TypedObject | undefined {
      if (node.nodeType !== 1) {
        return undefined;
      }
      const el = node as HTMLElement;
      if (!el.getAttribute('data-gt-internal')) {
        return undefined;
      }
      const inlineObject = detachGTData(el.outerHTML).data?.inlineObject;
      if (!isRecord(inlineObject) || typeof inlineObject._type !== 'string') {
        return undefined;
      }
      // htmlToBlocks re-keys every child; the original key is restored once
      // the block is built (restoreInlineObjectKeys)
      return {
        ...inlineObject,
        _type: inlineObject._type,
        [INLINE_OBJECT_KEY_FIELD]: inlineObject._key,
      };
    },
  },
  // handle marks with data-gt-internal from a user's serializer
  // (attachGTData); the built-in ones are in fallbackBlockDeserializers
  markDefRule((el) => !el.hasAttribute(BUILTIN_ATTRIBUTE)),
  // handle decorators, whether or not the generic import schema declares them
  decoratorRule((el) => el.getAttribute(DECORATOR_ATTRIBUTE)),
  //handle undeclared styles
  {
    deserialize(
      node: Node,
      next: (
        elements: Node | Node[] | NodeList
      ) => TypedObject | TypedObject[] | undefined
    ): PortableTextTextBlock | TypedObject | undefined {
      if (node.nodeType !== 1) {
        return undefined;
      }
      const el = node as HTMLElement;
      if (!el.hasChildNodes()) {
        return undefined;
      }

      if (el.getAttribute('data-type') !== 'unknown-block-style') {
        return undefined;
      }

      const style = el.getAttribute('data-style') ?? '';
      const block = htmlToBlocks(el.outerHTML, blockContentType)[0];

      return {
        ...block,
        style,
        children: next(el.childNodes),
      };
    },
  },
  //handle list items
  {
    deserialize(
      node: Node,
      next: (
        elements: Node | Node[] | NodeList
      ) => TypedObject | TypedObject[] | undefined
    ): PortableTextTextBlock | TypedObject | undefined {
      if (node.nodeType !== 1) {
        return undefined;
      }
      const el = node as HTMLElement;
      if (!el.hasChildNodes()) {
        return undefined;
      }

      if (el.tagName.toLowerCase() !== 'li') {
        return undefined;
      }

      const tagsToStyle: Record<string, string> = {
        ul: 'bullet',
        ol: 'number',
      };

      const parent = el.parentNode as HTMLUListElement | HTMLOListElement;
      if (!parent || !parent.tagName) {
        return undefined;
      }

      const listItem = tagsToStyle[parent.tagName.toLowerCase()];
      if (!listItem) {
        return undefined;
      }

      const level =
        el.getAttribute('data-level') &&
        parseInt(el.getAttribute('data-level') || '0', 10);
      const _key = el.id;
      let block = htmlToBlocks(parent.outerHTML, blockContentType)[0];
      const customStyle = el.children?.[0]?.getAttribute('data-style');

      //check if the object inside is also serialized -- that means it has a style
      //or custom annotation and we should use childNode serialization
      const regex = new RegExp(/<("[^"]*"|'[^']*'|[^'">])*>/);
      if (regex.test(el.innerHTML)) {
        const newBlock = htmlToBlocks(el.innerHTML, blockContentType)[0];
        if (newBlock) {
          block = {
            ...block,
            ...newBlock,
            // @ts-ignore
            style: customStyle ?? (newBlock as PortableTextTextBlock).style,
          };

          //a custom style wraps the item's content in its own element; read
          //that element's children so inline objects and annotations are
          //restored by the rules above
          if (customStyle) {
            return {
              ...block,
              level,
              _key,
              listItem,
              children: next(el.children[0].childNodes),
            };
          }
        }
      }

      return {
        ...block,
        level,
        _key,
        listItem,
        children: next(el.childNodes),
      };
    },
  },
];

// Rules that run after the user's additionalBlockDeserializers, so a user
// rule can claim the elements the built-in serializers export, and
// <sup>, <sub>, <u> or <br>
export const fallbackBlockDeserializers: Array<unknown> = [
  markDefRule((el) => el.hasAttribute(BUILTIN_ATTRIBUTE)),
  decoratorRule((el) => DECORATOR_ELEMENTS[el.tagName.toLowerCase()]),
  // a line break inside a mark (`<em>one<br>two</em>`) keeps that mark; one
  // between marks (`<em>one</em><br><em>two</em>`) stays unmarked
  {
    deserialize(node: Node): TypedObject | undefined {
      const parent = node.parentElement;
      if (
        node.nodeName !== 'BR' ||
        !parent ||
        !MARK_ELEMENTS.has(parent.tagName.toLowerCase())
      ) {
        return undefined;
      }
      return {
        _type: 'span',
        marks: [],
        text: MARKED_LINE_BREAK,
      } as TypedObject;
    },
  },
];
