import assert from 'node:assert/strict';
import { LocaleConfig, formatMessage } from 'generaltranslation/runtime';

assert.equal(
  formatMessage('Hi {name}', { variables: { name: 'Ada' } }),
  'Hi Ada'
);

assert.equal(
  new LocaleConfig().formatMessage('Hi {name}', undefined, {
    variables: { name: 'Ada' },
  }),
  'Hi Ada'
);
