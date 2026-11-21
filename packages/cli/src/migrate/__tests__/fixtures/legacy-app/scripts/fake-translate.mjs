// Deterministic fake translations for the legacy fixture app.
//
// Reads public/_gt/en.json (written by the legacy `gt generate`) plus
// legacy-metadata.json (dataFormat per hash, dumped from the legacy CLI) and
// writes public/_gt/<locale>.json keyed by the same hashes, in the format the
// legacy CLI downloads (recursively sorted keys, 2-space JSON), plus a trailing
// newline so the files are stable under oxfmt.
//
// Only literal text changes: ICU arguments, plural/select/selectordinal
// branches, `#`, number/date arguments, GTJSX elements (by `i`) and variables
// (by `k`) are preserved. Plural categories are deliberately incomplete for
// some locales (see CARDINAL_PARTIAL, RU_FULL_PLURALS and ORDINAL), and a few translations are deliberately
// broken (see BROKEN).
//
// Usage: node scripts/fake-translate.mjs [projectDir]
import fs from 'node:fs';
import path from 'node:path';

const projectDir = path.resolve(process.argv[2] ?? '.');
const gtDir = path.join(projectDir, 'public/_gt');
const en = JSON.parse(fs.readFileSync(path.join(gtDir, 'en.json'), 'utf8'));
const metadata = JSON.parse(
  fs.readFileSync(path.join(projectDir, 'legacy-metadata.json'), 'utf8')
);

const LOCALES = ['fr', 'de', 'ru', 'ja', 'ar'];

// ---------- text transform ----------

const VOCAB = {
  fr: {
    you: 'vous',
    your: 'votre',
    have: 'avez',
    order: 'commande',
    orders: 'commandes',
    item: 'article',
    items: 'articles',
    cart: 'panier',
    the: 'le',
    a: 'un',
    new: 'nouvelle',
    notification: 'notification',
    notifications: 'notifications',
    day: 'jour',
    days: 'jours',
    save: 'enregistrer',
    settings: 'paramètres',
    message: 'message',
    messages: 'messages',
    unread: 'non lu',
    and: 'et',
    of: 'de',
    on: 'sur',
    in: 'dans',
    is: 'est',
    with: 'avec',
    us: 'nous',
    plan: 'forfait',
    home: 'accueil',
    shop: 'boutique',
    help: 'aide',
    center: 'centre',
    search: 'rechercher',
    products: 'produits',
    sign: 'se',
    welcome: 'bienvenue',
    back: 'retour',
    deals: 'offres',
    today: "aujourd'hui",
    shipped: 'expédiée',
    pending: 'en attente',
    hi: 'salut',
    remove: 'retirer',
  },
  de: {
    you: 'Sie',
    your: 'Ihr',
    have: 'haben',
    order: 'Bestellung',
    orders: 'Bestellungen',
    item: 'Artikel',
    items: 'Artikel',
    cart: 'Warenkorb',
    the: 'der',
    a: 'ein',
    new: 'neue',
    notification: 'Benachrichtigung',
    notifications: 'Benachrichtigungen',
    day: 'Tag',
    days: 'Tage',
    save: 'speichern',
    settings: 'Einstellungen',
    message: 'Nachricht',
    messages: 'Nachrichten',
    unread: 'ungelesene',
    and: 'und',
    of: 'von',
    on: 'am',
    in: 'im',
    is: 'ist',
    with: 'mit',
    us: 'uns',
    plan: 'Tarif',
    home: 'Startseite',
    shop: 'Shop',
    help: 'Hilfe',
    center: 'Center',
    search: 'suchen',
    products: 'Produkte',
    welcome: 'willkommen',
    back: 'zurück',
    deals: 'Angebote',
    today: 'heute',
    shipped: 'versandt',
    pending: 'ausstehend',
    hi: 'hallo',
    remove: 'entfernen',
  },
  ru: {
    you: 'вы',
    your: 'ваш',
    have: 'имеете',
    order: 'заказ',
    orders: 'заказы',
    item: 'товар',
    items: 'товаров',
    cart: 'корзина',
    the: '',
    a: '',
    new: 'новых',
    notification: 'уведомление',
    notifications: 'уведомлений',
    day: 'день',
    days: 'дней',
    save: 'сохранить',
    settings: 'настройки',
    message: 'сообщение',
    messages: 'сообщений',
    unread: 'непрочитанных',
    and: 'и',
    of: 'из',
    on: 'на',
    in: 'в',
    is: '—',
    with: 'с',
    us: 'нами',
    plan: 'тариф',
    home: 'главная',
    shop: 'магазин',
    help: 'помощь',
    center: 'центр',
    search: 'искать',
    products: 'товары',
    welcome: 'добро пожаловать',
    back: 'обратно',
    deals: 'предложения',
    today: 'сегодня',
    shipped: 'отправлен',
    pending: 'ожидает',
    hi: 'привет',
    remove: 'удалить',
  },
  ja: {
    you: 'あなた',
    your: 'あなたの',
    have: '持っています',
    order: '注文',
    orders: '注文',
    item: '商品',
    items: '商品',
    cart: 'カート',
    the: '',
    a: '',
    new: '新しい',
    notification: '通知',
    notifications: '通知',
    day: '日',
    days: '日',
    save: '保存',
    settings: '設定',
    message: 'メッセージ',
    messages: 'メッセージ',
    unread: '未読',
    and: 'と',
    of: 'の',
    on: 'に',
    in: 'の中',
    is: 'は',
    with: 'と',
    us: '私たち',
    plan: 'プラン',
    home: 'ホーム',
    shop: 'ショップ',
    help: 'ヘルプ',
    center: 'センター',
    search: '検索',
    products: '製品',
    welcome: 'ようこそ',
    back: 'おかえり',
    deals: 'お得情報',
    today: '今日',
    shipped: '発送済み',
    pending: '保留中',
    hi: 'こんにちは',
    remove: '削除',
  },
  ar: {
    you: 'أنت',
    your: 'الخاص بك',
    have: 'لديك',
    order: 'طلب',
    orders: 'طلبات',
    item: 'عنصر',
    items: 'عناصر',
    cart: 'السلة',
    the: 'ال',
    a: '',
    new: 'جديد',
    notification: 'إشعار',
    notifications: 'إشعارات',
    day: 'يوم',
    days: 'أيام',
    save: 'حفظ',
    settings: 'الإعدادات',
    message: 'رسالة',
    messages: 'رسائل',
    unread: 'غير مقروءة',
    and: 'و',
    of: 'من',
    on: 'على',
    in: 'في',
    is: 'هو',
    with: 'مع',
    us: 'نحن',
    plan: 'خطة',
    home: 'الرئيسية',
    shop: 'المتجر',
    help: 'مساعدة',
    center: 'مركز',
    search: 'بحث',
    products: 'منتجات',
    welcome: 'مرحبا',
    back: 'عودة',
    deals: 'عروض',
    today: 'اليوم',
    shipped: 'تم الشحن',
    pending: 'قيد الانتظار',
    hi: 'مرحبا',
    remove: 'إزالة',
  },
};

