export const sanityProjectId =
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? 'your-project-id';
export const sanityDataset =
  process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production';
export const isSanityConfigured = Boolean(
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
);
