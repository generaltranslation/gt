import { createClient } from 'next-sanity';
import { isSanityConfigured, sanityDataset, sanityProjectId } from '../env';

export type SanityExampleDocument = {
  _id: string;
  _type: 'documentTranslationExample' | 'fieldTranslationExample';
  title: string | null;
  summary: string | null;
  tags: string[] | null;
  body: string | null;
  sections: Array<{
    _key: string;
    heading: string | null;
    copy: string | null;
  }> | null;
};

export type SanityExampleData =
  | { status: 'unconfigured'; documentCount: null; documents: [] }
  | { status: 'error'; documentCount: null; documents: [] }
  | {
      status: 'ready';
      documentCount: number;
      documents: SanityExampleDocument[];
    };

const client = isSanityConfigured
  ? createClient({
      projectId: sanityProjectId,
      dataset: sanityDataset,
      apiVersion: '2026-07-22',
      useCdn: true,
    })
  : null;

export async function getSanityExampleData(): Promise<SanityExampleData> {
  if (!client) {
    return { status: 'unconfigured', documentCount: null, documents: [] };
  }

  try {
    const data = await client.fetch<{
      documentCount: number;
      documents: SanityExampleDocument[];
    }>(`{
      "documentCount": count(*),
      "documents": *[
        _type in ["documentTranslationExample", "fieldTranslationExample"]
      ] | order(_updatedAt desc) [0...6] {
        _id,
        _type,
        "title": coalesce(title, headline),
        summary,
        tags,
        "body": pt::text(body),
        sections[] {
          _key,
          heading,
          copy
        }
      }
    }`);

    return { status: 'ready', ...data };
  } catch {
    return { status: 'error', documentCount: null, documents: [] };
  }
}
