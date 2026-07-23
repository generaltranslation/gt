// Adapted from https://github.com/sanity-io/sanity-naive-html-serializer

import {
  defaultStopTypes,
  customSerializers,
} from '../BaseSerializationConfig';
import { ObjectField, SanityDocument, TypedObject, Schema } from 'sanity';
import { TranslationLevel } from '../types';
import {
  fieldFilter,
  isFieldExcludedFromTranslation,
  isTypeExcludedByOptions,
  languageObjectFieldFilter,
} from './fieldFilters';
import {
  PortableTextHtmlComponents,
  PortableTextTypeComponent,
  toHTML,
} from '@portabletext/to-html';
import { libraryDefaultLocale } from 'generaltranslation/internal';

const META_FIELDS = ['_key', '_type', '_id', '_weak'];

type SchemaTypeWithFields = {
  type?: unknown;
  fields?: ObjectField[];
  options?: unknown;
};

/**
 * A raw (uncompiled) schema field or array-member definition. Inline object
 * declarations carry their `fields` here, and array declarations carry their
 * member definitions in `of`.
 */
type RawFieldDef = {
  name?: string;
  type?: string;
  fields?: ObjectField[];
  of?: RawFieldDef[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const BaseDocumentSerializer = (schemas: Schema) => {
  /*
   * Helper function that allows us to get metadata (like `localize: false`) from schema fields.
   */
  const getSchema = (name: string): SchemaTypeWithFields | undefined =>
    schemas?._original?.types.find((s) => s.name === name) as
      | SchemaTypeWithFields
      | undefined;

  /*
   * Resolve a type name to its declared fields, following chains of type
   * aliases (a type whose definition just references another named type).
   */
  const resolveSchemaFields = (
    typeName: string | undefined
  ): ObjectField[] | undefined => {
    const seen = new Set<string>();
    let current = typeName;
    while (current && !seen.has(current)) {
      seen.add(current);
      const typeDef = getSchema(current);
      if (!typeDef) return undefined;
      if (typeDef.fields) return typeDef.fields;
      current = typeof typeDef.type === 'string' ? typeDef.type : undefined;
    }
    return undefined;
  };

  const serializeObject = (
    obj: TypedObject,
    stopTypes: string[],
    serializers: Partial<PortableTextHtmlComponents>,
    // Declared fields from the enclosing field or array-member definition.
    // Used when the value itself resolves to no schema type — anonymous
    // inline objects carry no `_type`.
    declaredFields?: ObjectField[]
  ) => {
    if (stopTypes.includes(obj._type)) {
      return '';
    }

    // The exclusion options also apply to a type definition's own `options`
    // ("this field or type" in the native plugins' semantics), including
    // through chains of type aliases.
    if (isTypeExcludedByOptions(obj._type, getSchema)) {
      return '';
    }

    //if user has declared a custom serializer, use that
    //instead of this method
    const typeSerializers = isRecord(serializers.types)
      ? serializers.types
      : ({} as PortableTextHtmlComponents['types']);
    const hasSerializer = Object.keys(typeSerializers).includes(obj._type);
    if (hasSerializer) {
      return toHTML([obj], { components: serializers });
    }

    //we don't need to worry about PT types
    if (obj._type === 'span' || obj._type === 'block') {
      return toHTML(obj, { components: serializers });
    }

    //if schema is available, encode values in the order they're declared in the schema,
    //since this will likely be more intuitive for a translator.
    //fields the schema excludes from translation (localize: false or an
    //options exclusion) are dropped here so exclusion applies at any depth.
    let fieldNames = Object.keys(obj).filter((key) => key !== '_type');
    const resolvedFields = resolveSchemaFields(obj._type);
    if (resolvedFields) {
      fieldNames = resolvedFields
        .filter((field) => !isFieldExcludedFromTranslation(field, getSchema))
        .map((field) => field.name)
        .filter((schemaKey) => Object.keys(obj).includes(schemaKey));
    } else if (declaredFields) {
      //anonymous inline objects have no schema type of their own; keep every
      //runtime key (undeclared data still round-trips) but drop keys whose
      //inline declaration excludes them from translation
      const excludedNames = new Set(
        declaredFields
          .filter((field) => isFieldExcludedFromTranslation(field, getSchema))
          .map((field) => field.name)
      );
      fieldNames = fieldNames.filter((name) => !excludedNames.has(name));
    }
    const knownFields = resolvedFields ?? declaredFields;

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
        const fieldDef = knownFields?.find(
          (field) => field.name === fieldName
        ) as RawFieldDef | undefined;
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
          htmlField = serializeArray(
            value,
            fieldName,
            stopTypes,
            {
              ...serializers,
              types: { ...typeSerializers },
            },
            fieldDef?.of
          );
        }

        //this is an object in an object, serialize it first
        else if (isRecord(value)) {
          const embeddedObject = value as TypedObject;
          const embeddedFields = resolveSchemaFields(embeddedObject._type);
          let toTranslate = embeddedObject;
          if (embeddedFields) {
            toTranslate = fieldFilter(
              toTranslate,
              embeddedFields,
              stopTypes,
              getSchema
            );
          }
          const objHTML = serializeObject(
            toTranslate,
            stopTypes,
            {
              ...serializers,
              types: { ...typeSerializers },
            },
            fieldDef?.fields
          );
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
            ...typeSerializers,
            ...newSerializationMethods,
          },
        },
      });
    } catch (err) {
      //eslint-disable-next-line no-console -- this is a warning
      console.warn(
        `Had issues serializing block of type "${obj._type}". Specify a serialization method for this block in your serialization config. Received error: ${err}`
      );
    }

    return serializedBlock;
  };

  const serializeArray = (
    fieldContent: Array<Record<string, unknown> | string>,
    fieldName: string,
    stopTypes: string[],
    serializers: Partial<PortableTextHtmlComponents>,
    // Declared member definitions (the array field's `of`), used to resolve
    // fields of anonymous inline object members that carry no schema type.
    memberDefs?: RawFieldDef[]
  ) => {
    //filter for any blocks that user has indicated
    //should not be sent for translation
    const validBlocks = fieldContent.filter(
      (block) =>
        typeof block === 'string' ||
        typeof block._type !== 'string' ||
        !stopTypes.includes(block._type)
    );

    //fields declared inline on the matching array-member definition
    const declaredMemberFields = (
      blockType: string | undefined
    ): ObjectField[] | undefined => {
      if (!memberDefs?.length) return undefined;
      const byName = memberDefs.find(
        (def) => def.name === blockType || def.type === blockType
      );
      if (byName?.fields) return byName.fields;
      if (!blockType && memberDefs.length === 1) return memberDefs[0].fields;
      return undefined;
    };

    const output = validBlocks.map((block) => {
      //if object in array is just a string, just return it
      if (typeof block === 'string') {
        return `<span>${block}</span>`;
      }
      //take out any fields in this block that should
      //not be sent to translation
      const blockType =
        typeof block._type === 'string' ? block._type : undefined;
      const memberFields = resolveSchemaFields(blockType);
      const filtered = memberFields
        ? fieldFilter(block, memberFields, stopTypes, getSchema)
        : block;
      //send to serialization method
      return serializeObject(
        filtered as TypedObject,
        stopTypes,
        serializers,
        declaredMemberFields(blockType)
      );
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
    baseLang: string = libraryDefaultLocale,
    stopTypes = defaultStopTypes,
    serializers = customSerializers
  ) => {
    const schema = getSchema(doc._type);
    let filteredObj: Record<string, unknown> = {};

    //field level translations explicitly send over any fields that
    //match the base language, regardless of depth
    if (translationLevel === 'field') {
      filteredObj = languageObjectFieldFilter(doc, baseLang);
    }
    //otherwise, we can refer to the schema and a list of stop types
    //to determine what should not be sent
    else {
      filteredObj = fieldFilter(
        doc,
        schema?.fields ?? [],
        stopTypes,
        getSchema
      );
    }

    const serializedFields: Record<string, unknown> = {};

    for (const key in filteredObj) {
      if (filteredObj.hasOwnProperty(key) === false) continue;
      const value = filteredObj[key];
      const fieldDef = schema?.fields?.find((field) => field.name === key) as
        | RawFieldDef
        | undefined;

      if (typeof value === 'string') {
        serializedFields[key] = value;
      } else if (Array.isArray(value)) {
        serializedFields[key] = serializeArray(
          value.filter(
            (item): item is Record<string, unknown> | string =>
              typeof item === 'string' || isRecord(item)
          ),
          key,
          stopTypes,
          serializers,
          fieldDef?.of
        );
      } else if (
        value &&
        isRecord(value) &&
        !stopTypes.find((stopType) => stopType == value?._type)
      ) {
        const serialized = serializeObject(
          value as TypedObject,
          stopTypes,
          serializers,
          fieldDef?.fields
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