const MARKER = {
  fr: '[fr] ',
  de: '[de] ',
  ru: '[ru] ',
  ja: '[ja] ',
  ar: '[ar] ',
};

function matchCase(source, word) {
  if (!word) return word;
  if (
    source[0] === source[0].toUpperCase() &&
    source[0] !== source[0].toLowerCase()
  ) {
    return word[0].toUpperCase() + word.slice(1);
  }
  return word;
}

function translateText(locale, text) {
  return text.replace(/[A-Za-z]+/g, (w) => {
    const hit = VOCAB[locale][w.toLowerCase()];
    return hit === undefined ? w : matchCase(w, hit);
  });
}

// ---------- plural policy ----------

// Which plural categories a translation keeps, by locale and message.
// `full` uses every CLDR category of the locale; `partial` mimics typical
// real-world catalogs that omit some required categories.
const CARDINAL_FULL = {
  fr: ['one', 'many', 'other'],
  de: ['one', 'other'],
  ru: ['one', 'few', 'many', 'other'],
  ja: ['other'],
  ar: ['zero', 'one', 'two', 'few', 'many', 'other'],
};
const CARDINAL_PARTIAL = {
  fr: ['one', 'other'], // no `many`
  de: ['one', 'other'],
  ru: ['one', 'other'], // no `few`/`many`
  ja: ['other'],
  ar: ['one', 'other'], // no zero/two/few/many
};
const ORDINAL = {
  fr: ['one', 'other'],
  de: ['other'],
  ru: ['other'],
  ja: ['other'],
  ar: ['other'],
};

// Messages whose ru translation carries the full one/few/many/other set.
const RU_FULL_PLURALS = new Set([
  '66a6905db9c3ad9b', // You have {count, plural, ...} new notifications
  'f5683e647a65e15c', // {count, plural, one {# item} other {# items}}
  '7a94e62ddf761bf9', // <Plural> items in your cart (JSX)
]);

function cardinalCategories(locale, hash) {
  if (locale === 'ru' && RU_FULL_PLURALS.has(hash)) return CARDINAL_FULL.ru;
  return CARDINAL_PARTIAL[locale];
}

