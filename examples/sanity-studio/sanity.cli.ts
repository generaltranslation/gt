import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineCliConfig } from 'sanity/cli';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID,
    dataset: process.env.SANITY_STUDIO_DATASET || 'production',
  },
  vite: (prev) => ({
    ...prev,
    resolve: {
      ...prev.resolve,
      alias: {
        ...prev.resolve?.alias,
        // Load the plugin from source so edits hot-reload in the studio.
        'gt-sanity': path.resolve(
          dirname,
          '../../packages/sanity/src/index.ts'
        ),
      },
      dedupe: [
        ...(prev.resolve?.dedupe ?? []),
        'react',
        'react-dom',
        'sanity',
        '@sanity/ui',
        '@sanity/icons',
        'styled-components',
      ],
    },
  }),
});
