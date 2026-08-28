import { TranslationRequestConfig } from '../types';
import { apiRequest } from './utils/apiRequest';

export type CreateTagFileReference =
  import('@generaltranslation/api').CreateTagData['body']['files'][number];

export type CreateTagOptions =
  import('@generaltranslation/api').CreateTagData['body'];

export type CreateTagResult =
  import('@generaltranslation/api').CreateTagResponse;

/**
 * @internal
 * Creates or upserts a file tag in the General Translation API.
 * @param options - The tag creation options.
 * @param config - The configuration for the API call.
 * @returns The created or updated tag.
 */
export async function _createTag(
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