// Builds the translated branch map: exact (=N) keys are kept, CLDR categories
// follow the policy, and missing categories borrow the source's `other` (or
// `one`) branch, as a translator would.
function pluralBranches(kind, locale, hash, branches, translateBranch) {
  const out = {};
  for (const key of Object.keys(branches)) {
    if (key.startsWith('=')) out[key] = translateBranch(branches[key], key);
  }
  const categories =
    kind === 'selectordinal'
      ? ORDINAL[locale]
      : cardinalCategories(locale, hash);
  for (const category of categories) {
    const from =
      branches[category] ??
      (category === 'one' ? branches.one : undefined) ??
      branches.other;
    out[category] = translateBranch(from, category);
  }
  return out;
}

// ---------- ICU parse / print (subset used by the fixture) ----------

function parseIcu(src) {
  let pos = 0;
  function parseMessage(inPlural, stopAtBrace) {
    const nodes = [];
    let text = '';
    const flush = () => {
      if (text) nodes.push({ type: 'text', value: text });
      text = '';
    };
    while (pos < src.length) {
      const ch = src[pos];
      if (ch === '}') {
        if (!stopAtBrace) throw new Error(`Unbalanced } in ${src}`);
        break;
      }
      if (ch === "'") throw new Error(`Apostrophes are not supported: ${src}`);
      if (ch === '#' && inPlural) {
        flush();
        nodes.push({ type: 'pound' });
        pos++;
        continue;
      }
      if (ch === '{') {
        flush();
        nodes.push(parseArgument());
        continue;
      }
      text += ch;
      pos++;
    }
    flush();
    return nodes;
  }
  function skipWs() {
    while (/\s/.test(src[pos])) pos++;
  }
  function readUntil(re) {
    const start = pos;
    while (pos < src.length && !re.test(src[pos])) pos++;
    return src.slice(start, pos).trim();
  }
  function parseArgument() {
    pos++; // {
    skipWs();
    const name = readUntil(/[,}]/);
    if (src[pos] === '}') {
      pos++;
      return { type: 'argument', name };
    }
    pos++; // ,
    skipWs();
    const kind = readUntil(/[,}]/);
    if (src[pos] === '}') {
      pos++;
      return { type: 'simple', name, kind };
    }
    pos++; // ,
    if (kind === 'plural' || kind === 'selectordinal' || kind === 'select') {
      const branches = {};
      let offset;
      for (;;) {
        skipWs();
        if (src[pos] === '}') {
          pos++;
          break;
        }
        const key = readUntil(/[\s{]/);
        if (key.startsWith('offset:')) {
          offset = key.slice('offset:'.length);
          continue;
        }
        skipWs();
        if (src[pos] !== '{')
          throw new Error(`Expected { after ${key} in ${src}`);
        pos++;
        branches[key] = parseMessage(kind !== 'select', true);
        pos++; // }
      }
      return { type: kind, name, branches, offset };
    }
    // number/date/time with a style
    const style = readUntil(/}/);
    pos++;
    return { type: 'simple', name, kind, style };
  }
  const nodes = parseMessage(false, false);
  if (pos !== src.length) throw new Error(`Trailing input in ${src}`);
  return nodes;
}

function printIcu(nodes) {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
          return node.value;
        case 'pound':
          return '#';
        case 'argument':
          return `{${node.name}}`;
        case 'simple':
          return node.style
            ? `{${node.name}, ${node.kind}, ${node.style}}`
            : `{${node.name}, ${node.kind}}`;
        default: {
          const offset = node.offset ? ` offset:${node.offset}` : '';
          const branches = Object.entries(node.branches)
            .map(([key, value]) => `${key} {${printIcu(value)}}`)
            .join(' ');
          return `{${node.name}, ${node.type},${offset} ${branches}}`;
        }
      }
    })
    .join('');
}

function isDeclaredVar(node) {
  return node.type === 'select' && node.name.startsWith('_gt_');
}

function translateIcuNodes(locale, hash, nodes) {
  return nodes.map((node) => {
    if (node.type === 'text')
      return { ...node, value: translateText(locale, node.value) };
    if (node.type === 'plural' || node.type === 'selectordinal') {
      return {
        ...node,
        branches: pluralBranches(node.type, locale, hash, node.branches, (b) =>
          translateIcuNodes(locale, hash, b)
        ),
      };
    }
    if (node.type === 'select' && !isDeclaredVar(node)) {
      return {
        ...node,
        branches: Object.fromEntries(
          Object.entries(node.branches).map(([k, v]) => [
            k,
            translateIcuNodes(locale, hash, v),
          ])
        ),
      };
    }
    return node;
  });
}

function addMarker(locale, nodes) {
  if (nodes[0]?.type === 'text')
    nodes[0] = { ...nodes[0], value: MARKER[locale] + nodes[0].value };
  else nodes.unshift({ type: 'text', value: MARKER[locale] });
  return nodes;
}

