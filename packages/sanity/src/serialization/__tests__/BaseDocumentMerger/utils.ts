import { getDeserialized } from '../helpers';
import clone from 'just-clone';
import documentLevelArticle from '../__fixtures__/documentLevelArticle.json';

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
  const newDocument = getDeserialized(documentLevelArticle);
  newDocument.title = 'A new document title';
  newDocument.snippet = 'A new document snippet';
  newDocument.config = getNewObject();
  const newBlockText = newDocument.content[0]!;
  newBlockText.children![0]!.text = 'New block text';
  newDocument.content = [newBlockText];
  return newDocument;
};
