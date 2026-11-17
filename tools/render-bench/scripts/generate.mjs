// Generates the synthetic app: the same messages written for each variant,
// with pseudo-translations keyed by the hashes each runtime looks up.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { templateToMessage } from '@generaltranslation/icu/internal';
import { hashSource } from 'generaltranslation/id';
import { hashSource as hashSourceRelease } from 'generaltranslation-release/id';
import { indexVars as indexVarsRelease } from 'generaltranslation-release/internal';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gtConfig = JSON.parse(readFileSync(join(root, 'gt.config.json'), 'utf8'));

export const LOCALES = gtConfig.locales;
export const KINDS = ['plain', 'jsx', 'interp', 'plural', 'select'];
export const ROUTE_COUNT = 10;
export const ROUTE_SIZE = 100;

// Per 100 messages: 73% plain, 15% <T>, 9% interpolation, 2.5% plural, 0.5%
// select. A route holds whole messages, so plural and select alternate.
const routeMix = (route) => ({
  plain: 73,
  jsx: 15,
  interp: 9,
  plural: route % 2 === 0 ? 2 : 3,
  select: route % 2 === 0 ? 1 : 0,
});

const WORDS =
  'account activity address archive balance billing calendar change checkout comment confirm contact copy create dashboard delete details download draft edit email export filter folder history import invite invoice language member message network notification order password payment preview profile project publish receipt remove report request review schedule search security session settings share storage subscription summary support team template update upload usage version workspace'.split(
    ' '
  );

