// @vitest-environment jsdom

import clone from 'just-clone';
import { beforeEach, describe, expect, test } from 'vitest';
import { BaseDocumentMerger } from '../BaseDocumentMerger';
import {
  documentLevelArticle,
  fieldLevelArticle,
  getDeserialized,
  nestedLanguageFields,
  type ArticleFields,
} from './helpers';

/** An object field as a translation returns it: some fields new, some absent. */
const getNewObject = (
  nestedArrayField: ArticleFields['config']['nestedArrayField']
): ArticleFields['config'] => {
  const newObject = {
    title: 'A new title',
    nestedArrayField: clone(nestedArrayField),
    objectAsField: { title: 'A new nested title' },
    _key: null,
  };
  newObject.nestedArrayField[0].children![0]!.text = 'New text';
  return newObject as unknown as ArticleFields['config'];
};

/** Rewrites the translated article, and cuts its content down to one block. */
const translateFields = (
  fields: ArticleFields,
  original: ArticleFields
): ArticleFields => {
  const newBlockText = fields.content[0]!;
  newBlockText.children![0]!.text = 'New block text';
  return {
    title: 'A new document title',
    snippet: 'A new document snippet',
    config: getNewObject(original.config.nestedArrayField),
    content: [newBlockText],
  };
};

const englishFields = (article: typeof fieldLevelArticle) =>
  ({
    title: article.title.en,
    snippet: article.snippet.en,
    config: article.config.en,
    content: article.content.en,
  }) as unknown as ArticleFields;

type Translation = {
  /** The translated fields; changes made before `merge` are merged too. */
  translated: ArticleFields;
  merge: () => { result: Record<string, unknown>; merged: ArticleFields };
};

const translateDocumentLevel = (): Translation => {
  const newDocument = getDeserialized(documentLevelArticle, 'document');
  const translated = translateFields(
    newDocument as unknown as ArticleFields,
    documentLevelArticle as unknown as ArticleFields
  );
  Object.assign(newDocument, translated);
  return {
    translated,
    merge: () => {
      const result = BaseDocumentMerger.documentLevelMerge(
        newDocument,
        documentLevelArticle
      );
      return { result, merged: result as unknown as ArticleFields };
    },
  };
};

const translateFieldLevel = (): Translation => {
  const newDocument = getDeserialized(fieldLevelArticle, 'field');
  const translated = translateFields(
    englishFields(newDocument),
    englishFields(fieldLevelArticle)
  );
  Object.assign(newDocument.title, { en: translated.title });
  Object.assign(newDocument.snippet, { en: translated.snippet });
  Object.assign(newDocument.config, { en: translated.config });
  Object.assign(newDocument.content, { en: translated.content });
  return {
    translated,
    merge: () => {
      const result = BaseDocumentMerger.fieldLevelMerge(
        newDocument,
        fieldLevelArticle,
        'es_ES',
        'en'
      );
      return {
        result,
        merged: {
          title: result['title.es_ES'],
          snippet: result['snippet.es_ES'],
          config: result['config.es_ES'],
          content: result['content.es_ES'],
        } as ArticleFields,
      };
    },
  };
};

/*
 * The same article at both translation levels. A document-level merge returns
 * the whole document; a field-level merge returns patches for the target
 * language, keyed by path.
 */
const levels = [
  {
    level: 'document',
    original: documentLevelArticle as unknown as ArticleFields,
    translate: translateDocumentLevel,
  },
  {
    level: 'field',
    original: englishFields(fieldLevelArticle),
    translate: translateFieldLevel,
  },
];

