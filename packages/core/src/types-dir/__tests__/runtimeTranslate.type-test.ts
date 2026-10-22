import type { GTRuntime } from '../../index.js';
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

declare const project: GTRuntime;

// Array input infers an ordered array; record input infers a keyed record.
const projectArray = project.translateMany(['Hello'], { targetLocale: 'es' });
const projectRecord = project.translateMany({ key: 'Hello' }, 'es');
type _ProjectArrayInference = Expect<
  Equal<Awaited<typeof projectArray>, TranslateManyResult>
>;
type _ProjectRecordInference = Expect<
  Equal<Awaited<typeof projectRecord>, Record<string, TranslationResult>>
>;

// Configuration is read-only, and GTRuntime only translates.
// @ts-expect-error the project ID cannot be reassigned.
project.projectId = 'other';
// @ts-expect-error GTRuntime has no project handle.
void project.project;
// @ts-expect-error formatting is on GTIntl.
void project.formatNum;

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
