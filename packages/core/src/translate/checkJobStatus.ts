// Compatibility result: published failed-job messages remain non-null while
// the adapter normalizes the generated API's null message to an empty string.
export type JobStatus =
  import('@generaltranslation/api').GetTranslationJobInfoResponse[number]['status'];

export type CheckJobStatusResult = {
  jobId: string;
  status: JobStatus;
  error?: { message: string };
}[];
