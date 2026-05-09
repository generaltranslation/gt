// Adapted from https://github.com/sanity-io/sanity-naive-html-serializer

import type { PortableTextBlockStyle } from '@portabletext/types';

import {
  PortableTextBlockComponent,
  PortableTextListComponent,
  PortableTextListItemComponent,
  PortableTextMarkComponent,
  PortableTextHtmlComponents,
} from '@portabletext/to-html';

import { htmlToBlocks } from '@portabletext/block-tools';
import { blockContentType } from './deserialize/helpers';
import { PortableTextObject, PortableTextTextBlock, TypedObject } from 'sanity';
import { detachGTData } from './data';
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

export const defaultMarks: Record<string, PortableTextMarkComponent> = {};

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

export const customSerializers: Partial<PortableTextHtmlComponents> = {
  unknownType: ({ value }) => `<div class="${value._type}"></div>`,
  types: {},
  marks: defaultMarks,
  block: defaultPortableTextBlockStyles,
  list: defaultLists,
  listItem: defaultListItem,
  unknownBlockStyle: unknownBlockFunc,
};

export const customDeserializers: CustomDeserializers = { types: {} };

export const customBlockDeserializers: Array<unknown> = [
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

      const { html, data } = detachGTData(el.outerHTML);
      const block = htmlToBlocks(html, blockContentType)[0];

      const children = next(el.childNodes);

      let markDefs: PortableTextObject[] = [];
      if ('markDefs' in block) {
        markDefs = (block.markDefs as PortableTextObject[]) ?? [];
      }
      if (data?.markDef) {
        markDefs.push(data.markDef as PortableTextObject);
      }
      if (Array.isArray(children)) {
        children.forEach((child) => {
          if (!isRecord(child)) {
            return;
          }
          const marks = Array.isArray(child.marks) ? child.marks : [];
          child.marks = data?.markDef?._key
            ? [...marks, data.markDef._key]
            : marks;
        });
      }
      // Resolve marks in the child nodes
      const output = {
        ...block,
        markDefs,
        children,
      };
      return output;
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