function translateIcu(locale, hash, source) {
  const nodes = translateIcuNodes(locale, hash, parseIcu(source));
  // Mark the first top-level literal; messages that are a single plural get the
  // marker inside each branch instead, so the ICU stays a single argument.
  if (
    nodes.length === 1 &&
    (nodes[0].type === 'plural' ||
      nodes[0].type === 'selectordinal' ||
      nodes[0].type === 'select')
  ) {
    for (const branch of Object.values(nodes[0].branches))
      addMarker(locale, branch);
    return printIcu(nodes);
  }
  return printIcu(addMarker(locale, nodes));
}

// ---------- GTJSX ----------

function isVariable(node) {
  return (
    node && typeof node === 'object' && !Array.isArray(node) && 'k' in node
  );
}

function translateJsx(locale, hash, node) {
  if (typeof node === 'string') return translateText(locale, node);
  if (Array.isArray(node))
    return node.map((child) => translateJsx(locale, hash, child));
  if (!node || typeof node !== 'object' || isVariable(node)) return node;
  const out = { ...node };
  if ('c' in node) out.c = translateJsx(locale, hash, node.c);
  if (node.d) {
    out.d = { ...node.d };
    if (node.d.b) {
      const translateBranch = (b) => translateJsx(locale, hash, b);
      out.d.b =
        node.t === 'Plural'
          ? pluralBranches('plural', locale, hash, node.d.b, translateBranch)
          : Object.fromEntries(
              Object.entries(node.d.b).map(([k, v]) => [k, translateBranch(v)])
            );
    }
    for (const attr of ['pl', 'ti', 'alt', 'arl', 'arb', 'ard']) {
      if (typeof node.d[attr] === 'string')
        out.d[attr] = translateText(locale, node.d[attr]);
    }
  }
  return out;
}

function markJsx(locale, node) {
  // Prefix the first literal string found depth-first; each Plural/Branch
  // branch (and its default children) gets its own marker.
  const state = { done: false };
  const visit = (n) => {
    if (typeof n === 'string') {
      if (!state.done && /\p{L}/u.test(n)) {
        state.done = true;
        return MARKER[locale] + n;
      }
      return n;
    }
    if (Array.isArray(n)) return n.map(visit);
    if (!n || typeof n !== 'object' || isVariable(n)) return n;
    const out = { ...n };
    if (n.d?.b) {
      out.d = {
        ...n.d,
        b: Object.fromEntries(
          Object.entries(n.d.b).map(([k, v]) => {
            state.done = false;
            return [k, visit(v)];
          })
        ),
      };
      state.done = false;
      if ('c' in n) out.c = visit(n.c);
      state.done = true;
      return out;
    }
    if ('c' in n) out.c = visit(n.c);
    return out;
  };
  return visit(node);
}

// ---------- context-dependent translations ----------

// The two "Save" messages differ only by context; a translator renders them
// differently, which makes a text-only match between them ambiguous.
const OVERRIDES = {
  fe691435bd365176: {
    fr: '[fr] Économisez',
    de: '[de] Sparen',
    ru: '[ru] Экономия',
    ja: '[ja] お得',
    ar: '[ar] وفّر',
  },
};

// ---------- deliberately broken translations ----------

// (hash, locale) → a replacement that a migration must reject.
const BROKEN = {
  // ICU: the {name} argument was renamed by the "translator".
  '8732b45d6a9de0b3:fr': () => '[fr] {nom} a commenté votre publication',
  // GTJSX: the Currency variable (_gt_cost_2) was dropped.
  'b0717a26ba687fd1:de': (value) =>
    Array.isArray(value)
      ? value.filter(
          (child) => !(isVariable(child) && child.k === '_gt_cost_2')
        )
      : value,
  // ICU plural without the required `other` branch.
  '87ad24956d2ad354:ja': () =>
    '{days, plural, one {[ja] 無料トライアル残り#日}}',
};

// ---------- main ----------

function sortKeys(_key, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  );
}

const broken = [];
for (const locale of LOCALES) {
  const out = {};
  for (const [hash, source] of Object.entries(en)) {
    const meta = metadata[hash];
    if (!meta) throw new Error(`No metadata for ${hash}`);
    let value;
    if (meta.dataFormat === 'JSX') {
      value = markJsx(locale, translateJsx(locale, hash, source));
    } else {
      value = translateIcu(locale, hash, source);
    }
    if (OVERRIDES[hash]?.[locale]) value = OVERRIDES[hash][locale];
    const breaker = BROKEN[`${hash}:${locale}`];
    if (breaker) {
      value = breaker(value);
      broken.push({ hash, locale });
    }
    out[hash] = value;
  }
  fs.writeFileSync(
    path.join(gtDir, `${locale}.json`),
    JSON.stringify(out, sortKeys, 2) + '\n'
  );
}
console.error(
  `Wrote ${LOCALES.length} locales × ${Object.keys(en).length} messages`
);
console.error('Broken:', JSON.stringify(broken));
