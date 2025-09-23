// Adapted from https://github.com/sanity-io/sanity-naive-html-serializer

import {
  defaultStopTypes,
  customSerializers,
} from '../BaseSerializationConfig';
import { SanityDocument, TypedObject, Schema } from 'sanity';
import { TranslationLevel, SerializerClosure } from '../types';
import { fieldFilter, languageObjectFieldFilter } from './fieldFilters';
import { PortableTextTypeComponent, toHTML } from '@portabletext/to-html';

const META_FIELDS = ['_key', '_type', '_id', '_weak'];

export const BaseDocumentSerializer: SerializerClosure = (schemas: Schema) => {
  /*
   * Helper function that allows us to get metadata (like `localize: false`) from schema fields.
   */
  const getSchema = (name: string) =>
    schemas?._original?.types.find((s) => s.name === name) as any;

  const serializeObject = (
    obj: TypedObject,
    stopTypes: string[],
    serializers: Record<string, any>
  ) => {
    if (stopTypes.includes(obj._type)) {
      return '';
    }

    //if user has declared a custom serializer, use that
    //instead of this method
    const hasSerializer =
      serializers.types && Object.keys(serializers.types).includes(obj._type);
    if (hasSerializer) {
      return toHTML([obj], { components: serializers });
    }

    //we don't need to worry about PT types
    if (obj._type === 'span' || obj._type === 'block') {
      return toHTML(obj, { components: serializers });
    }

    //if schema is available, encode values in the order they're declared in the schema,
    //since this will likely be more intuitive for a translator.
    let fieldNames = Object.keys(obj).filter((key) => key !== '_type');
    const schema = getSchema(obj._type);
    if (schema && schema.fields) {
      fieldNames = schema.fields
        .map((field: Record<string, any>) => field.name)
        .filter((schemaKey: string) => Object.keys(obj).includes(schemaKey));
    }

    //account for anonymous inline objects
    if (typeof obj === 'object' && !obj._type) {
      obj._type = '';
    }

    //in some cases, we might recurse through many objects of the same type
    //we should take all methods necessary to ensure state does not persist
    //otherwise we risk using old serialization methods on new items
    const newSerializationMethods: Record<string, PortableTextTypeComponent> =
      {};
    const tempType = `${obj._type}__temp_type__${Math.random().toString(36).substring(7)}`;
    const objToSerialize: TypedObject = { _type: tempType };
    //for our default serialization method, we only need to
    //capture metadata. the rest will be recursively turned into strings.
    META_FIELDS.filter((f) => f !== '_type').forEach((field) => {
      objToSerialize[field] = obj[field];
    });

    let innerHTML = '';

    //if it's a custom object, iterate through its keys to find and serialize translatable content
    fieldNames.forEach((fieldName) => {
      let htmlField = '';

      if (!META_FIELDS.includes(fieldName)) {
        const value = obj[fieldName];
        //strings are either string fields or have recursively been turned
        //into HTML because they were a nested object or array
        if (typeof value === 'string') {
          const htmlRegex = new RegExp(/<("[^"]*"|'[^']*'|[^'">])*>/);
          if (htmlRegex.test(value)) {
            htmlField = value;
          } else {
            htmlField = `<span class="${fieldName}">${value}</span>`;
          }
        }

        //array fields get filtered and its children serialized
        else if (Array.isArray(value)) {
          htmlField = serializeArray(value, fieldName, stopTypes, {
            ...serializers,
            types: { ...serializers.types },
          });
        }

        //this is an object in an object, serialize it first
        else {
          const embeddedObject = value as TypedObject;
          const embeddedObjectSchema = getSchema(embeddedObject._type);
          let toTranslate = embeddedObject;
          if (embeddedObjectSchema && embeddedObjectSchema.fields) {
            toTranslate = fieldFilter(
              toTranslate,
              embeddedObjectSchema.fields,
              stopTypes
            );
          }
          const objHTML = serializeObject(toTranslate, stopTypes, {
            ...serializers,
            types: { ...serializers.types },
          });
          htmlField = `<div class="${fieldName}" data-level="field">${objHTML}</div>`;
        }

        innerHTML += htmlField;
      }
    });

    if (!innerHTML) {
      return '';
    }

    newSerializationMethods[tempType] = ({ value }: { value: TypedObject }) => {
      let div = `<div class="${value._type.split('__temp_type__')[0]}"`;
      if (value._key || value._id) {
        div += `id="${value._key ?? value._id}"`;
      }

      return [div, ` data-type="object">${innerHTML}</div>`].join('');
    };

    let serializedBlock = '';
    try {
      serializedBlock = toHTML(objToSerialize, {
        components: {
          ...serializers,
          types: {
            ...serializers.types,
            ...newSerializationMethods,
          },
        },
      });
    } catch (err) {
      //eslint-disable-next-line no-console -- this is a warning
      console.warn(
        `Had issues serializing block of type "${obj._type}". Please specify a serialization method for this block in your serialization config. Received error: ${err}`
      );
    }

    return serializedBlock;
  };

  const serializeArray = (
    fieldContent: Record<string, any>[],
    fieldName: string,
    stopTypes: string[],
    serializers: Record<string, any>
  ) => {
    //filter for any blocks that user has indicated
    //should not be sent for translation
    const validBlocks = fieldContent.filter(
      (block) => !stopTypes.includes(block._type)
    );

    //take out any fields in these blocks that should
    //not be sent to translation
    const filteredBlocks = validBlocks.map((block) => {
      const schema = getSchema(block._type);
      if (schema && schema.fields) {
        return fieldFilter(block, schema.fields, stopTypes);
      }
      return block;
    });

    const output = filteredBlocks.map((obj) => {
      //if object in array is just a string, just return it
      if (typeof obj === 'string') {
        return `<span>${obj}</span>`;
      }
      //send to serialization method
      return serializeObject(obj as TypedObject, stopTypes, serializers);
    });

    //encode this with data-level field
    return `<div class="${fieldName}" data-type="array">${output.join('')}</div>`;
  };

  /*
   * Main parent function: finds fields to translate, and feeds them to appropriate child serialization
   * methods.
   */
  const serializeDocument = (
    doc: SanityDocument,
    translationLevel: TranslationLevel = 'document',
    baseLang = 'en',
    stopTypes = defaultStopTypes,
    serializers = customSerializers
  ) => {
    const schema = getSchema(doc._type);
    let filteredObj: Record<string, any> = {};

    //field level translations explicitly send over any fields that
    //match the base language, regardless of depth
    if (translationLevel === 'field') {
      filteredObj = languageObjectFieldFilter(doc, baseLang);
    }
    //otherwise, we can refer to the schema and a list of stop types
    //to determine what should not be sent
    else {
      filteredObj = fieldFilter(doc, schema.fields, stopTypes);
    }

    const serializedFields: Record<string, any> = {};

    for (const key in filteredObj) {
      if (filteredObj.hasOwnProperty(key) === false) continue;
      const value: Record<string, any> | Array<any> | string = filteredObj[key];

      if (typeof value === 'string') {
        serializedFields[key] = value;
      } else if (Array.isArray(value)) {
        serializedFields[key] = serializeArray(
          value,
          key,
          stopTypes,
          serializers
        );
      } else if (
        value &&
        !stopTypes.find((stopType) => stopType == value?._type)
      ) {
        const serialized = serializeObject(
          value as TypedObject,
          stopTypes,
          serializers
        );
        serializedFields[key] =
          `<div class="${key}" data-level='field'>${serialized}</div>`;
      }
    }

    //create a valid HTML file
    const rawHTMLBody = document.createElement('body');
    rawHTMLBody.innerHTML = serializeObject(
      serializedFields as TypedObject,
      stopTypes,
      serializers
    );

    const rawHTMLHead = document.createElement('head');
    const metaFields = ['_id', '_type', '_rev'];
    //save our metadata as meta tags so we can use them later on
    metaFields.forEach((field) => {
      const metaEl = document.createElement('meta');
      metaEl.setAttribute('name', field);
      metaEl.setAttribute('content', doc[field] as string);
      rawHTMLHead.appendChild(metaEl);
    });
    //encode version so we can use the correct deserialization methods
    const versionMeta = document.createElement('meta');
    versionMeta.setAttribute('name', 'version');
    versionMeta.setAttribute('content', '3');
    rawHTMLHead.appendChild(versionMeta);

    const rawHTML = document.createElement('html');
    rawHTML.appendChild(rawHTMLHead);
    rawHTML.appendChild(rawHTMLBody);

    return {
      name: doc._id,
      content: rawHTML.outerHTML,
    };
  };

  return {
    serializeDocument,
    fieldFilter,
    languageObjectFieldFilter,
    serializeArray,
    serializeObject,
  };
};