// mulberry32: the app must be identical on every run and machine.
function createRandom(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(20260214);
let nextId = 0;

// Every text ends in a unique id, so every message has its own hash.
function phrase(min, max) {
  const length = min + Math.floor(random() * (max - min + 1));
  const words = Array.from(
    { length },
    () => WORDS[Math.floor(random() * WORDS.length)]
  );
  words[0] = words[0][0].toUpperCase() + words[0].slice(1);
  return words.join(' ');
}

function createMessage(kind) {
  const id = String(nextId++).padStart(4, '0');
  switch (kind) {
    case 'plain':
    case 'jsx':
      return { kind, text: `${phrase(1, 6)} ${id}` };
    case 'interp':
      return {
        kind,
        before: `${phrase(1, 3)}, `,
        after: ` ${phrase(1, 3)} ${id}`,
      };
    case 'plural':
      return {
        kind,
        one: ` ${phrase(1, 2)} ${id}`,
        other: ` ${phrase(1, 2)}s ${id}`,
      };
    case 'select':
      return {
        kind,
        admin: `${phrase(1, 3)} ${id}`,
        other: `${phrase(1, 3)} ${id}`,
      };
  }
}

function createRoute(mix) {
  const messages = KINDS.flatMap((kind) =>
    Array.from({ length: mix[kind] }, () => createMessage(kind))
  );
  // Fisher-Yates, so the kinds are spread through the route as in an app.
  for (let i = messages.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [messages[i], messages[j]] = [messages[j], messages[i]];
  }
  return messages;
}

const routes = Array.from({ length: ROUTE_COUNT }, (_, route) =>
  createRoute(routeMix(route))
);
// One route per kind, for the cost of each kind alone; the micro-benchmark
// calls the same messages outside React.
const kindRoutes = Object.fromEntries(
  KINDS.map((kind) => [kind, createRoute({ [kind]: ROUTE_SIZE })])
);
const allMessages = [...routes.flat(), ...Object.values(kindRoutes).flat()];

// ===== Pseudo-translation ===== //

const MARK = (locale) => `[${locale}] `;

function translate(message, locale) {
  const mark = locale ? MARK(locale) : '';
  switch (message.kind) {
    case 'plain':
    case 'jsx':
      return { ...message, text: mark + message.text };
    case 'interp':
      return { ...message, before: mark + message.before };
    case 'plural':
      // The count comes first in both branches, so the mark follows it.
      return {
        ...message,
        one: ` ${mark}${message.one.trim()}`,
        other: ` ${mark}${message.other.trim()}`,
      };
    case 'select':
      return {
        ...message,
        admin: mark + message.admin,
        other: mark + message.other,
      };
  }
}

// ===== Message trees (gt-react/unstable) ===== //

function toTree(message) {
  switch (message.kind) {
    case 'plain':
      return templateToMessage([message.text], []).tree;
    case 'interp':
      return templateToMessage(
        [message.before, message.after],
        [{ kind: 'argument', name: 'name' }]
      ).tree;
    case 'plural': {
      const branch = (text) => ({
        strings: ['', text],
        holes: [{ kind: 'pound' }],
      });
      return templateToMessage(
        ['', ''],
        [
          {
            kind: 'plural',
            name: 'count',
            branches: {
              one: branch(message.one),
              other: branch(message.other),
            },
          },
        ]
      ).tree;
    }
    case 'select':
      return templateToMessage(
        ['', ''],
        [
          {
            kind: 'select',
            name: 'role',
            branches: { admin: message.admin, other: message.other },
          },
        ]
      ).tree;
  }
}

// ===== ICU strings (stable gt()) ===== //

function toIcu(message) {
  switch (message.kind) {
    case 'plain':
      return message.text;
    case 'interp':
      return `${message.before}{name}${message.after}`;
    case 'plural':
      return `{count, plural, one {#${message.one}} other {#${message.other}}}`;
    case 'select':
      return `{role, select, admin {${message.admin}} other {${message.other}}}`;
  }
}

// ===== Source code per variant ===== //

const js = (text) => JSON.stringify(text);
// Generated text has no backtick, backslash or `${`.
const tpl = (text) => text;

const writers = {
  unstable: {
    imports:
      "import { T } from 'gt-react';\nimport { n, part, plural, select, t } from 'gt-react/unstable';\n",
    expression(message) {
      switch (message.kind) {
        case 'plain':
          return `t\`${tpl(message.text)}\``;
        case 'interp':
          return `t\`${tpl(message.before)}\${{ name }}${tpl(message.after)}\``;
        case 'plural':
          return `t\`\${plural({ count }, { one: part\`\${n}${tpl(message.one)}\`, other: part\`\${n}${tpl(message.other)}\` })}\``;
        case 'select':
          return `t\`\${select({ role }, { admin: ${js(message.admin)}, other: ${js(message.other)} })}\``;
      }
    },
    jsx: (message) => `<T>${message.text}</T>`,
    routeSetup: '',
  },
  stable: {
    imports: "import { T, useGT } from 'gt-react';\n",
    expression(message) {
      const icu = js(toIcu(message));
      switch (message.kind) {
        case 'plain':
          return `gt(${icu})`;
        case 'interp':
          return `gt(${icu}, { name })`;
        case 'plural':
          return `gt(${icu}, { count })`;
        case 'select':
          return `gt(${icu}, { role })`;
      }
    },
    jsx: (message) => `<T>${message.text}</T>`,
    routeSetup: '  const gt = useGT();\n',
  },
  floor: {
    imports: "import { m } from './messages';\n",
    expression(message) {
      const index = allMessages.indexOf(message);
      switch (message.kind) {
        case 'plain':
        case 'jsx':
          return `m[${index}]`;
        case 'interp':
          return `m[${index}](name)`;
        case 'plural':
          return `m[${index}](count)`;
        case 'select':
          return `m[${index}](role)`;
      }
    },
    jsx(message) {
      return `{${this.expression(message)}}`;
    },
    routeSetup: '',
  },
};

function routeModule(writer, messages) {
  const items = messages
    .map((message) =>
      message.kind === 'jsx'
        ? `      <li>${writer.jsx(message)}</li>`
        : `      <li>{${writer.expression(message)}}</li>`
    )
    .join('\n');
  return `${writer.imports}
export function Route({ name, count, role }) {
${writer.routeSetup}  return (
    <ul>
${items}
    </ul>
  );
}
`;
}

// The micro-benchmark calls each site with its values; `<T>` needs React.
function microModule(writer) {
  const kinds = KINDS.filter((kind) => kind !== 'jsx')
    .map((kind) => {
      const sites = kindRoutes[kind]
        .map(
          (message) =>
            `      ({ name, count, role }) => ${writer.expression(message)},`
        )
        .join('\n');
      return `    ${kind}: [\n${sites}\n    ],`;
    })
    .join('\n');
  return `${writer.imports}
// A hook, so the stable variant can call useGT(); the sites it returns are
// then called outside React.
export function useMicroSites() {
${writer.routeSetup}  return {
${kinds}
  };
}
`;
}

function indexModule(hasTranslations) {
  const routeLoaders = routes
    .map((_, route) => `  () => import('./route-${route}.jsx'),`)
    .join('\n');
  const kindLoaders = KINDS.map(
    (kind) => `  ${kind}: () => import('./kind-${kind}.jsx'),`
  ).join('\n');
  const translationLoaders = LOCALES.map(
    (locale) => `  ${js(locale)}: () => import('./_gt/${locale}.json'),`
  ).join('\n');
  const msgLoaders = LOCALES.map(
    (locale) => `  ${js(locale)}: () => import('./_gt/${locale}.msg.json'),`
  ).join('\n');
  return `export { useMicroSites } from './micro.jsx';

export const routes = [
${routeLoaders}
];

export const kinds = {
${kindLoaders}
};
${
  hasTranslations
    ? `
const translations = {
${translationLoaders}
};

export async function loadTranslations(locale) {
  return (await translations[locale]()).default;
}

const msgTranslations = {
${msgLoaders}
};

// What the compiler does not embed at a call site.
export async function loadMsgTranslations(locale) {
  return (await msgTranslations[locale]?.())?.default ?? {};
}
`
    : ''
}`;
}

// ===== Translations per variant ===== //

// The compiler embeds <T> and templates whose values are all named; the
// CLI's msgOutput files keep the rest, which load at runtime.
const isEmbedded = (message) =>
  message.kind === 'jsx' ||
  message.kind === 'plain' ||
  message.kind === 'interp';

function treeTranslations(locale, messages = allMessages) {
  return Object.fromEntries(
    messages.map((message) => {
      const translated = translate(message, locale);
      return message.kind === 'jsx'
        ? [
            hashSource({ source: message.text, dataFormat: 'JSX' }),
            translated.text,
          ]
        : [
            hashSource({ source: toTree(message), dataFormat: 'MESSAGE_TREE' }),
            toTree(translated),
          ];
    })
  );
}

function icuTranslations(locale) {
  return Object.fromEntries(
    allMessages.map((message) => {
      const translated = translate(message, locale);
      return message.kind === 'jsx'
        ? [
            hashSourceRelease({ source: message.text, dataFormat: 'JSX' }),
            translated.text,
          ]
        : [
            hashSourceRelease({
              source: indexVarsRelease(toIcu(message)),
              dataFormat: 'ICU',
            }),
            toIcu(translated),
          ];
    })
  );
}

// The floor: what a compiler could emit at best, a string or a function of
// the values per message and locale.
function floorMessages(locale) {
  const entries = allMessages
    .map((message) => {
      const { before, after, one, other, admin, text } = translate(
        message,
        locale === gtConfig.defaultLocale ? undefined : locale
      );
      switch (message.kind) {
        case 'plain':
        case 'jsx':
          return `  ${js(text)},`;
        case 'interp':
          return `  (name) => ${js(before)} + name + ${js(after)},`;
        case 'plural':
          return `  (count) => plural(count, ${js(one)}, ${js(other)}),`;
        case 'select':
          return `  (role) => (role === 'admin' ? ${js(admin)} : ${js(other)}),`;
      }
    })
    .join('\n');
  // Built when first used, as gt-react builds its own.
  return `let rules;
let number;
const plural = (count, one, other) =>
  (number ??= new Intl.NumberFormat(${js(locale)})).format(count) +
  ((rules ??= new Intl.PluralRules(${js(locale)})).select(count) === 'one'
    ? one
    : other);

export const m = [
${entries}
];
`;
}

function floorMessagesModule() {
  const loaders = [gtConfig.defaultLocale, ...LOCALES]
    .map(
      (locale) => `  ${js(locale)}: () => import('./messages.${locale}.js'),`
    )
    .join('\n');
  return `const loaders = {
${loaders}
};

export let m;

export async function loadMessages(locale) {
  m = (await loaders[locale]()).m;
}
`;
}

// ===== Output ===== //

const generated = join(root, 'src', 'generated');

function write(variant, file, content) {
  const path = join(generated, variant, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

export function generate() {
  rmSync(generated, { recursive: true, force: true });
  for (const [variant, writer] of Object.entries(writers)) {
    routes.forEach((messages, route) =>
      write(variant, `route-${route}.jsx`, routeModule(writer, messages))
    );
    for (const kind of KINDS) {
      write(variant, `kind-${kind}.jsx`, routeModule(writer, kindRoutes[kind]));
    }
    write(variant, 'micro.jsx', microModule(writer));
    write(variant, 'index.js', indexModule(variant !== 'floor'));
  }
  for (const locale of LOCALES) {
    write(
      'unstable',
      `_gt/${locale}.json`,
      JSON.stringify(treeTranslations(locale))
    );
    write(
      'unstable',
      `_gt/${locale}.msg.json`,
      JSON.stringify(
        treeTranslations(
          locale,
          allMessages.filter((message) => !isEmbedded(message))
        )
      )
    );
    write(
      'stable',
      `_gt/${locale}.json`,
      JSON.stringify(icuTranslations(locale))
    );
  }
  for (const locale of [gtConfig.defaultLocale, ...LOCALES]) {
    write('floor', `messages.${locale}.js`, floorMessages(locale));
  }
  write('floor', 'messages.js', floorMessagesModule());
}

if (process.argv[1] === fileURLToPath(import.meta.url)) generate();
