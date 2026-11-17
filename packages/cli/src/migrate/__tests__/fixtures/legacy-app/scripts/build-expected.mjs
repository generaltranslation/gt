// Builds expected.json for the legacy-app fixture and checks it against the
// real extraction outputs. Usage: node build-expected.mjs <fixtureDir>
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.argv[2]);
const read = (p) => JSON.parse(fs.readFileSync(path.join(dir, p), 'utf8'));
const oldEn = read('old-catalogs/en.json');
const newSource = read('new-source.json');

// expect: 'match'    -> must migrate from `intent`
//         'optional' -> human intent is `intent`, but the legacy shape may be
//                       out of reach; if matched, it must be to `intent`
//         'no-match' -> must not receive any migrated translation
const E = (intent, kind, expect, note, extra = {}) => ({
  intent,
  kind,
  expect,
  note,
  ...extra,
});

const messages = {
  // ---- dictionary (gt-next/compat useTranslations, same ICU hashing) ----
  '9564e3123aec3de1': E(
    '9564e3123aec3de1',
    'dictionary',
    'match',
    'footer.about; same key'
  ),
  '3188bc3b3c4508bc': E(
    '3188bc3b3c4508bc',
    'dictionary',
    'match',
    'footer.privacy; same key'
  ),
  '642a713bc3b12d8c': E(
    '642a713bc3b12d8c',
    'dictionary',
    'match',
    'footer.copyright with {year}; same key'
  ),
  eb973c194940e6da: E(
    'eb973c194940e6da',
    'dictionary',
    'match',
    'footer.newsletter.title; same key'
  ),
  '4ed2aa55d6691d99': E(
    '4ed2aa55d6691d99',
    'dictionary',
    'match',
    'footer.newsletter.subscribe with $context; same key'
  ),
  '31105b18ab21aeb4': E(
    '31105b18ab21aeb4',
    'dictionary',
    'match',
    'footer.newsletter.subscribers ICU plural; same key'
  ),
  '459fd02379259631': E(
    null,
    'edited-must-not-match',
    'no-match',
    'footer.careers text edited "Careers" -> "Jobs"',
    { editedFrom: 'f7ff9265a69905f1' }
  ),

  // ---- unchanged <T> (imported from gt-next, still hashed as JSX) ----
  '53223d6dc71cbbac': E(
    '53223d6dc71cbbac',
    'unchanged-T',
    'match',
    'plain-text <T>; same key (JSX)'
  ),
  f0cf73dca93a0a97: E(
    'f0cf73dca93a0a97',
    'unchanged-T',
    'match',
    '<T context> with <h2>; same key'
  ),
  '95740571c1dcbdd5': E(
    '95740571c1dcbdd5',
    'unchanged-T',
    'match',
    'Var + nested b/a/em elements; same key'
  ),
  '1495d7bdb3df9600': E(
    '1495d7bdb3df9600',
    'unchanged-T',
    'match',
    '<Branch> with <p>/<strong>; same key'
  ),
  '619a8db474acd4fd': E(
    '619a8db474acd4fd',
    'unchanged-T',
    'match',
    'plain-text <T>; same key'
  ),
  '5934b492bf309802': E(
    '5934b492bf309802',
    'unchanged-T',
    'match',
    '<a> + <Num>; same key'
  ),
  '9b1206b9d64ce5eb': E(
    '9b1206b9d64ce5eb',
    'unchanged-T',
    'match',
    '$context renamed to context, which main hashed identically; same key'
  ),
  '111a44209dc6e701': E(
    'ed183e39532cd793',
    'unchanged-T',
    'match',
    'source unchanged, but samsara ignores $context/$maxChars, so the key changed; extraction keeps $context and $maxChars (as the string "20") as unhashed metadata, from which the main-era hash is recomputable'
  ),

  // ---- kept legacy gt()/msg() (still exported by gt-next on samsara) ----
  bd3deac54c2c3113: E(
    'bd3deac54c2c3113',
    'unchanged-gt',
    'match',
    'legacy useGT gt() kept; same key'
  ),
  db2f6b2dfab743e3: E(
    'db2f6b2dfab743e3',
    'unchanged-gt',
    'match',
    'legacy getGT gt() kept in a server component; same key'
  ),
  '2548ab3bd542bc7e': E(
    '2548ab3bd542bc7e',
    'msg',
    'match',
    'legacy msg() from gt-next kept; same key'
  ),

  // ---- <T> rewritten as t ----
  '348f70b8949635e4': E(
    '66bb6ae37d74db50',
    'T-to-t',
    'match',
    'plain-text <T> -> t``; predicted JSX hash'
  ),
  '884b53222572b725': E(
    '249219a6f40ac113',
    'T-to-t',
    'match',
    '<T $maxChars={40}> -> t({ maxChars: 40 }); predicted JSX hash with maxChars'
  ),
  '35d87bbc180d1e5d': E(
    'b0717a26ba687fd1',
    'T-to-t',
    'match',
    '<Num>/<Currency USD> (_gt_n_1/_gt_cost_2) -> number(x)/number(x, currency) (_gt_1/_gt_2); en.json alpha-equivalence; de translation is broken'
  ),
  '2f0a33c8008918a9': E(
    '03ac2a0cebc8841a',
    'T-to-t',
    'match',
    '<DateTime> (_gt_date_1) -> date(x) (_gt_1)'
  ),
  '1be0fe3f76bfe080': E(
    'a8da5a187a382177',
    'T-to-t',
    'match',
    '<Var name="code"> + <Currency EUR> -> ${{ code }} + number(x, currency) (_gt_1)'
  ),
  a3db809f06210b76: E(
    '7a94e62ddf761bf9',
    'T-to-t',
    'optional',
    '<Plural> whose branches are fragments (t: "C2") holding <Num> (_gt_n_3) -> plural(x, part`${n} …`); old shape has a fragment element and a Num where the new tree has #, so not structurally equivalent'
  ),
  '79f3d898c44c9db1': E(
    '454c39b739038471',
    'T-to-t',
    'optional',
    '<Derive> inside <T> -> derive(); legacy JSX keeps Derive as an element {t: "Derive", c: "admin"}, the tree inlines the text'
  ),
  '6c22bbb27a88235a': E(
    '5d8981b5c0f0c9f0',
    'T-to-t',
    'optional',
    'same as above, "member" variant'
  ),

  // ---- gt() rewritten as t ----
  a5cae848b9cc5a76: E(
    '6df57099a35b36bb',
    'gt-to-t',
    'match',
    'plain text; predicted ICU hash'
  ),
  d2c60c72dce56502: E(
    '4681c4c9541539a4',
    'gt-to-t',
    'match',
    'plain text; predicted ICU hash'
  ),
  '3d7a6a7751c7e284': E(
    'e96c0a48cc8b47f2',
    'gt-to-t',
    'match',
    'plain text from getGT (server); predicted ICU hash'
  ),
  f3b30421ef501566: E(
    '434a14a0bd17690c',
    'gt-to-t',
    'match',
    'literal # outside plural + {orderId} -> ${{ orderId }}'
  ),
  cd2f8827bcc97321: E(
    '8732b45d6a9de0b3',
    'gt-to-t',
    'match',
    '{name} -> ${{ name }}; fr translation is broken'
  ),
  '001f9b710eadc5a9': E(
    'b3baf49bdf422cc0',
    'gt-to-t',
    'match',
    'context kept; another old "Save" with a different context exists, predicted hash disambiguates'
  ),
  '1461aa43db735a5c': E(
    '7f3ce5caa875dc3c',
    'gt-to-t',
    'match',
    'context "Security tip" + {days}'
  ),
  '2cded0afec74560f': E(
    'd218025620554381',
    'gt-to-t',
    'match',
    '$maxChars 24 -> maxChars 24'
  ),
  '23e11cb27f14eb19': E(
    '66a6905db9c3ad9b',
    'gt-to-t',
    'match',
    'named plural with part/n; ru has full categories'
  ),
  '3ff9747088ed5aeb': E(
    '8ee56e8868ed1a21',
    'gt-to-t',
    'match',
    'named select with string branches'
  ),
  '4a6c11b6b152ec84': E(
    'f9bb05030fd9e2ec',
    'gt-to-t',
    'match',
    'selectordinal; tree branch order (few, one, other, two) differs from the source ICU order'
  ),
  '22b5898b2c89aa60': E(
    'f4a2003d0d205248',
    'gt-to-t',
    'match',
    'plural with =0 and string branches'
  ),
  ebc69c8c97aeff98: E(
    '30e543e2f17f02a0',
    'gt-to-t',
    'match',
    '{amount, number, ::currency/USD} -> number({ amount }, { style: currency, currency: USD }); USD lives in formats'
  ),
  bd66675a608bd0b8: E(
    '37643cc0e5584808',
    'gt-to-t',
    'match',
    '{time, time, short} -> time({ time }, { style: short })'
  ),
  '1be1a03645c15943': E(
    'ab2fc4dec0d71762',
    'gt-to-t',
    'match',
    '{usage, number, percent} -> number({ usage }, { style: percent })'
  ),
  '5b409e6b3e3d741a': E(
    '87ad24956d2ad354',
    'gt-to-t',
    'match',
    'named plural {days} -> anonymous plural(x) (_gt_1); needs the rename map; ja translation is broken'
  ),
  '31de7e9926310506': E(
    '11d78c9b26584682',
    'gt-to-t',
    'match',
    '{date, date, long} -> date({ date }, { style: long })'
  ),
  '894b5f58be761c1a': E(
    'f5683e647a65e15c',
    'gt-to-t',
    'match',
    'whole-message plural; ru has full categories'
  ),
  '875d2963662f2b1b': E(
    'a10b666b99e5cbd3',
    'gt-to-t',
    'match',
    'derive(declareVar(email)) ({_gt_1, select, other {}}) -> anonymous ${email}'
  ),
  '7cce1a1f3b623342': E(
    '47efa82426cfae24',
    'gt-to-t',
    'match',
    'declareVar(name, { $name: "username" }) ({_gt_1, select, other {} _gt_var_name {username}}) -> ${{ username }}; the old derive() variant "Good to see you, there!" (39959a3829477f74) has no new counterpart'
  ),
  c4fc26b3dd0a3630: E(
    '244a55b2d97e54a3',
    'gt-to-t',
    'match',
    'derive() variant Free; predicted ICU hash'
  ),
  c3a8fa5391cc5681: E(
    'b4791b20bdc34eba',
    'gt-to-t',
    'match',
    'derive() variant Pro; predicted ICU hash'
  ),
  '724272c571c9aa01': E(
    '4e242a20613f72f6',
    'gt-to-t',
    'match',
    'derive() variant Team; predicted ICU hash'
  ),

  // ---- msg() rewritten with gt-next/unstable msg ----
  bbf9419b8e6f5802: E(
    '2ecf88ef9e8e4259',
    'msg',
    'match',
    "msg('Home') from /unstable"
  ),
  f2e973382c8e5a89: E(
    'e4d2a41d27c49ad0',
    'msg',
    'match',
    'msg`Shop` from /unstable'
  ),
  '184c9605dde81513': E(
    '64e9647d8379767b',
    'msg',
    'match',
    "msg('Orders') from /unstable"
  ),
  '397acff1597e5c65': E(
    '273902a55b863099',
    'msg',
    'match',
    'msg({ context })`Out of stock`'
  ),

  // ---- edited: must not match ----
  f7cdb7902cbcc65b: E(
    null,
    'edited-must-not-match',
    'no-match',
    'msg text edited "Help center" -> "Help & support"',
    { editedFrom: '0df20c4461cf42ab' }
  ),
  '0079aeb4fb3872a8': E(
    null,
    'edited-must-not-match',
    'no-match',
    'text edited "Mark all as read" -> "Mark all notifications as read"',
    { editedFrom: 'b78a7929feb88b2c' }
  ),
  '83aa329716569865': E(
    null,
    'edited-must-not-match',
    'no-match',
    'text edited "Last login: {when, date, medium}" -> "Last signed in ${date(...)}"',
    { editedFrom: 'ba8daa74a1c6bdc5' }
  ),
  '1089420314519f6b': E(
    null,
    'edited-must-not-match',
    'no-match',
    'context edited "Discount label, as in save 20%" -> "Discount label"; two old "Save" messages share the text with different contexts and translations, and neither hash verifies with the new context, so the text match is ambiguous',
    { editedFrom: 'fe691435bd365176' }
  ),

  // ---- brand new ----
  '06505a35a712feb6': E(null, 'new', 'no-match', 'new message'),
  '0ab9fbbc81f6f785': E(
    null,
    'new',
    'no-match',
    'new message with ${{ viewers }}'
  ),
};

