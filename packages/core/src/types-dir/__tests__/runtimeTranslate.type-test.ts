import type { createGtApiAdapter } from '../../adapter/createGtApi.js';
import type {
  TranslateConfig,
  TranslateManyResult,
  TranslationRequestConfig,
  TranslationResult,
} from '../../types.js';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;
type Expect<Value extends true> = Value;

declare const adapter: ReturnType<typeof createGtApiAdapter>;

// Array input infers an ordered array; record input infers a keyed record.
const adapterArray = adapter.translateMany(['Hello'], { targetLocale: 'es' });
const adapterRecord = adapter.translateMany({ key: 'Hello' }, 'es', false);
type _AdapterArrayInference = Expect<
  Equal<Awaited<typeof adapterArray>, TranslateManyResult>
>;
type _AdapterRecordInference = Expect<
  Equal<Awaited<typeof adapterRecord>, Record<string, TranslationResult>>
>;

// timeoutMs is the single new spelling; `false` disables the runtime timer.
const transport: TranslationRequestConfig = {
  projectId: 'project',
  timeoutMs: false,
  fetch: globalThis.fetch,
  apiVersion: '2026-03-06.v1',
};
void transport;

const invalidTimeoutSpelling: TranslateConfig = {
  projectId: 'project',
  // @ts-expect-error the new configuration contract uses timeoutMs.
  timeout: 1_000,
};
void invalidTimeoutSpelling;
