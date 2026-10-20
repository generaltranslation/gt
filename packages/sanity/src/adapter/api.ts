import {
  createGtApiAdapter,
  defaultBaseUrl,
  type GtApiAdapterConfig,
} from 'generaltranslation/internal';

const {
  configure: configureSharedApi,
  getClient: _getClient,
  ...sharedApi
} = createGtApiAdapter({ baseUrl: defaultBaseUrl });

export function configureApiClient(
  config: Omit<GtApiAdapterConfig, 'baseUrl'> & { baseUrl?: string }
): void {
  configureSharedApi({ baseUrl: defaultBaseUrl, ...config });
}

export const api = sharedApi;
