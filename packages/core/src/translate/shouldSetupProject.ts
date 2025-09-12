import { TranslationRequestConfig } from '../types';
import { defaultBaseUrl } from '../settings/settingsUrls';
import validateResponse from './utils/validateResponse';
import generateRequestHeaders from './utils/generateRequestHeaders';

export type ShouldSetupProjectResult = {
  shouldSetupProject: boolean;
};

export default async function _shouldSetupProject(
  config: TranslationRequestConfig
): Promise<ShouldSetupProjectResult> {
  const url = `${config.baseUrl || defaultBaseUrl}/v2/project/setup/should-generate`;

  const response = await fetch(url, {
    method: 'GET',
    headers: generateRequestHeaders(config, true),
  });

  await validateResponse(response);
  return (await response.json()) as ShouldSetupProjectResult;
}
