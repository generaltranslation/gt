import { getDeserialized } from '../helpers';
import clone from 'just-clone';
import documentLevelArticle from '../__fixtures__/documentLevelArticle.json';
import fieldLevelArticle from '../__fixtures__/fieldLevelArticle.json';

export const getNewObject = (): typeof documentLevelArticle.config => {
  const newObject = {
    title: 'A new title',
    nestedArrayField: clone(documentLevelArticle.config.nestedArrayField),
    objectAsField: { title: 'A new nested title' },
    _key: null,
  };
  newObject.nestedArrayField[0].children[0].text = 'New text';
  return newObject as unknown as typeof documentLevelArticle.config;
};

export const getNewDocument = (): typeof documentLevelArticle => {
  const newDocument = getDeserialized(documentLevelArticle, 'document');
  newDocument.title = 'A new document title';
  newDocument.snippet = 'A new document snippet';
  newDocument.config = getNewObject();
  const newBlockText = newDocument.content[0]!;
  newBlockText.children![0]!.text = 'New block text';
  newDocument.content = [newBlockText];
  return newDocument;
};

export const getNewFieldLevelObject =
  (): typeof fieldLevelArticle.config.en => {
    const newObject = {
      title: 'A new title',
      nestedArrayField: clone(fieldLevelArticle.config.en.nestedArrayField),
      objectAsField: { title: 'A new nested title' },
      _key: null,
    };
    newObject.nestedArrayField[0].children[0].text = 'New text';
    return newObject as unknown as typeof fieldLevelArticle.config.en;
  };

export const getNewFieldLevelDocument = (): typeof fieldLevelArticle => {
  const newDocument = getDeserialized(fieldLevelArticle, 'field');
  newDocument.title.en = 'A new document title';
  newDocument.snippet.en = 'A new document snippet';
  newDocument.config.en = getNewFieldLevelObject();
  const newBlockText = newDocument.content.en[0]!;
  newBlockText.children![0]!.text = 'New block text';
  newDocument.content.en = [newBlockText];
  return newDocument;
};
