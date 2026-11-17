// Generates an app for the load benchmark: a Vite SPA of lazy routes with a
// set number of messages, written once with gt-react and once per locale with
// its strings hard-coded.
//   node scripts/load/generate.mjs --name flat-5k --shape flat --messages 5000
//     [--locales fr-CA,de,es]   the translated locales, or how many of LOCALES
//     [--hardcoded en,fr-CA]    the locales to write the hard-coded app in
//     [--entry-messages 50]     messages of the shell, in the entry chunk
//     [--repeated 0.16]         share of messages that several modules repeat
// and for --shape app, the shape of a large app (see SHAPES.app):
//     [--routes 700] [--dialogs 400] [--shared-chunks 92]
//     [--shared-share 0.42] [--shared-import 0.25] [--spread 1.2]
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { hashSource } from 'generaltranslation/id';
import { createRandom, toTree, writers } from '../generate.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const appsRoot = join(here, '..', '..', 'apps');

const DEFAULT_LOCALE = 'en';
const LOCALES = [
  'fr-CA',
  'de',
  'es',
  'it',
  'pt-BR',
  'nl',
  'sv',
  'pl',
  'ja',
  'ko',
  'zh-CN',
];
const KINDS = ['plain', 'jsx', 'interp', 'plural', 'select'];
// A message that modules repeat is in at most this many of them.
const MOST_COPIES = 274;

// The kinds of scripts/generate.mjs in the same proportions, for a module of
// any size; plural and select alternate between modules as they do there.
const mix = (size, index) => {
  const counts = {
    jsx: Math.round(size * 0.15),
    interp: Math.round(size * 0.09),
    plural: Math.floor(size * 0.025 + (index % 2 ? 0.5 : 0)),
    select: Math.floor(size * 0.005 + (index % 2 ? 0 : 0.5)),
  };
  const others = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return { plain: size - others, ...counts };
};

