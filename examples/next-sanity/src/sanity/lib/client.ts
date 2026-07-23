import { createClient } from 'next-sanity';
import { isSanityConfigured, sanityDataset, sanityProjectId } from '../env';

const client = isSanityConfigured
  ? createClient({
      projectId: sanityProjectId,
      dataset: sanityDataset,
      apiVersion: '2026-07-22',
      useCdn: true,
    })
  : null;

export async function getDocumentCount(): Promise<number | null> {
  if (!client) return null;

  try {
    return await client.fetch<number>('count(*)');
  } catch {
    return null;
  }
}
