import { RenderMethod } from 'gt-react/internal';

type InitGTProps = {
  // Feature flags
  translationLoaderType?: 'remote' | 'custom' | 'disabled'; // remote: CDN, custom: uknown, disabled: no fetch
  // Request scoped filepath
  dictionary?: string;
  i18n?: string;
  config?: string;
  translationLoaderPath?: string;
  // Cloud integration
  apiKey?: string;
  projectId?: string;
  runtimeUrl?: string | null;
  cacheUrl?: string | null;
  cacheExpiryTime?: number;
  // Locale info
  locales?: string[];
  defaultLocale?: string;
  getLocale?: () => Promise<string>;
  // Rendering
  renderSettings?: {
    method: RenderMethod;
    timeout?: number;
  };
  // Other metadata
  getMetadata?: () => Promise<Record<string, any>>;
  // Batching config
  maxConcurrentRequests?: number;
  maxBatchSize?: number;
  batchInterval?: number; // ms
  // Translation assistance
  description?: string;
  // Other
  _usingPlugin?: boolean;
  [key: string]: any;
};

export default InitGTProps;
