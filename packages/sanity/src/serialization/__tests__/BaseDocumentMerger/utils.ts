import { getDeserialized } from '../helpers';
import { createRequire } from 'module';
import clone from 'just-clone';

const require = createRequire(import.meta.url);

const documentLevelArticle = require('../__fixtures__/documentLevelArticle.json');
const fieldLevelArticle = require('../__fixtures__/fieldLevelArticle.json');

export const getNewObject = (): Record<string, any> => {
  const newObject = {
    title: 'A new title',
    nestedArrayField: clone(documentLevelArticle.config.nestedArrayField),
    objectAsField: { title: 'A new nested title' },
    _key: null,
  };
  newObject.nestedArrayField[0].children[0].text = 'New text';
  return newObject;
};

export const getNewDocument = (): Record<string, any> => {
  const newDocument = getDeserialized(documentLevelArticle, 'document');
  newDocument.title = 'A new document title';
  newDocument.snippet = 'A new document snippet';
  newDocument.config = getNewObject();
  const newBlockText = newDocument.content[0];
  newBlockText.children[0].text = 'New block text';
  newDocument.content = [newBlockText];
  return newDocument;
};

export const getNewFieldLevelObject = (): Record<string, any> => {
  const newObject = {
    title: 'A new title',
    nestedArrayField: clone(fieldLevelArticle.config.en.nestedArrayField),
    objectAsField: { title: 'A new nested title' },
    _key: null,
  };
  newObject.nestedArrayField[0].children[0].text = 'New text';
  return newObject;
};

export const getNewFieldLevelDocument = (): Record<string, any> => {
  const newDocument = getDeserialized(fieldLevelArticle, 'field');
  newDocument.title.en = 'A new document title';
  newDocument.snippet.en = 'A new document snippet';
  newDocument.config.en = getNewFieldLevelObject();
  const newBlockText = newDocument.content.en[0];
  newBlockText.children[0].text = 'New block text';
  newDocument.content.en = [newBlockText];
  return newDocument;
};
