import assert from 'node:assert/strict';
import fs from 'node:fs';

const catalog = JSON.parse(fs.readFileSync('src/_gt/en.json', 'utf8'));

assert.deepEqual(catalog, {
  '1cac91be0322640a': [
    { t: 'Card', i: 1, d: { ti: 'Heading' } },
    { t: 'p', i: 2, c: 'After' },
  ],
  ddb1a810038d4457: [' Nested ', { i: 1, k: '_gt_value_1', v: 'v' }],
  '8fb508f2685e4781': 'Binary string',
});
