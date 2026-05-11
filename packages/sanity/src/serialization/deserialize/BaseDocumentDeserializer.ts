// Adapted from https://github.com/sanity-io/sanity-naive-html-serializer
import { htmlToBlocks } from '@portabletext/block-tools';
import {
  customDeserializers,
  customBlockDeserializers,
} from '../BaseSerializationConfig';
import { CustomDeserializers, Deserializer } from '../types';
import { blockContentType, preprocess } from './helpers';
import { mergeBlocks } from '../helpers';

export const deserializeArray = (
  arrayHTML: Element,
  deserializers: CustomDeserializers = customDeserializers,
  blockDeserializers: Array<unknown> = customBlockDeserializers
) => {
  const output: unknown[] = [];
  const children = Array.from(arrayHTML.children);
  children.forEach((child) => {
    let deserializedObject: unknown;
    try {
      if (child.tagName?.toLowerCase() === 'span') {
        deserializedObject = preprocess(child.innerHTML);
      }
      //has specific class name or data type, so it's an obj
      else if (
        child.className ||
        child.getAttribute('data-type') === 'object'
      ) {
        deserializedObject = deserializeObject(
          child,
          deserializers,
          blockDeserializers
        );
        if (
          deserializedObject &&
          typeof deserializedObject === 'object' &&
          !Array.isArray(deserializedObject)
        ) {
          (deserializedObject as Record<string, unknown>)._key = child.id;
        }
      } else {
        const blocks = htmlToBlocks(child.outerHTML, blockContentType, {
          rules: blockDeserializers as NonNullable<
            Parameters<typeof htmlToBlocks>[2]
          >['rules'],
        });
        deserializedObject = mergeBlocks(
          blocks as unknown as Parameters<typeof mergeBlocks>[0]
        );
        (deserializedObject as Record<string, unknown>)._key = child.id;
      }
    } catch (e) {
      //eslint-disable-next-line no-console
      console.debug(
        `Tried to deserialize block: ${child.outerHTML} in an array but failed to identify it! Error: ${e}`
      );
    }
    output.push(deserializedObject);
  });
  return output;
};

export const deserializeObject = (
  objectHTML: Element,
  deserializers: CustomDeserializers = customDeserializers,
  blockDeserializers: Array<unknown> = customBlockDeserializers
) => {
  const deserialize = deserializers.types?.[objectHTML.className];
  if (deserialize) {
    return deserialize(objectHTML as HTMLElement);
  }

  const output: Record<string, unknown> = {};
  //account for anonymous inline objects
  if (objectHTML.className) {
    output._type = objectHTML.className;
  }
  const children = Array.from(objectHTML.children);

  children.forEach((child) => {
    //string field
    if (child.tagName?.toLowerCase() === 'span') {
      output[child.className] = preprocess(child.innerHTML);
    }
    //richer field, either object or array
    else if (child.getAttribute('data-level') === 'field') {
      const deserialized = deserializeHTML(
        child.outerHTML,
        deserializers,
        blockDeserializers
      );
      if (deserialized && Object.keys(deserialized).length) {
        output[child.className] = deserialized;
      } else {
        //eslint-disable-next-line no-console
        console.debug(
          `Deserializer: Skipping empty or unreadable HTML: ${child.outerHTML}`
        );
      }
    } else if (child.getAttribute('data-type') === 'array') {
      output[child.className] = deserializeArray(
        child,
        deserializers,
        blockDeserializers
      );
    }
  });
  return output;
};

export const deserializeHTML = (
  html: string,
  deserializers: CustomDeserializers,
  blockDeserializers: Array<unknown>
): Record<string, unknown> | unknown[] => {
  //parent node is always div with classname of field -- get its child
  let HTMLnode = new DOMParser().parseFromString(html, 'text/html').body
    .children[0];

  //catch embedded object as a field
  if (HTMLnode?.getAttribute('data-level') === 'field') {
    HTMLnode = HTMLnode.children[0];
  }

  if (!HTMLnode) {
    return {};
  }

  let output: Record<string, unknown> | unknown[];

  //prioritize custom deserialization
  const deserialize = deserializers.types?.[HTMLnode.className];
  if (deserialize) {
    output = deserialize(HTMLnode as HTMLElement);
  } else if (HTMLnode.getAttribute('data-type') === 'object') {
    output = deserializeObject(HTMLnode, deserializers, blockDeserializers);
  } else if (HTMLnode.getAttribute('data-type') === 'array') {
    output = deserializeArray(HTMLnode, deserializers, blockDeserializers);
  } else {
    output = {};
    //eslint-disable-next-line no-console
    console.debug(
      `Tried to deserialize block ${HTMLnode.outerHTML} but failed to identify it!`
    );
  }

  return output;
};

export const deserializeDocument = <
  TDocument extends Record<string, unknown> = Record<string, unknown>,
>(
  serializedDoc: string,
  deserializers: CustomDeserializers = customDeserializers,
  blockDeserializers: Array<unknown> = customBlockDeserializers
): TDocument => {
  const metadata: Record<string, unknown> = {};
  const head = new DOMParser().parseFromString(serializedDoc, 'text/html').head;

  Array.from(head.children).forEach((metaTag) => {
    const validTags = ['_id', '_rev', '_type'];
    const metaName = metaTag.getAttribute('name');
    if (metaName && validTags.includes(metaName)) {
      metadata[metaName] = metaTag.getAttribute('content');
    }
  });

  const content = deserializeHTML(
    serializedDoc,
    deserializers,
    blockDeserializers
  ) as Record<string, unknown>;

  return {
    ...content,
    ...metadata,
  } as TDocument;
};

export const BaseDocumentDeserializer: Deserializer = {
  deserializeDocument,
  deserializeHTML,
};
