// Adapted from https://github.com/sanity-io/sanity-naive-html-serializer

import { ObjectField, TypedObject } from 'sanity';

const META_FIELDS = ['_key', '_type', '_id'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/*
 * Helper. If field-level translation pattern used, only sends over
 * content from the base language. Works recursively, so if users
 * use this pattern several layers deep, base language fields will still be found.
 */
export const languageObjectFieldFilter = (
  obj: Record<string, unknown>,
  baseLang: string
): Record<string, unknown> => {
  const filterToLangField = (childObj: Record<string, unknown>) => {
    const filteredObj: Record<string, unknown> = {};
    filteredObj[baseLang] = childObj[baseLang];
    META_FIELDS.forEach((field) => {
      if (childObj[field]) {
        filteredObj[field] = childObj[field];
      }
    });
    return filteredObj;
  };

  const findBaseLang = (
    childObj: Record<string, unknown>
  ): Record<string, unknown> => {
    const filteredObj: Record<string, unknown> = {};
    META_FIELDS.forEach((field) => {
      if (childObj[field]) {
        filteredObj[field] = childObj[field];
      }
    });

    for (const key in childObj) {
      if (childObj.hasOwnProperty(key)) {
        const value: unknown = childObj[key];
        //we've reached a base language field, add it to
        //what we want to send to translation
        if (isRecord(value) && Object.hasOwn(value, baseLang)) {
          filteredObj[key] = filterToLangField(value);
        }
        //we have an array that may have language fields in its objects
        else if (
          Array.isArray(value) &&
          value.length &&
          typeof value[0] === 'object'
        ) {
          //recursively find and filter for any objects that have the base language
          const validLangObjects = value.reduce<Record<string, unknown>[]>(
            (validArr, objInArray) => {
              if (!isRecord(objInArray)) {
                return validArr;
              }
              if (objInArray._type === 'block') {
                validArr.push(objInArray);
              } else if (Object.hasOwn(objInArray, baseLang)) {
                validArr.push(filterToLangField(objInArray));
              } else {
                const filtered = findBaseLang(objInArray);
                const nonMetaFields = Object.keys(filtered).filter(
                  (objInArrayKey) => META_FIELDS.indexOf(objInArrayKey) === -1
                );
                if (nonMetaFields.length) {
                  validArr.push(filtered);
                }
              }
              return validArr;
            },
            []
          );
          if (validLangObjects.length) {
            filteredObj[key] = validLangObjects;
          }
        }
        //we have an object nested in an object
        //recurse down the tree
        else if (isRecord(value)) {
          const nestedLangObj = findBaseLang(value);
          const nonMetaFields = Object.keys(nestedLangObj).filter(
            (nestedObjKey) => META_FIELDS.indexOf(nestedObjKey) === -1
          );
          if (nonMetaFields.length) {
            filteredObj[key] = nestedLangObj;
          }
        }
      }
    }
    return filteredObj;
  };

  //send top level object into recursive function
  return findBaseLang(obj);
};

/**
 * Schema `options` namespaces that can exclude a field from translation.
 * `gt.exclude` is gt-sanity's own; `documentInternationalization.exclude`
 * (@sanity/document-internationalization) and `aiAssist.exclude`
 * (@sanity/assist) are honored so studios don't have to maintain a second
 * exclusion pattern for GT.
 */
type FieldExclusionOptions = {
  gt?: { exclude?: boolean };
  documentInternationalization?: { exclude?: boolean };
  aiAssist?: { exclude?: boolean };
};

export const isFieldExcludedByOptions = (options: unknown): boolean => {
  if (!isRecord(options)) return false;
  const exclusionOptions = options as FieldExclusionOptions;
  return (
    exclusionOptions.gt?.exclude === true ||
    exclusionOptions.documentInternationalization?.exclude === true ||
    exclusionOptions.aiAssist?.exclude === true
  );
};

/**
 * A schema field is excluded from translation either by the legacy
 * `localize: false` field property or by one of the `options` namespaces.
 */
export const isFieldExcludedFromTranslation = (field: ObjectField): boolean => {
  const fieldMetadata = field as ObjectField & {
    localize?: boolean;
    options?: unknown;
  };
  return (
    fieldMetadata.localize === false ||
    isFieldExcludedByOptions(fieldMetadata.options)
  );
};

/*
 * Eliminates stop-types and non-localizable fields
 * for document-level translation.
 */
export const fieldFilter = (
  obj: Record<string, unknown>,
  objFields: ObjectField[],
  stopTypes: string[]
): TypedObject => {
  const filteredObj: TypedObject = {
    _type: typeof obj._type === 'string' ? obj._type : '',
  };

  const fieldFilterFunc = (field: ObjectField): boolean => {
    const fieldMetadata = field as ObjectField & {
      type?: string | { name?: string };
    };
    const fieldType =
      typeof fieldMetadata.type === 'string'
        ? fieldMetadata.type
        : fieldMetadata.type?.name;

    if (isFieldExcludedFromTranslation(field)) {
      return false;
    } else if (fieldType === 'string' || fieldType === 'text') {
      return true;
    } else if (Array.isArray(obj[field.name])) {
      return true;
    } else if (fieldType && !stopTypes.includes(fieldType)) {
      return true;
    }
    return false;
  };

  const validFields = [
    ...META_FIELDS,
    ...objFields.filter(fieldFilterFunc).map((field) => field.name),
  ];
  validFields.forEach((field) => {
    if (obj[field]) {
      filteredObj[field] = obj[field];
    }
  });
  return filteredObj;
};
