import { BaseDocumentSerializer, BaseDocumentDeserializer } from '../index';
import {
  customSerializers,
  customDeserializers,
  customBlockDeserializers,
} from '../BaseSerializationConfig';
import { PortableTextBlock, SanityDocument, TypedObject } from 'sanity';
import { SerializedDocument, TranslationLevel } from '../types';
import schema from './__fixtures__/schema';
import clone from 'just-clone';

export const getSerialized = (
  document: SanityDocument,
  level: TranslationLevel
): SerializedDocument => {
  const serializer = BaseDocumentSerializer(schema);
  return serializer.serializeDocument(document, level);
};

export const getDeserialized = (
  document: SanityDocument,
  level: TranslationLevel
): Record<string, any> => {
  const serialized = getSerialized(document, level);
  const deserializer = BaseDocumentDeserializer;
  return deserializer.deserializeDocument(serialized.content);
};

export const getValidFields = (
  field: Record<string, any>
): Record<string, any> => {
  const invalidFields = ['_type', '_key'];
  return Object.keys(field).filter((key) => !invalidFields.includes(key));
};

export const toPlainText = (blocks: PortableTextBlock[]): string => {
  return blocks
    .map((block) => {
      if (block._type !== 'block' || !block.children) {
        return '';
      }
      return (block.children as Array<any>).map((child) => child.text).join('');
    })
    .join('\n\n');
};

export const createCustomInnerHTML = (title: string): string =>
  `Custom serializer works and includes title: '${title}'`;

const additionalSerializerTypes = {
  //block and top-level tests
  objectField: ({ value }: { value: TypedObject }) => {
    const innerText = createCustomInnerHTML(value.title as string);
    const html = `<div class="${value._type}" id="${value._key ?? value._id}">${innerText}</div>`;
    return html;
  },
  //inline-level tests
  childObjectField: ({ value }: { value: TypedObject }) => {
    const innerText = createCustomInnerHTML(value.title as string);
    const html = `<span class="${value._type}" id="${value._key ?? value._id}">${innerText}</span>`;
    return html;
  },
};

const tempSerializers = clone(customSerializers);
tempSerializers.types = {
  ...tempSerializers.types,
  ...additionalSerializerTypes,
};
tempSerializers.marks = {
  annotation: ({ value, markType, children }) => {
    return `<span class="${markType}" id="${value._key}">${children}</span>`;
  },
};

export const addedCustomSerializers = tempSerializers;

export const addedDeserializerTypes = {
  objectField: (html: HTMLElement): TypedObject => {
    const title = html.innerHTML.split(':')[1].replace(/'/g, '').trim();
    const _type = html.className;
    const _key = html.id;
    return { title, _type, _key };
  },
};

const tempDeserializers = clone(customDeserializers);
tempDeserializers.types = {
  ...tempDeserializers.types,
  ...addedDeserializerTypes,
};

export const addedCustomDeserializers = tempDeserializers;

export const addedBlockDeserializers = [
  ...customBlockDeserializers,
  {
    deserialize(el: HTMLElement): TypedObject | undefined {
      if (!el.className || el.className.toLowerCase() !== 'childobjectfield') {
        return undefined;
      }

      const title = el.innerHTML.split(':')[1].replace(/'/g, '').trim();
      const _type = el.className;
      const _key = el.id;

      return { title, _type, _key };
    },
  },
  {
    deserialize(
      el: HTMLElement,
      //eslint-disable-next-line no-undef -- not picking up NodeListOf/ChildNode
      next: (nodes: NodeListOf<ChildNode>) => any
    ): TypedObject | undefined {
      if (!el.className || el.className?.toLowerCase() !== 'annotation') {
        return undefined;
      }

      const markDef = {
        _key: el.id,
        _type: 'annotation',
      };

      return {
        _type: '__annotation',
        markDef: markDef,
        children: next(el.childNodes),
      };
    },
  },
];