const broken = [
  {
    hash: '8732b45d6a9de0b3',
    locale: 'fr',
    reason: 'ICU argument {name} renamed to {nom}',
  },
  {
    hash: 'b0717a26ba687fd1',
    locale: 'de',
    reason: 'GTJSX Currency variable _gt_cost_2 dropped',
  },
  {
    hash: '87ad24956d2ad354',
    locale: 'ja',
    reason: 'ICU plural without an other branch',
  },
];

// ---- consistency checks ----
const errors = [];
for (const hash of Object.keys(newSource))
  if (!messages[hash]) errors.push(`new hash ${hash} has no expectation`);
for (const [hash, m] of Object.entries(messages)) {
  if (!newSource[hash]) errors.push(`expectation for unknown new hash ${hash}`);
  if (m.intent && !(m.intent in oldEn))
    errors.push(`intent ${m.intent} not in old en.json`);
  if (m.editedFrom && !(m.editedFrom in oldEn))
    errors.push(`editedFrom ${m.editedFrom} not in old en.json`);
  if ((m.expect === 'no-match') !== (m.intent === null))
    errors.push(`inconsistent expect/intent for ${hash}`);
}
const intents = Object.values(messages)
  .map((m) => m.intent)
  .filter(Boolean);
const dupes = intents.filter((h, i) => intents.indexOf(h) !== i);
if (dupes.length) errors.push(`duplicate intents ${dupes}`);
for (const b of broken)
  if (!(b.hash in oldEn)) errors.push(`broken ${b.hash} not in old en.json`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const claimed = new Set(intents);
const unclaimedOld = Object.keys(oldEn)
  .filter((h) => !claimed.has(h))
  .sort();

const sortedMessages = Object.fromEntries(
  Object.keys(messages)
    .sort()
    .map((k) => [k, messages[k]])
);
const count = (pred) => Object.values(messages).filter(pred).length;
const kinds = {};
for (const m of Object.values(messages))
  kinds[m.kind] = (kinds[m.kind] ?? 0) + 1;
const expected = {
  summary: {
    oldMessages: Object.keys(oldEn).length,
    newMessages: Object.keys(newSource).length,
    expectMatch: count((m) => m.expect === 'match'),
    expectOptional: count((m) => m.expect === 'optional'),
    expectNoMatch: count((m) => m.expect === 'no-match'),
    sameKey: count(
      (m) => m.intent !== null && newSource[m.intent] !== undefined
    ),
    kinds,
  },
  messages: sortedMessages,
  brokenTranslations: broken,
  oldMessagesWithoutNewCounterpart: unclaimedOld,
};
fs.writeFileSync(
  path.join(dir, 'expected.json'),
  JSON.stringify(expected, null, 2) + '\n'
);
console.error(JSON.stringify(expected.summary, null, 2));
console.error(
  'unclaimed old:',
  unclaimedOld.map((h) => `${h} ${JSON.stringify(oldEn[h])}`).join('\n  ')
);
