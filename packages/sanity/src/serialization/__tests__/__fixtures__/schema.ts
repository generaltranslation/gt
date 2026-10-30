import { Schema } from '@sanity/schema';

type LinkParent = { linkType?: string };

const arrayField = {
  name: 'arrayField',
  title: 'Array Field',
  type: 'array',
  of: [
    {
      type: 'block',
      marks: {
        annotations: [{ type: 'linkField' }],
      },
    },
    { type: 'objectField' },
    { type: 'linkField' },
  ],
};
const linkField = {
  name: 'linkField',
  title: 'Link Field',
  type: 'object',
  fields: [
    {
      name: 'label',
      title: 'Label',
      type: 'string',
    },
    {
      name: 'linkType',
      title: 'Link Type',
      type: 'string',
      options: {
        list: [
          { title: 'None', value: 'none' },
          { title: 'URL', value: 'href' },
          { title: 'Page', value: 'page' },
          { title: 'Simple Page', value: 'simplePage' },
          { title: 'Post', value: 'post' },
          { title: 'File', value: 'file' },
        ],
      },
    },
    {
      name: 'href',
      title: 'URL',
      type: 'url',
      hidden: ({ parent }: { parent: LinkParent }) =>
        parent?.linkType !== 'href',
    },
    {
      name: 'page',
      title: 'Page',
      type: 'reference',
      to: [{ type: 'page' }],
      weak: true,
      hidden: ({ parent }: { parent: LinkParent }) =>
        parent?.linkType !== 'page',
    },
    {
      name: 'simplePage',
      title: 'Simple Page',
      type: 'reference',
      to: [{ type: 'simplePage' }],
      weak: true,
      hidden: ({ parent }: { parent: LinkParent }) =>
        parent?.linkType !== 'simplePage',
    },
    {
      name: 'post',
      title: 'Post',
      type: 'reference',
      to: [{ type: 'post' }],
      weak: true,
      hidden: ({ parent }: { parent: LinkParent }) =>
        parent?.linkType !== 'post',
    },
    {
      name: 'file',
      title: 'File',
      type: 'file',
      hidden: ({ parent }: { parent: LinkParent }) =>
        parent?.linkType !== 'file',
    },
    {
      name: 'openInNewTab',
      title: 'Open in New Tab',
      type: 'boolean',
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
      of: [
        {
          type: 'block',
          marks: {
            annotations: [{ type: 'linkField' }],
          },
        },
        { type: 'linkField' },
      ],
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
      type: 'childObjectField',
    },
    {
      name: 'nestedArrayField',
      title: 'Nested Array Field',
      type: 'array',
      of: [
        {
          type: 'block',
          marks: {
            annotations: [{ type: 'linkField' }],
          },
        },
        { type: 'childObjectField' },
      ],
    },
  ],
};

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
};

const types = [
  arrayField,
  linkField,
  childObjectField,
  objectField,
  documentLevelArticle,
];

const schema: InstanceType<typeof Schema> = new Schema({
  name: 'test',
  types,
});
export default schema;