/** `count` sizes of at least 1 that add up to `total`, as uneven as `spread` says. */
function unevenSizes(count, total, spread, random) {
  const weights = Array.from({ length: count }, () => {
    // Box-Muller: a log-normal weight, so most modules are small and a few large.
    const normal =
      Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
    return Math.exp(spread * normal);
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  const spare = Math.max(0, total - count);
  const sizes = weights.map((weight) => 1 + Math.floor((weight / sum) * spare));
  let rest = total - sizes.reduce((a, b) => a + b, 0);
  for (let i = 0; rest > 0; i = (i + 1) % count, rest--) sizes[i]++;
  return sizes;
}

/**
 * The modules of each shape. A module holds `size` messages of its own,
 * renders the modules of `renders`, imports those of `holds` without
 * rendering them, as it would a panel it shows later, and imports those of
 * `lazy` with `import()`. A route is its modules, outermost first.
 *
 * `flat` is the shape of the render benchmark: every route is one lazy chunk
 * of 100 messages. `nested` puts each page under a lazy section layout and
 * gives it two of the widgets that pages share, which the bundler moves into
 * chunks of their own. `app` is the shape of a large app.
 */
const SHAPES = {
  flat({ own }) {
    const modules = Array.from(
      { length: Math.max(3, Math.round(own / 100)) },
      (_, page) => ({ name: 'Route', file: `routes/r${page}.jsx`, size: 100 })
    );
    return {
      modules,
      routes: modules.map((module, page) => ({
        path: `/r/${page}`,
        modules: [module],
      })),
      visit: ['/r/0', '/r/1', '/r/2'],
    };
  },
  nested({ own }) {
    const scale = Math.max(1, Math.round(own / 5000));
    const pagesPerSection = 6;
    const layouts = Array.from({ length: 10 * scale }, (_, section) => ({
      name: 'Route',
      file: `sections/s${section}.jsx`,
      size: 20,
    }));
    const widgets = Array.from({ length: 24 * scale }, (_, widget) => ({
      name: 'Widget',
      file: `shared/w${widget}.jsx`,
      size: 25,
    }));
    const routes = layouts.flatMap((layout, section) =>
      Array.from({ length: pagesPerSection }, (_, index) => {
        const page = section * pagesPerSection + index;
        return {
          path: `/s/${section}/p/${index}`,
          modules: [
            layout,
            {
              name: 'Route',
              file: `routes/s${section}-p${index}.jsx`,
              size: 70,
              renders: [
                widgets[page % widgets.length],
                widgets[(page * 5 + 7) % widgets.length],
              ],
            },
          ],
        };
      })
    );
    return {
      modules: [
        ...layouts,
        ...widgets,
        ...routes.map((route) => route.modules[1]),
      ],
      routes,
      // The second route shares the first one's layout; the third does not.
      visit: ['/s/0/p/0', '/s/0/p/1', '/s/1/p/0'],
    };
  },
  /**
   * Lazy routes, lazy chunks that a route loads on an interaction
   * (`dialogs`), and a pool of shared modules with `sharedShare` of the
   * messages. The build packs the pool into `sharedChunks` chunks that import
   * each other, so a route that imports any of it loads all of it, as a
   * bundler does with the modules that three or more chunks import. At module
   * level a route imports only `sharedImport` of the pool: it renders one
   * group of ten shared modules and holds the others. The remaining messages
   * are spread over the routes and dialogs, unevenly (`spread`), so most
   * chunks hold few messages. Unset counts scale with the messages.
   */
  app({ own, options, random }) {
    const scale = options.messages / 65000;
    const routeCount = options.routes ?? Math.max(3, Math.round(700 * scale));
    const dialogCount = options.dialogs ?? Math.round(400 * scale);
    const chunkCount =
      options.sharedChunks ?? Math.max(3, Math.round(92 * scale));
    const groupSize = 10;
    const shared = Math.round(options.messages * options.sharedShare);

    const pool = unevenSizes(chunkCount * groupSize, shared, 0.8, random).map(
      // A group's modules follow each other, so they are in different chunks.
      (size, index) => ({
        name: 'Shared',
        file: `pool/c${index % chunkCount}/p${index}.jsx`,
        size,
        hub: true,
      })
    );
    const groups = Array.from({ length: chunkCount }, (_, group) => {
      const [head, ...members] = pool.slice(
        group * groupSize,
        (group + 1) * groupSize
      );
      head.renders = members;
      return head;
    });
    const pick = (count) => {
      const picked = new Set();
      while (picked.size < count) {
        picked.add(groups[Math.floor(random() * groups.length)]);
      }
      return [...picked];
    };
    const groupsPerRoute = Math.min(
      groups.length,
      Math.max(1, Math.round(groups.length * options.sharedImport))
    );

    const sizes = unevenSizes(
      routeCount + dialogCount,
      own - shared,
      options.spread,
      random
    );
    const dialogs = Array.from({ length: dialogCount }, (_, dialog) => ({
      name: 'Dialog',
      file: `dialogs/d${dialog}.jsx`,
      size: sizes[routeCount + dialog],
      renders: pick(1),
    }));
    const pages = Array.from({ length: routeCount }, (_, route) => {
      const [rendered, ...held] = pick(groupsPerRoute);
      return {
        name: 'Route',
        file: `routes/r${route}.jsx`,
        size: sizes[route],
        renders: [rendered],
        holds: held,
        lazy: [],
      };
    });
    dialogs.forEach((dialog, index) => {
      pages[index % routeCount].lazy.push(dialog);
      // One dialog in ten also opens from another route.
      if (index % 10 === 0 && routeCount > 1) {
        pages[(index * 7 + 3) % routeCount].lazy.push(dialog);
      }
    });
    return {
      modules: [...pool, ...dialogs, ...pages],
      routes: pages.map((module, route) => ({
        path: `/r/${route}`,
        modules: [module],
      })),
      visit: ['/r/0', '/r/1', '/r/2'],
      // What makes the pool's chunks import each other: every shared module
      // imports the hub, and the hub a module of every chunk.
      hub: {
        file: 'pool/c0/hub.js',
        links: Array.from(
          { length: chunkCount },
          (_, chunk) => `pool/c${chunk}/link.js`
        ),
      },
    };
  },
};

// ===== Messages ===== //

const WORDS =
  'account action activity address alert amount answer archive area arrival article assistant audio backup badge balance banner basket batch billing board bookmark border branch browser budget bundle button calendar camera campaign canvas capacity catalog category center channel chapter chart checklist checkout circle citation clipboard cluster collection column comment company compass confirm connection contact container content context control corner counter coupon course credit cursor dashboard dataset deadline delivery department deposit design desktop detail device dialog directory discount display document domain download draft drawer duration editor element email entry envelope episode estimate event example exchange expense export feature feedback field figure filter folder footer format formula forum frame gallery gateway glossary group guide handle header heading history holiday image import inbox index indicator insight invite invoice journal journey keyboard keyword label language layout ledger lesson letter level library license limit location locker margin marker meeting member memory menu message method metric minute mobile module monitor network notebook notice number object offer office option order outline output overview owner package palette panel paragraph partner password pattern payment period permission picture pipeline planner platform playlist pocket pointer policy portal position preview pricing printer priority privacy process product profile program project prompt proposal provider publish purchase quality query question queue quota rating reader receipt record region release reminder renewal report request resource response result review reward routine sample schedule scheme screen search season section security segment selection sender sequence server service session setting shelter shortcut sidebar signal signature snapshot source spreadsheet station status storage stream student subject summary supplier support survey symbol system tablet target teacher template terminal theme thread ticket timeline toolbar topic total tracker traffic transfer trigger tutorial update upload usage vendor version viewer visitor volume voucher wallet warning website widget window workflow workspace'.split(
    ' '
  );

const VOWELS = 'aeiouAEIOU';
// One set of accented vowels per locale, so a page shows which locale's
// translation it rendered.
const ACCENTS = [
  'áéíóúÁÉÍÓÚ',
  'äëïöüÄËÏÖÜ',
  'àèìòùÀÈÌÒÙ',
  'âêîôûÂÊÎÔÛ',
  'ãẽĩõũÃẼĨÕŨ',
  'āēīōūĀĒĪŌŪ',
  'ăĕĭŏŭĂĔĬŎŬ',
  'ąęįǫųĄĘĮǪŲ',
  'ǎěǐǒǔǍĚǏǑǓ',
  'ạẹịọụẠẸỊỌỤ',
  'ảẻỉỏủẢẺỈỎỦ',
];

/**
 * A pseudo-translation as long as its source: the first vowel of every word
 * takes the locale's accent. A text that repeats its source would compress to
 * almost nothing next to it, and a marker in front of every text would too.
 */
const localize = (text, accents) =>
  text.replace(/[A-Za-z]+/g, (word) =>
    word.replace(/[aeiouAEIOU]/, (vowel) => accents[VOWELS.indexOf(vowel)])
  );

function translate(message, accents) {
  if (!accents) return message;
  return Object.fromEntries(
    Object.entries(message).map(([field, value]) => [
      field,
      field === 'kind' ? value : localize(value, accents),
    ])
  );
}

function createMessageFactory(random) {
  const used = new Set();
  const phrase = (min, max) => {
    const length = min + Math.floor(random() * (max - min + 1));
    const words = Array.from(
      { length },
      () => WORDS[Math.floor(random() * WORDS.length)]
    );
    words[0] = words[0][0].toUpperCase() + words[0].slice(1);
    return words.join(' ');
  };
  const create = (kind) => {
    switch (kind) {
      case 'plain':
      case 'jsx':
        return { kind, text: phrase(2, 8) };
      // What modules repeat is short: a button, a column heading.
      case 'common':
        return { kind: 'plain', text: phrase(1, 3) };
      case 'interp':
        return {
          kind,
          before: `${phrase(1, 3)}, `,
          after: ` ${phrase(1, 3)}`,
        };
      case 'plural':
        return {
          kind,
          one: ` ${phrase(1, 2)}`,
          other: ` ${phrase(1, 2)}s`,
        };
      case 'select':
        return { kind, admin: phrase(1, 3), other: phrase(1, 3) };
    }
  };
  // Every message is its own text, so every message has its own hash.
  return (kind) => {
    for (;;) {
      const message = create(kind);
      const key = Object.values(message).slice(1).join('|');
      if (used.has(key)) continue;
      used.add(key);
      return message;
    }
  };
}

// ===== Source code ===== //

const js = (text) => JSON.stringify(text);

// What an app written in one language holds: the strings themselves.
const hardcoded = {
  imports: (up, messages) =>
    messages.some((message) => message.kind === 'plural')
      ? `import { plural } from '${up}plural.js';\n`
      : '',
  item(message) {
    switch (message.kind) {
      case 'plain':
      case 'jsx':
        return `<li>{${js(message.text)}}</li>`;
      case 'interp':
        return `<li>{${js(message.before)} + name + ${js(message.after)}}</li>`;
      case 'plural':
        return `<li>{plural(count, ${js(message.one)}, ${js(message.other)})}</li>`;
      case 'select':
        return `<li>{role === 'admin' ? ${js(message.admin)} : ${js(message.other)}}</li>`;
    }
  },
};

const gt = {
  imports: () => writers.unstable.imports,
  item: (message) =>
    message.kind === 'jsx'
      ? `<li>${writers.unstable.jsx(message)}</li>`
      : `<li>{${writers.unstable.expression(message)}}</li>`,
};

const pluralModule = (locale) => `let rules;
let number;

export const plural = (count, one, other) =>
  (number ??= new Intl.NumberFormat(${js(locale)})).format(count) +
  ((rules ??= new Intl.PluralRules(${js(locale)})).select(count) === 'one'
    ? one
    : other);
`;

/** A component of `messages`, then the modules it renders, then its children. */
function componentModule(writer, module, messages, hub) {
  const up = '../'.repeat(module.file.split('/').length - 1) || './';
  const renders = module.renders ?? [];
  const holds = module.holds ?? [];
  const lazy = module.lazy ?? [];
  const imports = [...renders, ...holds]
    .map(
      (part, i) =>
        `import { ${part.name} as Part${i} } from '${up}${part.file}';\n`
    )
    .join('');
  const items = messages
    .map((message) => `        ${writer.item(message)}`)
    .join('\n');
  const list = `      <ul${module.hub ? ' data-cluster={cluster.length}' : ''}>\n${items}\n      </ul>\n`;
  return `${writer.imports(up, messages)}${imports}${module.hub ? `import { cluster } from '${up}${hub.file}';\n` : ''}${
    holds.length
      ? `\nexport const held = [${holds.map((_, i) => `Part${renders.length + i}`).join(', ')}];\n`
      : ''
  }${
    lazy.length
      ? `\nexport const lazy = [\n${lazy.map((part) => `  () => import('${up}${part.file}'),`).join('\n')}\n];\n`
      : ''
  }
export function ${module.name}({ name, count, role, children }) {
  return (
    <>
${module.name === 'Shell' ? `      <header>\n${list}      </header>\n` : list}${renders
    .map((_, i) => `      <Part${i} name={name} count={count} role={role} />\n`)
    .join('')}      {children}
    </>
  );
}
`;
}

function hubModules(hub) {
  const up = '../'.repeat(hub.file.split('/').length - 1);
  return [
    ...hub.links.map((file, chunk) => [
      file,
      `export const link = { chunk: ${chunk} };\n`,
    ]),
    [
      hub.file,
      `${hub.links.map((file, chunk) => `import { link as link${chunk} } from '${up}${file}';\n`).join('')}
export const cluster = [${hub.links.map((_, chunk) => `link${chunk}`).join(', ')}];
`,
    ],
  ];
}

function routesModule(routes) {
  const entries = routes
    .map(
      (route) =>
        `  ${js(route.path)}: [${route.modules.map((module) => `() => import('./${module.file}')`).join(', ')}],`
    )
    .join('\n');
  return `// Each route's layouts and page, outermost first.
export const routes = {
${entries}
};
`;
}

const initModules = (locales) => ({
  // The whole catalog of the user's locale, as an app loads it today.
  'catalog.js': `import { initializeGTSPA } from 'gt-react';
import gtConfig from '../../gt.config.json';

const catalogs = {
${locales.map((locale) => `  ${js(locale)}: () => import('../_gt/${locale}.json'),`).join('\n')}
};

export function init() {
  return initializeGTSPA({
    defaultLocale: gtConfig.defaultLocale,
    locales: gtConfig.locales,
    loadTranslations: async (locale) => (await catalogs[locale]()).default,
  });
}
`,
  // For a build that brings its translations itself.
  'config.js': `import { initializeGTSPA } from 'gt-react';
import gtConfig from '../../gt.config.json';

export function init() {
  return initializeGTSPA({
    defaultLocale: gtConfig.defaultLocale,
    locales: gtConfig.locales,
  });
}
`,
  'none.js': `export function init() {}\n`,
});

// ===== Output ===== //

export function generate(options) {
  const { name, locales, hardcodedLocales } = options;
  if (!SHAPES[options.shape])
    throw new Error(`Unknown shape "${options.shape}"`);
  if (locales.length > ACCENTS.length) {
    throw new Error(`At most ${ACCENTS.length} translated locales`);
  }
  const accents = Object.fromEntries(
    locales.map((locale, i) => [locale, ACCENTS[i]])
  );

  // mulberry32 from one seed: an app is identical on every run and machine.
  const random = createRandom(20261117);
  const repeatedCount = Math.round(options.messages * options.repeated);
  const shape = SHAPES[options.shape]({
    own: options.messages - options.entryMessages - repeatedCount,
    options,
    random,
  });
  const createMessage = createMessageFactory(random);
  const createMessages = (size, index) => {
    const counts = mix(size, index);
    return KINDS.flatMap((kind) =>
      Array.from({ length: counts[kind] }, () => createMessage(kind))
    );
  };
  const shell = { name: 'Shell', file: 'Shell.jsx' };
  shell.messages = createMessages(options.entryMessages, 0);
  shape.modules.forEach((module, index) => {
    module.messages = createMessages(module.size, index);
  });

  // Messages that several modules repeat: most are in two of them, a few in
  // many (a Pareto distribution of the copies). The shared pool repeats none,
  // so it holds the share of the messages it was given.
  const repeating = shape.modules.filter((module) => !module.hub);
  const common = Array.from({ length: repeatedCount }, () =>
    createMessage('common')
  );
  for (const message of common) {
    const copies = Math.min(
      MOST_COPIES,
      repeating.length,
      Math.floor(2 / Math.sqrt(1 - random()))
    );
    const placed = new Set();
    while (placed.size < copies) {
      placed.add(Math.floor(random() * repeating.length));
    }
    for (const index of placed) repeating[index].messages.push(message);
  }

  const modules = [shell, ...shape.modules];
  for (const module of modules) {
    // Fisher-Yates, so the kinds are spread through the module as in an app.
    for (let i = module.messages.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [module.messages[i], module.messages[j]] = [
        module.messages[j],
        module.messages[i],
      ];
    }
  }
  const allMessages = [
    ...new Set(modules.flatMap((module) => module.messages)),
  ];

  const root = join(appsRoot, name);
  const write = (file, content) => {
    const path = join(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  };
  rmSync(join(root, 'src'), { recursive: true, force: true });
  cpSync(join(here, 'template', 'index.html'), join(root, 'index.html'));
  for (const file of ['main.jsx', 'App.jsx']) {
    mkdirSync(join(root, 'src'), { recursive: true });
    cpSync(join(here, 'template', file), join(root, 'src', file));
  }

  write(
    'gt.config.json',
    JSON.stringify(
      {
        defaultLocale: DEFAULT_LOCALE,
        locales,
        files: { gt: { output: 'src/_gt/[locale].json' } },
      },
      null,
      2
    ) + '\n'
  );
  for (const [file, content] of Object.entries(initModules(locales))) {
    write(`src/init/${file}`, content);
  }

  // gt-react: one source for every locale, and a catalog per locale.
  const writeSource = (directory, writer, messagesOf) => {
    for (const module of modules) {
      write(
        `${directory}/${module.file}`,
        componentModule(writer, module, messagesOf(module), shape.hub)
      );
    }
    for (const [file, content] of shape.hub ? hubModules(shape.hub) : []) {
      write(`${directory}/${file}`, content);
    }
    write(`${directory}/routes.js`, routesModule(shape.routes));
  };
  writeSource('src/gt', gt, (module) => module.messages);
  const hashes = allMessages.map((message) =>
    message.kind === 'jsx'
      ? hashSource({ source: message.text, dataFormat: 'JSX' })
      : hashSource({ source: toTree(message), dataFormat: 'MESSAGE_TREE' })
  );
  for (const locale of locales) {
    write(
      `src/_gt/${locale}.json`,
      JSON.stringify(
        Object.fromEntries(
          allMessages.map((message, i) => {
            const translated = translate(message, accents[locale]);
            return [
              hashes[i],
              message.kind === 'jsx' ? translated.text : toTree(translated),
            ];
          })
        )
      )
    );
  }

  // Hard-coded: the app as if it were written in each of these locales.
  for (const locale of hardcodedLocales) {
    writeSource(`src/hardcoded/${locale}`, hardcoded, (module) =>
      module.messages.map((message) => translate(message, accents[locale]))
    );
    write(`src/hardcoded/${locale}/plural.js`, pluralModule(locale));
  }

  const rendered = (module) =>
    module.messages.length +
    (module.renders ?? []).reduce((sum, part) => sum + rendered(part), 0);
  // What measure.mjs needs to know about a build of this app; Vite copies it
  // into the build.
  const manifest = {
    name,
    shape: options.shape,
    messages: allMessages.length,
    callSites: modules.reduce((sum, module) => sum + module.messages.length, 0),
    modules: modules.length,
    routes: shape.routes.length,
    options,
    defaultLocale: DEFAULT_LOCALE,
    locales,
    hardcodedLocales,
    visit: shape.visit,
    messageSelector: 'li',
    routeSelector: '[data-bench-route="{route}"]',
    // The module of each visited route's page, for distribution.mjs.
    visitModules: Object.fromEntries(
      shape.routes
        .filter((route) => shape.visit.includes(route.path))
        .map((route) => [route.path, route.modules.at(-1).file])
    ),
    routeMessages: Object.fromEntries(
      shape.routes
        .filter((route) => shape.visit.includes(route.path))
        .map((route) => [
          route.path,
          route.modules.reduce((sum, module) => sum + rendered(module), 0),
        ])
    ),
    translatedText: Object.fromEntries(
      locales.map((locale) => [locale, `[${accents[locale]}]`])
    ),
  };
  write('public/bench-app.json', JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values: args } = parseArgs({
    options: {
      name: { type: 'string' },
      shape: { type: 'string', default: 'flat' },
      messages: { type: 'string', default: '5000' },
      locales: { type: 'string', default: '3' },
      hardcoded: { type: 'string', default: 'en,fr-CA' },
      'entry-messages': { type: 'string', default: '50' },
      repeated: { type: 'string' },
      routes: { type: 'string' },
      dialogs: { type: 'string' },
      'shared-chunks': { type: 'string' },
      'shared-share': { type: 'string', default: '0.42' },
      'shared-import': { type: 'string', default: '0.25' },
      spread: { type: 'string', default: '1.2' },
    },
  });
  const messages = Number(args.messages);
  const count = (value) => (value === undefined ? undefined : Number(value));
  const manifest = generate({
    name: args.name ?? `${args.shape}-${Math.round(messages / 1000)}k`,
    shape: args.shape,
    messages,
    locales: /^\d+$/.test(args.locales)
      ? LOCALES.slice(0, Number(args.locales))
      : args.locales.split(','),
    hardcodedLocales: args.hardcoded.split(','),
    entryMessages: Number(args['entry-messages']),
    // A large app repeats about one message in six across its chunks.
    repeated: Number(args.repeated ?? (args.shape === 'app' ? 0.16 : 0)),
    routes: count(args.routes),
    dialogs: count(args.dialogs),
    sharedChunks: count(args['shared-chunks']),
    sharedShare: Number(args['shared-share']),
    sharedImport: Number(args['shared-import']),
    spread: Number(args.spread),
  });
  console.log(
    `apps/${manifest.name}: ${manifest.messages} messages at ${manifest.callSites} call sites in ${manifest.modules} modules, ${manifest.routes} routes, ${manifest.locales.length} translated locales`
  );
}
