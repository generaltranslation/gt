import { Schema } from '@sanity/schema';

const arrayField = {
  name: 'arrayField',
  title: 'Array Field',
  type: 'array',
  of: [
    { type: 'block' },
    {
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
              of: [{ type: 'block' }],
            },
          ],
        },
        {
          name: 'nestedArrayField',
          title: 'Nested Array Field',
          type: 'array',
          of: [{ type: 'block' }, { type: 'childObjectField' }],
        },
      ],
    },
  ],
};

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
      of: [{ type: 'block' }],
    },
  ],
};

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
          of: [{ type: 'block' }],
        },
      ],
    },
    {
      name: 'nestedArrayField',
      title: 'Nested Array Field',
      type: 'array',
      of: [{ type: 'block' }, { type: 'childObjectField' }],
    },
  ],
};

const documentLevelArticle = {
  name: 'documentLevelArticle',
  title: 'Document Level Article',
  type: 'document',
  fields: [
    {
      name: 'tabs',
      type: 'object',
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
          of: [{ type: 'string' }],
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
    },
  ],
};

const types = [arrayField, childObjectField, objectField, documentLevelArticle];

const schema: InstanceType<typeof Schema> = new Schema({
  name: 'test',
  types,
});
export default schema;
