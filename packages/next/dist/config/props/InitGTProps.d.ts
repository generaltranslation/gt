import { RenderMethod } from 'gt-react/internal';
type InitGTProps = {
  remoteCache?: boolean;
  runtimeTranslation?: boolean;
  dictionary?: string;
  i18n?: string;
  config?: string;
  apiKey?: string;
  projectId?: string;
  runtimeUrl?: string;
  cacheUrl?: string;
  cacheExpiryTime?: number;
  locales?: string[];
  defaultLocale?: string;
  getLocale?: () => Promise<string>;
  renderSettings?: {
    method: RenderMethod;
    timeout?: number;
  };
  getMetadata?: () => Promise<Record<string, any>>;
  maxConcurrentRequests?: number;
  maxBatchSize?: number;
  batchInterval?: number;
  description?: string;
  [key: string]: any;
};
export default InitGTProps;
//# sourceMappingURL=InitGTProps.d.ts.map
