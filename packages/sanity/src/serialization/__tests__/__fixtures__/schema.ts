import {Schema} from '@sanity/schema'

const arrayField = {
  name: 'arrayField',
  title: 'Array Field',
  type: 'array',
  of: [{type: 'block'}, {type: 'objectField'}],
}

const childObjectField = {
  name: 'childObjectField',
  title: 'Child Object Field',
  type: 'object',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
    },
    {
      name: 'content',
      title: 'Content',
      type: 'array',
      of: [{type: 'block'}],
    },
  ],
}

const objectField = {
  name: 'objectField',
  title: 'Object Field',
  type: 'object',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
    },
    {
      name: 'objectAsField',
      title: 'Object As Field',
      type: 'childObjectField',
    },
    {
      name: 'nestedArrayField',
      title: 'Nested Array Field',
      type: 'array',
      of: [{type: 'block'}, {type: 'childObjectField'}],
    },
  ],
}

const documentLevelArticle = {
  name: 'documentLevelArticle',
  title: 'Document Level Article',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
    },
    {
      name: 'meta',
      title: 'Meta',
      type: 'string',
      localize: false,
    },
    {
      name: 'snippet',
      title: 'Snippet',
      type: 'text',
    },
    {
      name: 'tags',
      title: 'Tags',
      type: 'array',
      of: [{type: 'string'}],
    },
    {
      name: 'hidden',
      title: 'Hidden',
      type: 'boolean',
    },
    {
      name: 'config',
      title: 'Config',
      type: 'objectField',
    },
    {
      name: 'content',
      title: 'Content',
      type: 'arrayField',
    },
  ],
}

function createLocaleFields(locales: string[], fieldType: Record<string, any>) {
  return locales.map((locale) => ({
    ...{name: locale},
    ...fieldType,
  }))
}

const fieldLevelArticle = {
  name: 'fieldLevelArticle',
  title: 'Field Level Article',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'localeString',
    },
    {
      name: 'meta',
      title: 'Meta',
      type: 'string',
      localize: false,
    },
    {
      name: 'snippet',
      title: 'Snippet',
      type: 'object',
      fields: createLocaleFields(['en', 'fr', 'de'], {type: 'text'}),
    },
    {
      name: 'tags',
      title: 'Tags',
      type: 'object',
      fields: createLocaleFields(['en', 'fr', 'de'], {
        type: 'array',
        of: [{type: 'string'}],
      }),
    },
    {
      name: 'hidden',
      title: 'Hidden',
      type: 'boolean',
    },
    {
      name: 'config',
      title: 'Config',
      type: 'object',
      fields: createLocaleFields(['en', 'fr', 'de'], {type: 'objectField'}),
    },
    {
      name: 'content',
      title: 'Content',
      type: 'object',
      fields: createLocaleFields(['en', 'fr', 'de'], {type: 'arrayField'}),
    },
    {
      name: 'slices',
      title: 'Slices',
      type: 'array',
      of: [{type: 'localeBlock'}, {type: 'reference', to: [{type: 'marketText'}]}],
    },
    {
      name: 'pageFields',
      title: 'Page Fields',
      type: 'pageFields',
    },
  ],
}

const localeBlock = {
  name: 'localeBlock',
  title: 'Locale Block',
  type: 'object',
  fields: createLocaleFields(['en', 'fr_FR', 'de_DE'], {type: 'arrayField'}),
}

const localeString = {
  name: 'localeString',
  title: 'Locale String',
  type: 'object',
  fields: createLocaleFields(['en', 'fr_FR', 'de_DE'], {type: 'string'}),
}

const pageFields = {
  name: 'pageFields',
  title: 'Page Fields',
  type: 'object',
  fields: [
    {
      title: 'Page Name',
      name: 'name',
      type: 'localeString',
    },
    {
      name: 'slug',
      type: 'string',
    },
  ],
}

const types = [
  arrayField,
  childObjectField,
  objectField,
  documentLevelArticle,
  fieldLevelArticle,
  pageFields,
  localeBlock,
  localeString,
]

export default new Schema({
  name: 'test',
  types,
})
