import type { ContentFor } from '@generaltranslation/format';
import type { GTRuntime } from '../../runtime.js';
import type {
  TranslateManyEntry,
  TranslateManyResult,
  TranslationResult,
} from '../../index.js';

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

// A message tree is translation input like any other format.
const tree: ContentFor<'MESSAGE_TREE'> = ['Hello, ', ['name']];
const treeEntry: TranslateManyEntry = {
  source: tree,
  metadata: { dataFormat: 'MESSAGE_TREE' },
};
void treeEntry;

// Model providers are the API's values.
void project.translate('Hello', {
  targetLocale: 'es',
  // @ts-expect-error `custom-provider` is not a ModelProvider.
  modelProvider: 'custom-provider',
});
