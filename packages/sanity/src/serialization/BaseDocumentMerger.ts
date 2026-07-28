// Adapted from https://github.com/sanity-io/sanity-naive-html-serializer

import { Merger } from './types';
import { SanityDocument } from 'sanity';
import { extractWithPath, arrayToJSONMatchPath } from '@sanity/mutator';
import { libraryDefaultLocale } from 'generaltranslation/internal';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const reconcileArray = (
  origArray: unknown[],
  translatedArray: unknown[]
): unknown[] => {
  //arrays of strings don't have keys, so just replace the array and return
  if (translatedArray && translatedArray.some((el) => typeof el === 'string')) {
    return translatedArray;
  }

  //deep copy needed for field level patching
  const combined = JSON.parse(JSON.stringify(origArray)) as unknown[];

  translatedArray.forEach((translatedItem) => {
    if (!isRecord(translatedItem) || !translatedItem._key) {
      return;
    }
    const foundBlockIdx = origArray.findIndex(
      (origBlock) =>
        isRecord(origBlock) && origBlock._key === translatedItem._key
    );
    if (foundBlockIdx < 0) {
      //eslint-disable-next-line no-console
      console.warn(
        `This block no longer exists on the original document. Was it removed? ${JSON.stringify(
          translatedItem
        )}`
      );
    } else if (
      isRecord(origArray[foundBlockIdx]) &&
      (origArray[foundBlockIdx]._type === 'block' ||
        origArray[foundBlockIdx]._type === 'span')
    ) {
      combined[foundBlockIdx] = translatedItem;
    } else if (isRecord(origArray[foundBlockIdx])) {
      combined[foundBlockIdx] = reconcileObject(
        origArray[foundBlockIdx],
        translatedItem
      );
    }
  });
  return combined;
};

const reconcileObject = (
  origObject: Record<string, unknown>,
  translatedObject: Record<string, unknown>
): Record<string, unknown> => {
  if (
    typeof translatedObject !== 'object' ||
    !Object.keys(translatedObject).length
  ) {
    return origObject;
  }

  const updatedObj = JSON.parse(JSON.stringify(origObject)) as Record<
    string,
    unknown
  >;
  Object.entries(translatedObject).forEach(([key, value]) => {
    if (!value || key[0] === '_') {
      return;
    }
    if (typeof value === 'string') {
      updatedObj[key] = value;
    } else if (Array.isArray(value)) {
      updatedObj[key] = reconcileArray(
        Array.isArray(origObject[key]) ? origObject[key] : [],
        value
      );
    } else if (isRecord(value)) {
      updatedObj[key] = reconcileObject(
        isRecord(origObject[key]) ? origObject[key] : {},
        value
      );
    }
  });
  return updatedObj;
};

const fieldLevelMerge = (
  translatedFields: Record<string, unknown>,
  //should be fetched according to the revision and id of the translated obj above
  baseDoc: SanityDocument,
  localeId: string,
  baseLang: string = libraryDefaultLocale
): Record<string, unknown> => {
  const merged: Record<string, unknown> = {};
  const metaKeys = ['_rev', '_id', '_type'];
  metaKeys.forEach((metaKey) => {
    if (translatedFields[metaKey]) {
      merged[metaKey] = translatedFields[metaKey];
    }
  });

  //get any field that matches the base language, because it's been translated
  const originPaths = extractWithPath(`..${baseLang}`, translatedFields);
  originPaths.forEach((match) => {
    const origVal = extractWithPath(
      arrayToJSONMatchPath(match.path),
      baseDoc
    )[0].value;
    const translatedVal = extractWithPath(
      arrayToJSONMatchPath(match.path),
      translatedFields
    )[0].value;
    let valToPatch;
    if (typeof translatedVal === 'string') {
      valToPatch = translatedVal;
    } else if (Array.isArray(translatedVal) && translatedVal.length) {
      valToPatch = reconcileArray(
        (origVal as Array<unknown>) ?? [],
        translatedVal
      );
    } else if (
      typeof translatedVal === 'object' &&
      Object.keys(translatedVal as Record<string, unknown>).length
    ) {
      valToPatch = reconcileObject(
        isRecord(origVal) ? origVal : {},
        translatedVal as Record<string, unknown>
      );
    }
    const destinationPath = [
      ...match.path.slice(0, match.path.length - 1), //cut off the "en"
      localeId.replace('-', '_'), // replace it with our locale
    ];

    merged[arrayToJSONMatchPath(destinationPath)] = valToPatch;
  });

  return merged;
};

const documentLevelMerge = <
  TTranslatedFields extends Record<string, unknown>,
  TBaseDoc extends SanityDocument,
>(
  translatedFields: TTranslatedFields,
  //should be fetched according to the revision and id of the translated obj above
  baseDoc: TBaseDoc
): TBaseDoc & TTranslatedFields => {
  return reconcileObject(
    baseDoc as Record<string, unknown>,
    translatedFields
  ) as TBaseDoc & TTranslatedFields;
};

export const BaseDocumentMerger: Merger = {
  fieldLevelMerge,
  documentLevelMerge,
  reconcileArray,
  reconcileObject,
};
