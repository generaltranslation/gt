import { RenderMethod } from 'gt-react/internal';

type withGTConfigProps = {
  // Request scoped filepath
  dictionary?: string;
  config?: string;
  loadTranslationPath?: string;
  loadMessagesPath?: string;
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

export default withGTConfigProps;
