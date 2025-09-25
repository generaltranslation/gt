// Adapted from https://github.com/sanity-io/sanity-naive-html-serializer

import { Merger } from './types';
import { SanityDocument } from 'sanity';
import { extractWithPath, arrayToJSONMatchPath } from '@sanity/mutator';

const reconcileArray = (origArray: any[], translatedArray: any[]): any[] => {
  //arrays of strings don't have keys, so just replace the array and return
  if (translatedArray && translatedArray.some((el) => typeof el === 'string')) {
    return translatedArray;
  }

  //deep copy needed for field level patching
  const combined = JSON.parse(JSON.stringify(origArray));

  translatedArray.forEach((block) => {
    if (!block._key) {
      return;
    }
    const foundBlockIdx = origArray.findIndex(
      (origBlock) => origBlock._key === block._key
    );
    if (foundBlockIdx < 0) {
      //eslint-disable-next-line no-console
      console.warn(
        `This block no longer exists on the original document. Was it removed? ${JSON.stringify(
          block
        )}`
      );
    } else if (
      origArray[foundBlockIdx]._type === 'block' ||
      origArray[foundBlockIdx]._type === 'span'
    ) {
      combined[foundBlockIdx] = block;
    } else if (Array.isArray(origArray[foundBlockIdx])) {
      combined[foundBlockIdx] = reconcileArray(origArray[foundBlockIdx], block);
    } else {
      combined[foundBlockIdx] = reconcileObject(
        origArray[foundBlockIdx],
        block
      );
    }
  });
  return combined;
};

const reconcileObject = (
  origObject: Record<string, any>,
  translatedObject: Record<string, any>
): Record<string, any> => {
  if (
    typeof translatedObject !== 'object' ||
    !Object.keys(translatedObject).length
  ) {
    return origObject;
  }

  const updatedObj = JSON.parse(JSON.stringify(origObject));
  Object.entries(translatedObject).forEach(([key, value]) => {
    if (!value || key[0] === '_') {
      return;
    }
    if (typeof value === 'string') {
      updatedObj[key] = value;
    } else if (Array.isArray(value)) {
      updatedObj[key] = reconcileArray(origObject[key] ?? [], value);
    } else {
      updatedObj[key] = reconcileObject(origObject[key] ?? {}, value);
    }
  });
  return updatedObj;
};

const fieldLevelMerge = (
  translatedFields: Record<string, any>,
  //should be fetched according to the revision and id of the translated obj above
  baseDoc: SanityDocument,
  localeId: string,
  baseLang: string = 'en'
): Record<string, any> => {
  const merged: Record<string, any> = {};
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
      valToPatch = reconcileArray((origVal as Array<any>) ?? [], translatedVal);
    } else if (
      typeof translatedVal === 'object' &&
      Object.keys(translatedVal as Record<string, any>).length
    ) {
      valToPatch = reconcileObject(
        origVal ?? {},
        translatedVal as Record<string, any>
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

const documentLevelMerge = (
  translatedFields: Record<string, any>,
  //should be fetched according to the revision and id of the translated obj above
  baseDoc: SanityDocument
): Record<string, any> => {
  return reconcileObject(baseDoc, translatedFields);
};

export const BaseDocumentMerger: Merger = {
  fieldLevelMerge,
  documentLevelMerge,
  reconcileArray,
  reconcileObject,
};