for (const { level, original, translate } of levels) {
  describe(`${level}-level merge`, () => {
    let translated: ArticleFields;
    let result: Record<string, unknown>;
    let merged: ArticleFields;

    // Translated inside each test, where the mocked block keys restart from
    // zero, so the snapshot stays the same whichever tests run.
    beforeEach(() => {
      const translation = translate();
      ({ translated } = translation);
      ({ result, merged } = translation.merge());
    });

    test('matches the snapshot', () => {
      expect(result).toMatchSnapshot();
    });

    /*
     * Objects
     */
    test('Top-level string / text fields from new document override old document', () => {
      expect(merged.title).toEqual(translated.title);
      expect(merged.snippet).toEqual(translated.snippet);
      expect(merged.title).not.toEqual(original.title);
      expect(merged.snippet).not.toEqual(original.snippet);
    });

    test('Nested object fields override old object fields', () => {
      expect(merged.config.title).toEqual(translated.config.title);
      expect(merged.config.title).not.toEqual(original.config.title);

      const mergedText = merged.config.nestedArrayField[0].children![0]!.text;
      expect(mergedText).toEqual(
        translated.config.nestedArrayField[0].children![0]!.text
      );
      expect(mergedText).not.toEqual(
        original.config.nestedArrayField[0].children![0]!.text
      );
    });

    test('Nested object merge uses old fields when not present on new object', () => {
      expect(translated.config.objectAsField.content).toBeUndefined();
      expect(merged.config.objectAsField.content).toEqual(
        original.config.objectAsField.content
      );
    });

    /*
     * Arrays
     */
    test('Arrays will use new objects when they exist', () => {
      const mergedText = merged.content[0]!.children![0]!.text;
      expect(mergedText).toEqual(translated.content[0]!.children![0]!.text);
      expect(mergedText).not.toEqual(original.content[0]!.children![0]!.text);
    });

    test('Arrays will use old blocks if they do not exist on new object', () => {
      expect(translated.content[1]).toBeUndefined();
      expect(merged.content[1]).toBeDefined();
      expect(merged.content[1]!._key).toEqual(original.content[1]!._key);
    });

    test('Arrays will merge objects in the array', () => {
      const translation = translate();
      const incompleteObj = getNewObject(original.config.nestedArrayField);

      //add a new block with some new content, but not all new content
      translation.translated.content.push({
        _key: original.content[1]!._key,
        objectAsField: incompleteObj.objectAsField,
        title: incompleteObj.title,
        //does not include "content" field -- we want that to be merged with the old
      } as ArticleFields['content'][number]);
      const incomplete = translation.translated.content[1]!;
      const mergedObject = translation.merge().merged.content[1]!;

      expect(mergedObject.title).toEqual(incomplete.title);
      expect(mergedObject.objectAsField.title).toEqual(
        incomplete.objectAsField.title
      );
      //"content" field existed on old doc but not new, so the two coexist happily
      expect(incomplete.objectAsField.content).toBeUndefined();
      expect(mergedObject.objectAsField.content).toBeDefined();
    });

    if (level === 'document') {
      test('Merged document should maintain style tags', () => {
        for (const style of ['h1', 'h2']) {
          const originalBlock = original.content.find(
            (block) => block.style === style
          )!;
          const mergedBlock = merged.content.find(
            (block) => block.style === style
          )!;
          expect(mergedBlock).toBeDefined();
          expect(mergedBlock._key).toEqual(originalBlock._key);
        }
      });
    } else {
      test('Top-level fields are patched to the new language only', () => {
        expect(result['title.en']).toBeUndefined();
        expect(result['snippet.en']).toBeUndefined();
      });
    }
  });
}

test('nested locale fields will be merged', () => {
  const newNestedFields = clone(nestedLanguageFields);
  newNestedFields.pageFields.name.en = 'This is a new page field name';
  newNestedFields.slices[0]!.en![0]!.children![0]!.text =
    'This is new slice text';
  const baseDocumentWithNestedFields = {
    ...fieldLevelArticle,
    ...nestedLanguageFields,
  };
  const newDocumentWithNestedFields = getDeserialized(
    { ...fieldLevelArticle, ...newNestedFields },
    'field'
  );
  const nestedFieldLevelPatches = BaseDocumentMerger.fieldLevelMerge(
    newDocumentWithNestedFields,
    baseDocumentWithNestedFields,
    'es_ES',
    'en'
  ) as {
    'slices[0].es_ES': NonNullable<
      (typeof nestedLanguageFields.slices)[number]['en']
    >;
    'pageFields.name.es_ES': string;
  };

  expect(
    nestedFieldLevelPatches['slices[0].es_ES'][0]!.children![0]!.text
  ).toEqual(newDocumentWithNestedFields.slices[0]!.en![0]!.children![0]!.text);
  expect(nestedFieldLevelPatches['pageFields.name.es_ES']).toEqual(
    newDocumentWithNestedFields.pageFields.name.en
  );
});
