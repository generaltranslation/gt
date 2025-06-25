import { fetchWithAbort } from './utils/fetchWithAbort';
import {
  BatchTranslationData,
  BatchTranslationMetadata,
  BatchTranslationMetadataParams,
  TranslationResults,
} from './utils/types';

const BASE_RUNTIME_URL = 'http://localhost:10000/v1/runtime/';
const DEFAULT_TIMEOUT = 10000;

export default async function _mtranslate(
  data: BatchTranslationData,
  targetLocale: string,
  projectId: string,
  apiKey: string,
  metadata?: BatchTranslationMetadataParams
): Promise<TranslationResults> {
  // Parse metadata
  const batchMetadata: BatchTranslationMetadata = {
    projectId,
    sourceLocale: metadata?.sourceLocale,
    publish: metadata?.publish ?? false,
    fast: metadata?.fast ?? false,
    timeout: metadata?.timeout ?? DEFAULT_TIMEOUT,
  };

  // Construct request
  const baseUrl = metadata?.baseUrl ?? BASE_RUNTIME_URL;
  const isProd = apiKey.split('-')[1] === 'api';
  const runtimeUrl = isProd
    ? `${baseUrl}${projectId}/server`
    : `${baseUrl}${projectId}/client`;
  const headers = {
    'Content-Type': 'application/json',
    ...(isProd ? { 'x-gt-api-key': apiKey } : { 'x-gt-dev-api-key': apiKey }),
  };
  const body = JSON.stringify({
    requests: data.map((item) => ({
      source: item.source,
      metadata: item.metadata,
    })),
    metadata: batchMetadata,
    targetLocale,
    ...(metadata?.versionId && { versionId: metadata.versionId }),
  });

  // Send Request
  const response = await fetchWithAbort(
    runtimeUrl,
    {
      method: 'POST',
      headers,
      body,
    },
    batchMetadata.timeout
  );

  // Parse results
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as TranslationResults;
}
