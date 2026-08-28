import { TranslationRequestConfig } from '../types';
import { apiRequest } from './utils/apiRequest';

// Compatibility result: published failed-job messages remain non-null while
// the adapter normalizes the generated API's null message to an empty string.
export type JobStatus =
  import('@generaltranslation/api').GetTranslationJobInfoResponse[number]['status'];

export type CheckJobStatusResult = {
  jobId: string;
  status: JobStatus;
  error?: { message: string };
}[];

/**
 * @internal
 * Queries job statuses for a project.
 * @param jobIds - Job IDs.
 * @param config - The configuration for the API call.
 * @param timeoutMs - The timeout in milliseconds.
 * @returns The result of the API call.
 */
export async function _checkJobStatus(
  jobIds: string[],
  config: TranslationRequestConfig,
  timeoutMs?: number
): Promise<CheckJobStatusResult> {
  return apiRequest<CheckJobStatusResult>(config, '/v2/project/jobs/info', {
    body: { jobIds },
    timeout: timeoutMs,
  });
}
