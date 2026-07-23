import { visionTool } from '@sanity/vision';
import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { gtPlugin } from 'gt-sanity';
import { schemaTypes } from './src/schemaTypes';

const projectId = process.env.SANITY_STUDIO_PROJECT_ID || 'placeholder';
const dataset = process.env.SANITY_STUDIO_DATASET || 'production';

export default defineConfig({
  name: 'default',
  title: 'GT Sanity Dev Studio',
  projectId,
  dataset,
  plugins: [
    structureTool(),
    visionTool(),
    gtPlugin({
      sourceLocale: 'en',
      locales: ['es', 'fr', 'de', 'ja', 'zh'],
      translateDocuments: ['page', 'post'],
      dedupeFields: [{ fields: [{ property: '$.slug' }] }],
    }),
  ],
  schema: {
    types: schemaTypes,
  },
});
