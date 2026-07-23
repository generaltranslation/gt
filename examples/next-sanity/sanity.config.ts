'use client';

import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { gtPlugin } from 'gt-sanity';
import { sanityDataset, sanityProjectId } from './src/sanity/env';
import { schemaTypes } from './src/sanity/schemaTypes';

const sanityConfig = defineConfig({
  name: 'default',
  title: 'GT + Sanity example',
  basePath: '/studio',
  projectId: sanityProjectId,
  dataset: sanityDataset,
  plugins: [
    structureTool(),
    gtPlugin({
      sourceLocale: 'en',
      locales: ['es', 'zh', 'ja'],
      translateDocuments: [
        { type: 'documentTranslationExample' },
        { type: 'fieldTranslationExample' },
      ],
    }),
  ],
  schema: { types: schemaTypes },
});

export default sanityConfig;
