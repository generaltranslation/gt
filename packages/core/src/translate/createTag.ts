import { TranslationRequestConfig } from '../types';
import apiRequest from './utils/apiRequest';

export type CreateTagFileReference = {
  fileId: string;
  versionId: string;
  branchId: string;
};

export type CreateTagOptions = {
  tagId: string;
  files: CreateTagFileReference[];
  message?: string;
};

export type CreateTagResult = {
  tag: {
    id: string;
    tagId: string;
    message: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

/**
 * @internal
 * Creates or upserts a file tag in the General Translation API.
 * @param options - The tag creation options
 * @param config - The configuration for the API call
 * @returns The created or updated tag
 */
export default async function _createTag(
  options: CreateTagOptions,
  config: TranslationRequestConfig
): Promise<CreateTagResult> {
  return await apiRequest<CreateTagResult>(config, '/v2/project/tags/create', {
    body: {
      tagId: options.tagId,
      files: options.files,
      ...(options.message && { message: options.message }),
    },
  });
}
