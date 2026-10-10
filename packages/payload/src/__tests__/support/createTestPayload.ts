import { sqliteAdapter } from '@payloadcms/db-sqlite';
import {
  BlocksFeature,
  EXPERIMENTAL_TableFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical';
import { buildConfig, getPayload, slugField } from 'payload';
import type { Field, Payload, Plugin } from 'payload';

// A link as Payload's website template defines it: a URL and a label. A new
// object per use, since Payload's config setup changes nested fields.
const link = (): Field => ({
  name: 'link',
  type: 'group',
  fields: [
    { name: 'url', type: 'text' },
    { name: 'label', type: 'text', localized: true },
  ],
});

// Emails of users who may read notices but not update them.
export const LOCKED_OUT = new Set<string>();

// The SEO plugin's meta title and description fields render with these.
const SEO_TITLE = '@payloadcms/plugin-seo/client#MetaTitleComponent';
const SEO_DESCRIPTION =
  '@payloadcms/plugin-seo/client#MetaDescriptionComponent';

// A content model shaped like Payload's website template, on an in-memory
// SQLite database. Pages and posts have drafts; the footer and media do not.
export function testConfig(
  plugins: Plugin[] = [],
  {
    defaultLocale = 'en',
    localization = true,
  }: { defaultLocale?: string; localization?: boolean } = {}
) {
  return buildConfig({
    secret: 'test-secret',
    db: sqliteAdapter({ client: { url: ':memory:' } }),
    editor: lexicalEditor(),
    localization: localization
      ? { locales: ['en', 'es', 'fr', 'de'], defaultLocale, fallback: true }
      : false,
    collections: [
      {
        slug: 'pages',
        admin: { useAsTitle: 'title' },
        versions: { drafts: true },
        fields: [
          { name: 'title', type: 'text', localized: true, required: true },
          {
            name: 'hero',
            type: 'group',
            fields: [
              { name: 'richText', type: 'richText', localized: true },
              { name: 'links', type: 'array', fields: [link()] },
            ],
          },
          {
            name: 'layout',
            type: 'blocks',
            blocks: [
              {
                slug: 'cta',
                fields: [
                  { name: 'richText', type: 'richText', localized: true },
                  { name: 'links', type: 'array', fields: [link()] },
                ],
              },
              {
                slug: 'content',
                fields: [
                  {
                    name: 'columns',
                    type: 'array',
                    fields: [
                      {
                        name: 'size',
                        type: 'select',
                        options: ['full', 'half'],
                      },
                      { name: 'richText', type: 'richText', localized: true },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: 'tabs',
            tabs: [
              {
                name: 'meta',
                label: 'SEO',
                fields: [
                  { name: 'title', type: 'text', localized: true },
                  { name: 'description', type: 'textarea', localized: true },
                ],
              },
            ],
          },
          {
            name: 'body',
            type: 'richText',
            localized: true,
            editor: lexicalEditor({
              features: ({ defaultFeatures }) => [
                ...defaultFeatures,
                BlocksFeature({
                  blocks: [
                    {
                      slug: 'banner',
                      fields: [{ name: 'content', type: 'richText' }],
                    },
                  ],
                }),
              ],
            }),
          },
          { name: 'keywords', type: 'text', hasMany: true, localized: true },
          {
            name: 'code',
            type: 'code',
            localized: true,
          },
          {
            name: 'internalNote',
            type: 'text',
            localized: true,
            custom: { gt: { translate: false } },
          },
          slugField({ localized: true }),
        ],
      },
      {
        // Field settings that change what gets translated, without drafts.
        slug: 'articles',
        admin: { useAsTitle: 'name' },
        fields: [
          {
            name: 'name',
            type: 'text',
            localized: true,
            required: true,
            maxLength: 24,
          },
          { name: 'summary', type: 'textarea', localized: true },
          {
            name: 'metaTitle',
            type: 'text',
            localized: true,
            admin: { components: { Field: { path: SEO_TITLE } } },
          },
          {
            name: 'metaDescription',
            type: 'textarea',
            localized: true,
            admin: { components: { Field: { path: SEO_DESCRIPTION } } },
          },
          {
            name: 'generated',
            type: 'text',
            localized: true,
            admin: { readOnly: true },
          },
          {
            name: 'hiddenText',
            type: 'text',
            localized: true,
            admin: { hidden: true },
          },
          {
            name: 'legalNote',
            type: 'text',
            localized: true,
            required: true,
            custom: { gt: { translate: false } },
          },
          {
            name: 'tags',
            type: 'array',
            localized: true,
            fields: [
              { name: 'label', type: 'text' },
              {
                name: 'code',
                type: 'text',
                custom: { gt: { translate: false } },
              },
            ],
          },
          {
            name: 'promo',
            type: 'group',
            localized: true,
            fields: [
              { name: 'headline', type: 'text' },
              {
                name: 'terms',
                type: 'text',
                custom: { gt: { translate: false } },
              },
            ],
          },
          { name: 'keywords', type: 'text', hasMany: true, localized: true },
          {
            name: 'body',
            type: 'richText',
            localized: true,
            editor: lexicalEditor({
              features: ({ defaultFeatures }) => [
                ...defaultFeatures,
                EXPERIMENTAL_TableFeature(),
              ],
            }),
          },
        ],
      },
      {
        // Localized text only inside a named localized tab.
        slug: 'faqs',
        fields: [
          {
            type: 'tabs',
            tabs: [
              {
                name: 'content',
                localized: true,
                fields: [{ name: 'question', type: 'text' }],
              },
            ],
          },
        ],
      },
      {
        // Localized text only inside a block defined once and referenced.
        slug: 'stories',
        fields: [
          {
            name: 'layout',
            type: 'blocks',
            blocks: [],
            blockReferences: ['quote'],
          },
        ],
      },
      {
        // Editors in LOCKED_OUT can read these but not change them.
        slug: 'notices',
        access: {
          read: () => true,
          update: ({ req }) => !LOCKED_OUT.has(String(req.user?.email)),
        },
        fields: [{ name: 'message', type: 'text', localized: true }],
      },
      {
        // Like the search plugin's collection: copies kept by a plugin.
        slug: 'search',
        fields: [
          {
            name: 'title',
            type: 'text',
            localized: true,
            admin: { readOnly: true },
          },
        ],
      },
      {
        slug: 'media',
        fields: [{ name: 'alt', type: 'text', localized: true }],
      },
    ],
    blocks: [
      {
        slug: 'quote',
        fields: [{ name: 'text', type: 'text', localized: true }],
      },
    ],
    globals: [
      {
        slug: 'announcement',
        access: {
          read: () => true,
          update: ({ req }) => !LOCKED_OUT.has(String(req.user?.email)),
        },
        fields: [{ name: 'message', type: 'text', localized: true }],
      },
      {
        slug: 'header',
        versions: { drafts: true },
        fields: [
          {
            name: 'navItems',
            type: 'array',
            localized: true,
            fields: [link()],
          },
        ],
      },
      {
        slug: 'footer',
        fields: [{ name: 'navItems', type: 'array', fields: [link()] }],
      },
    ],
    plugins,
  });
}

// One instance per test file: Payload pushes the schema to a new database
// only once per process, so a second in-memory database stays empty.
export async function createTestPayload(
  plugins: Plugin[] = [],
  options: { defaultLocale?: string; localization?: boolean } = {}
): Promise<Payload> {
  return getPayload({ config: await testConfig(plugins, options) });
}
