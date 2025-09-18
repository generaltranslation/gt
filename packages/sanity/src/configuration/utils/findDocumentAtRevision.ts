import { SanityClient, SanityDocument } from 'sanity';

//revision fetch
export const findDocumentAtRevision = async (
  documentId: string,
  rev: string,
  client: SanityClient
): Promise<SanityDocument> => {
  const dataset = client.config().dataset;
  const baseUrl = `/data/history/${dataset}/documents/${documentId}?revision=${rev}`;
  const url = client.getUrl(baseUrl);
  const revisionDoc = await fetch(url, { credentials: 'include' })
    .then((req) => req.json())
    .then((req) => {
      if (req.documents && req.documents.length) {
        return req.documents[0];
      }
      return null;
    });

  return revisionDoc;
};
