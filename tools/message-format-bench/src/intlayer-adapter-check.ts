/**
 * Run by build.ts inside a built Intlayer project. Checks that the React-free
 * runtime of src/runtimes/intlayer.ts prints what Intlayer's own react-intl
 * adapter prints for the same dictionary, so timing the former stands for the
 * latter.
 */
import { readFileSync } from 'node:fs';
import { createIntl } from '@intlayer/react-intl';
import { loadCorpus, type MixId } from './corpus.ts';
import { INTLAYER_KEY } from './projects.ts';
import { make } from './runtimes/intlayer.ts';
import { valuesFor } from './values.ts';

const [mix, n] = process.argv.slice(2);
const dictionary = JSON.parse(
  readFileSync(`.intlayer/dictionary/${INTLAYER_KEY}.json`, 'utf8')
);
const render = make(dictionary as never);
const intl = createIntl({ locale: 'en' });
loadCorpus(mix as MixId)
  .messages.slice(0, Number(n))
  .forEach(({ key, icu }, i) => {
    const values = valuesFor(i);
    const ours = render(key, values, i);
    const theirs = intl.formatMessage(
      { id: `${INTLAYER_KEY}.${key}` },
      values as never
    );
    if (ours !== theirs)
      throw new Error(
        `@intlayer/react-intl prints ${JSON.stringify(theirs)}, the benchmark's runtime ${JSON.stringify(ours)}, for ${icu}`
      );
  });
