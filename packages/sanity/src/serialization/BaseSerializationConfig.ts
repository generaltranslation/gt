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
import { escapeHTML, INLINE_OBJECT_KEY_FIELD } from './helpers';
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
      `<${tag}${href}>${children}</${tag}>`,
      value as unknown as Record<string, unknown>,
      'markDef'
    );
  };

export const defaultMarks: Record<string, PortableTextMarkComponent> = {
  link: annotationMark(
    defaultComponents.marks.link as PortableTextMarkComponent
  ),
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
          `<span class="${value._type}">${INLINE_OBJECT_CONTENT}</span>`,
          value as unknown as Record<string, unknown>,
          'inlineObject'
        )
      : `<div class="${value._type}"></div>`,
  unknownMark: annotationMark(defaultComponents.unknownMark),
  types: {},
  marks: defaultMarks,
  block: defaultPortableTextBlockStyles,
  list: defaultLists,
  listItem: defaultListItem,
  unknownBlockStyle: unknownBlockFunc,
};

export const customDeserializers: CustomDeserializers = { types: {} };

export const customBlockDeserializers: Array<unknown> = [
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
  // handle marks with data-gt-internal
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

      if (!el.getAttribute('data-gt-internal')) {
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
      };
    },
  },
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

          //next(childNodes) plays poorly with custom styles, issue to be filed.
          if (customStyle) {
            return block as PortableTextTextBlock;
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
