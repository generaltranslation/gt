# @generaltranslation/compiler

## 2.0.0-samsara.10

### Major Changes

- c8e2b0b: **Breaking:** the tagged-template API is now the message API of the main entries, and the string functions it replaces are removed. `t`, `msg`, `tx`, and the functions that `useGT()`, `getGT()`, `useMessages()` and `getMessages()` return no longer take an ICU string. `<T>` and the other components, the dictionary API under `/compat`, gt-svelte and gt-vue are unchanged.

  ```diff
    const t = useGT(); // or await getGT(), or the t that gt-react exports
  - t('Hello, {name}!', { name });
  + t`Hello, ${{ name }}!`;
  - t('Save', { $context: 'button', $maxChars: 10 });
  + t({ context: 'button', maxChars: 10 })`Save`;
  - t('{count, plural, one {# item} other {# items}}', { count });
  + t`${plural({ count }, { one: part`${n} item`, other: part`${n} items` })}`;

  - const greeting = msg('Hello, {name}!', { name });
  + const greeting = msg`Hello, ${{ name }}!`;
    m(greeting); // m from useMessages() or getMessages()

  - await tx('Hello, {name}!', { name, $context: 'greeting' });
  + await tx({ context: 'greeting' })`Hello, ${{ name }}!`;
  - await tx(userText);
  + await tx`${dyn(userText)}`;
  ```

  A tagged template is stored as a message tree, not as an ICU string, and its hash is not the hash of the string it replaces, so every migrated message is translated again. That includes `msg('Save')`, which reads the same as before. Run `gt translate` after migrating.

  **The functions that keep their name**, on `gt-i18n`, `gt-react`, `gt-react-native`, `gt-next`, `gt-next/server`, `gt-tanstack-start` and `gt-node`, wherever each was exported:
  - `t` and the function from `useGT()` or `getGT()`: `t('Hello, {name}!', { name })` → `` t`Hello, ${{ name }}!` ``. Template text is literal, so `{`, `#` and `'` need no escaping.
  - Options: `$context`, `$maxChars` and `$requiresReview` → `t({ context, maxChars, requiresReview })` before the template. `$id`, `$format`, `$locale` and `$_hash` have no replacement.
  - ICU `plural`, `selectordinal` and `select` arguments → `plural()`, `selectordinal()` and `select()`, with `` part`...` `` for a branch that holds values and `n` for the count. ICU number, date and time arguments → `number()`, `date()` and `time()`. The main entries now export these helpers.
  - `useGT(messages)`, `useMessages(messages)` and `getGT(messages)` → `useGT()`, `useMessages()` and `getGT()`: they take no argument.
  - `msg('Hello, {name}!', { name })` → `` msg`Hello, ${{ name }}!` ``, and `msg('Save', { $context: 'button' })` → `` msg({ context: 'button' })`Save` ``. `msg('Save')` still works. `msg(['Save', 'Cancel'])` → one `msg()` call for each message.
  - `m(message, options)` from `useMessages()` or `getMessages()`, and `mFallback(message, options)` → `m(message, values)` and `mFallback(message, values)`: the second argument holds values only, and a string is rendered as literal text.
  - `tx('Hello', { $context })` from `gt-next/server` or `gt-node` → `` await tx({ context })`Hello` ``. `tx(text)` for text known only at runtime → `` tx`${dyn(text)}` ``, with `dyn` from the same entry. `tx` has no `$locale` option: it translates into the request locale in gt-next, and into the `withGT()` locale in gt-node.
  - `derive` is the tagged-template helper, as in `` t`Welcome ${derive(status)}!` ``: its argument is typed as a string literal or a union of them, and it returns a placeholder, not its argument. It is the only `derive`: `generaltranslation` no longer exports one.
  - `<T context={derive(getFormality())}>` works with it: `<T>` and `<Tx>` read the placeholder as their context, and the CLI extracts one entry for each value, which it finds by following the argument through the code (a call to a function that returns string literals, a `const`, or a conditional of them). TypeScript also checks the argument against `derive`'s type, so a function annotated `: string` needs a narrower return type.
  - `derive()` must be the whole context. `<T context={'tone: ' + derive(getFormality())}>`, a template literal around `derive()`, and `derive()` in one branch of a conditional → `<T context={derive(getTone())}>`, with `getTone()` returning the full text, as in ``return `tone: ${getFormality()}` as const``. The CLI and the compiler report the old forms as errors.
  - `t` and the new `m` from `gt-react` are still exported only under the `browser` condition, for client-rendered (SPA) apps. `gt-next`, `gt-tanstack-start`, `gt-react-native` and `gt-node` export neither.

  **Removed and moved exports:**
  - `decodeMsg` and `decodeOptions` from `gt-i18n`, `gt-react`, `gt-react-native`, `gt-next`, `gt-tanstack-start` and `gt-node`, and `gtFallback` from all of them but `gt-node`: no replacement. `msg('Save')` returns its text, and any other message from `msg` is a plain object that `m()` or `mFallback()` renders.
  - `declareVar` and `decodeVars` from the same entries and from `generaltranslation`: no replacement. A value in a tagged template is `${value}` or `${{ name }}`, and a `derive()` context has no values: every context is a string the CLI can read.
  - `derive` from `generaltranslation` → `derive` from `gt-i18n`, `gt-react`, `gt-react-native`, `gt-next`, `gt-tanstack-start` or `gt-node`, in a tagged template or as a `<T>` context.
  - The type `StringFormat` from `gt-next` → import it from `generaltranslation`.
  - Types `GTTranslationOptions` and `RuntimeTranslationOptions` from `gt-i18n`, `gt-react`, `gt-react-native`, `gt-next` and `gt-node` → `GTOptions`. Types `GTFunctionType` and `MFunctionType` from `gt-i18n` and `gt-node` → `GT` and `M`.
  - `gt-i18n` also drops the types `TemplateSyncResolutionFunction`, `SyncResolutionFunction`, `SyncResolutionFunctionWithFallback`, `RegisteredMessage` and `LookupOptionsFor`, with no replacement. `TranslationVariables` and `JsxTranslationOptions` → import them from `gt-i18n/internal`.
  - The string `msg`, `decodeOptions` and the types `GTFunctionType`, `MFunctionType`, `GTTranslationOptions`, `EncodedTranslationOptions` and `RegisterableMessages` leave the `gt-i18n` root for `gt-i18n/internal/string`, which still serves gt-svelte, gt-vue and the dictionary API.
  - `gt-i18n/internal`: `getGT()`, `getMessages()` and `tx` are the tagged ones, so `getGT()` → `getGT({ locale, enableI18n })`, and the same for `getMessages`. `getGTInternal`, `getMessagesInternal`, `txInternal`, `GtInternalRuntimeTranslateString` and `extractVariables` are removed. `interpolateMessage` → import it from `gt-i18n/internal/string`.
  - `gt-react` no longer exports `GtInternalRuntimeTranslateString`, which the compiler no longer injects.
  - `@generaltranslation/react-core`: `t` from `/pure`, and `useGT` and `useMessages` from `/hooks`, are the tagged ones. `/pure` adds `m`.
  - `generaltranslation/internal` no longer exports `extractVars` and `condenseVars`.

  **`gt` (CLI):** `gt translate`, `gt validate` and the other commands that read source extract `t`, `msg` and the functions from `useGT()` and `getGT()` as message trees when they are imported by name from a main entry. They no longer extract a string call such as `t('Hello')` or `msg('Hello, {name}!', { name })`, nor a `t` that is not imported, such as a global. A string call left in the code gets a warning that names it as one. `msg('Save')` is still extracted, as a message tree. In a `<T>` context, the CLI no longer reads `declareVar()`, and it reports a `derive()` it cannot resolve as an error: it used to upload the source text of the expression as the context. The CLI now warns when a main entry is loaded through `require()`, `import()`, a namespace import or a re-export that could carry one of these functions, since it follows only named imports. It no longer warns about `useGT()` in an async function or `getGT()` in a synchronous one. In a gt-svelte project, string calls in JavaScript and TypeScript modules are now extracted by the same rules as in `.svelte` files: an alias of `t` such as `const translate = t`, a `t` passed to a function in another file, and a literal `m('...')` call are no longer followed.

  **`@generaltranslation/compiler`:**
  - The `enableMacroTransform` and `stringTranslationMacro` options are removed, with no replacement: the compiler no longer rewrites `` t`...` `` into a string call, and no longer adds an import for a `t` that has none. Import `t` from `gt-react`.
  - It no longer hashes string calls, passes the collected messages to `useGT()` and `getGT()`, or translates strings in dev hot reload. With `compileTimeHash`, it injects `$_hash` into the tagged templates of `t`, `msg`, `useGT()` and `getGT()` imported from a main entry.
  - `autoderive` and `devHotReload` apply to JSX only: `autoderive` is a boolean and `devHotReload` is `{ jsx: true }`, in the plugin options and in `gt.config.json` (below).
  - The `context` of a `<T>` is a string literal or one `derive()` call with one argument. The argument no longer has to be a call: `derive(tone)` and `derive(formal ? 'formal' : 'casual')` are accepted.
  - gt-next's SWC plugin (`experimentalCompilerOptions.type: 'swc'`) handles `<T>` only. It leaves tagged templates as they are, and the runtime hashes them.

  **`gt.config.json`:** `files.gt.parsingFlags.autoderive` takes `true` or `false`, and `files.gt.parsingFlags.devHotReload` takes `{ "jsx": true }` or `{ "jsx": false }`. The forms that only configured string messages are removed, and a config that uses one is invalid: the CLI and gt-next stop with a message such as `files.gt.parsingFlags.devHotReload.strings: Invalid key`, and the compiler warns and builds without the file.
  - `"autoderive": { "jsx": true }` or `{ "jsx": true, "strings": true }` → `"autoderive": true`. `{ "strings": true }` alone → remove the flag.
  - `"devHotReload": { "jsx": true, "strings": true }` → `"devHotReload": { "jsx": true }`.
  - `"devHotReload": true` or `{ "strings": true }` → remove the flag. It only translated new string messages during development, which tagged templates now do at runtime without it.
  - `resolveAutoderive` from `generaltranslation/config-schema` is removed: read `parsingFlags.autoderive`, a boolean.

  **`@generaltranslation/react-core-linter`:** `static-string` now checks only `msg()`, whose argument must be a single string literal, as in `msg('Save')`. It no longer checks the string passed to the function from `useGT()` or `getGT()`, no longer validates ICU syntax, and has no autofix.

  **If you used a `samsara` prerelease,** the experimental `/unstable` entries are removed. Everything they exported is on the main entry:
  - `gt-i18n/unstable` → `gt-i18n`, and `gt-i18n/unstable/internal` → `gt-i18n/internal`, without its `tx`: build one with `createTx`.
  - `gt-react/unstable` → `gt-react`. `t` and `m` are exported only under the `browser` condition; `gt-react/unstable` also exported them to Node and worker builds.
  - `gt-react-native/unstable` → `gt-react-native`.
  - `gt-next/unstable` → `gt-next`, and `gt-next/unstable/server` → `gt-next/server`.
  - `gt-tanstack-start/unstable` → `gt-tanstack-start`.
  - `gt-node/unstable` → `gt-node`.
  - `@generaltranslation/react-core/unstable` → `t` and `m` from `@generaltranslation/react-core/pure`, and `useGT` and `useMessages` from `@generaltranslation/react-core/hooks`.
  - `generaltranslation/internal`: `isUnstableGTImportSource` → `isGTMessageImportSource`, `isUnstableGTHelperName` → `isGTMessageHelperName`, `UNSTABLE_GT_HELPER_NAMES` → `GT_MESSAGE_HELPER_NAMES`, and the type `UnstableGTHelperName` → `GTMessageHelperName`.
  - The lint rule `@generaltranslation/react-core-linter/unstable-static-branch` → `@generaltranslation/react-core-linter/static-branch`.

### Minor Changes

- 030bfd3: Add hash minification to builds with the experimental `experimentalSplitTranslations` option: `minifyHashes: true` in the option, or the `GT_MINIFY_HASHES` environment variable. A message's hash is random, so it does not compress, and it is most of what a message costs a page beyond its text. With hash minification on, the call sites such a build splits by chunk or by module, `<T>` and `t` templates from `gt-react`, pass an id in place of their hash, and the translation files of chunks hold no key at all: each file lists its translations once, with the ids that read each, which makes the JavaScript and those files smaller.

  An id is 8 characters that name the list of its chunk's messages, a `.`, and the place of its message in that list: `kR3_x0Qa.12`. The name is a digest of the hashes of the chunk's messages, in the order of the hashes, so an id still follows from content alone: the same id names the same message in every build, no build needs a table from another, and a page can read the translation files of any build. Every call site of a chunk repeats the name, so it compresses to little, and what is left of an id is a small number. A chunk's ids change only when the set of its own messages does, which changes the chunk anyway. A message that several chunks read has an id in each, and its translation is still in a file once: a file is `[translations, lists]`, where `lists` gives, for the list of each chunk, runs of a place in the list, the place of its translation in the file, and how many follow on from both. `gt-react/chunk-translations` reads such a file into an entry per id, so this needs a `gt-react` that does: compiled code imports that entry by names only such a `gt-react` exports, and the build fails on a missing export with one that does not.

  The hash of a message does not change anywhere else: the translation files at `files.gt.output`, the unsplit file, `msg` and every call site whose hash is computed at runtime keep it, and a message that a `t` template and a `msg` share is found under both. A `t` template whose hash is computed when it runs, because its options or a value are not written at the call, reads by hash as well: the build keeps every compiled message with the same text and structure in the unsplit file under its hash too, whatever its options and the names of its values. It warns of the modules whose call sites it cannot say that of, as with `derive()`; there, a message that a compiled call site also reads renders its source text. The build fails when two different lists of messages would share a name, when an id is already a key of the translation files, and when a chunk reaches the output with a call site that was not given its id. It also fails with `_tagIds`, which writes what a `<T>` passes into the page for tools that read it as the hash. In a build with the split off, `minifyHashes` and `GT_MINIFY_HASHES` are not read. Off by default, and a build without hash minification is unchanged.

- 42e739c: Add `by: 'module'` (or `GT_SPLIT_TRANSLATIONS_BY=module`) to the experimental `experimentalSplitTranslations` option. Translations are then split by the modules each entry and dynamic import can reach through static imports, not by chunk, so a page no longer downloads the translations of every module that the bundler packed into a chunk it loads. Messages that the same imports need share a file, and files are merged while one request less is worth more than the bytes a page then downloads without needing them: `requestCost` in the option sets what a request is worth in bytes, 8192 by default. No message is in two files. Such a build names each file by the hash of its own content (`naming: 'map'`, and it fails with `'token'`), and each locale's map lists the files every dynamic import needs, so no JavaScript grows with them and a page in the default locale downloads none of it. The build checks that every entry and import holds each message its modules can read, and fails if one would not.

  The split gains the most when a module runs when it is first imported, which is Rolldown's `output.strictExecutionOrder: true`. In a build that runs every module of a chunk as the chunk loads, a page also gets what those modules could read then, and the build prints how many messages that adds.

  `previous` in the option takes the path of the `gt-chunk-translations.json` that the build before wrote: messages then stay in the file they were in where that still fits, so a change to the app renames few translation files. The default split, by chunk, is unchanged.

- 9da4e35: Add the experimental `experimentalSplitTranslations` option (or the `GT_SPLIT_TRANSLATIONS` environment variable) for production builds of single-page apps on `gt-react` with Vite. The option is an object, and setting it turns the feature on: `experimentalSplitTranslations: {}`. `GT_SPLIT_TRANSLATIONS` (`true` or `false`) turns it on without the option and off with it, and `enabled` in the option overrides the variable. A key set in the option overrides its environment variable. One build then serves every locale without loading a locale's whole catalog: the build reads the translation files at `files.gt.output` and writes the translations of each JavaScript chunk into a JSON file per locale next to the chunk, named after the chunk with the locale and a token that changes whenever that locale's files do, so the files can be cached as immutable and no JavaScript file changes when a translation does. The entry chunk and its static imports share one file per locale, which a script added to `index.html` requests while the page is parsed, together with the files of the chunks the page preloads with `modulepreload` links; each dynamic import requests the files of the chunks it loads while they download and runs them once the files have arrived, so a module that reads a translation as it is evaluated gets it. Which files an import needs is in the entry's file, not in the JavaScript, so an import costs a page no more than without the option. A page in the default locale requests none. `<T>` and `t` templates from `gt-react` are split by chunk. The app's `loadTranslations` is not called in such a build, which takes it out of the options `initializeGTSPA` is called with, so the catalogs it imports are not chunks of the build and no JavaScript file names them: the translations of messages that are not split, such as `msg` and dictionaries, go into one more file per locale, which the page requests with the entry's file and gt-react reads as its catalog, and the build reports how many they are. The build also writes `gt-chunk-translations.json` into its assets directory, which lists the file of each chunk and locale and holds the startup script for apps that write their own HTML. The startup script is inline: under a Content Security Policy that allows no inline script it needs a nonce, which Vite's `html.cspNonce` puts on it, and where the policy blocks it, messages render the source text. Source maps are not kept accurate yet for the chunks the build rewrites after the bundler has rendered them: those that hold a dynamic import or the call that starts the app.

  `naming: 'map'` in the option names each file by the locale and the hash of its own content alone instead (`gt.<locale>.<hash>.json`), with one small map per locale that the page requests first, which says which file is each chunk's and which files each dynamic import needs. A changed translation then renames only the file it is in and the locale's map, a change to JavaScript alone renames only the map, and the files of chunks are requested once the map has arrived. With the default naming a file is named after its chunk, so a change to JavaScript that renames chunks renames their translation files too: `map` is the naming for an app that deploys often.

- fcc6f14: Build the message of each static `t` template at compile time. The template becomes a call that passes its message, with its hash, message tree and literal options, so the call site builds no tree when it renders. The message is written at the call and nothing is declared at module scope, so a call that runs before its module's body has run, as through an import cycle, works as the template did: `` t`Hello, ${{ name }}!` `` compiles to `t({ $_hash, $_tree: ['Hello, ', ['name'], '!'] }, { name })`, and `` t`Save` `` to `t({ $_hash, $_tree: 'Save' })`. This covers `t`, `useGT()` and `getGT()` templates with named or plain values and static `plural`, `selectordinal`, `select`, `part`, `n`, `number`, `date` and `time` helpers. `msg` templates, `derive()` and other non-static templates keep the tagged template, as before. Hashes do not change.

  These calls need runtime packages (`gt-react`, `gt-next`, `gt-i18n` and the other GT runtime packages) that read them. A file's templates are precomputed when the compiler finds the GT runtime that file resolves and it reads these calls. Next to an older runtime, and where it finds no runtime, it keeps the tagged templates and says so once per build; the new `precomputeMessages` plugin option sets it either way. A build is precomputed when its chunks hold `$_tree:`.

  A build with `experimentalSplitTranslations` splits the translations of these calls by chunk, or by module with `by: 'module'`, as it splits those of tagged templates.

- 7d841de: `<N />` is the count of the `<Plural>` it is in, formatted as a number, as `#` is in ICU.

  ```tsx
  <Plural n={count} one='One file'>
    <N /> files
  </Plural>
  ```

  Use it instead of `<Num>{count}</Num>` for the count. A translation can then show the count in any branch: English `one` only covers 1, so "One file" has none, but Russian uses `one` for 21 and 31 too and renders "21 файл". `<N />` takes no props. With no `<Plural>` to give it a count, it is an error in development and renders nothing in production.

  It is stored as a variable of the new type `#`, which the runtime fills from the plural's `n` wherever a translation puts it.

### Patch Changes

- 8065d02: A build with the experimental `experimentalSplitTranslations` option also writes `gt-current.json` into its assets directory, under that one name in every build: what the names of each locale's translation files follow from, and, for the split by chunk, how the build assigned messages to files. A page that stayed open while the app was deployed again reads it when a translation file it asks for is gone, which happens on a host that drops the files of earlier builds. Translation files are assets named by what they hold: deploy them with the chunks they sit next to and keep them as long, and serve `gt-current.json` as `index.html` is served, not cached for good.
- Updated dependencies [622199e]
- Updated dependencies [fcc6f14]
- Updated dependencies [3bedb87]
- Updated dependencies [7d841de]
- Updated dependencies [7d841de]
- Updated dependencies [c8e2b0b]
- Updated dependencies [e70da5f]
  - @generaltranslation/format@1.0.0-samsara.11
  - gt-i18n@2.0.0-samsara.11
  - @generaltranslation/icu@1.0.0-samsara.9
  - generaltranslation@10.0.0-samsara.11

## 2.0.0-samsara.9

### Major Changes

- 5cb51b4: **Breaking:** `<Plural>` and `<Branch>` now choose a branch the way `plural()` and `select()` do, in React, Vue and Svelte.
  - **ICU plural selection.** `<Plural>` picks an exact branch first, then the locale's plural category for `n`, then its children. `zero`, `one` and `two` are plural categories, no longer the numbers 0, 1 and 2: in English `zero` never matches, and in Japanese neither does `one`. For an exact number write `_0`, `_1` and so on, the JSX spelling of ICU's `=0`: `<Plural n={count} _0="No items" one="1 item">Many items</Plural>`. Stored content and translations use the ICU key, `=0`.
  - **No aliases.** The `singular`, `plural` and `dual` branches are removed: write `one`, the children and `two`. `PluralType` from `generaltranslation` no longer includes them.
  - **The children are the fallback, and `other` is not a prop.** The children of a `<Plural>` or a `<Branch>` are what `other` is in `plural()` and `select()`: the content for a value with no branch of its own. In Vue that is the default slot. `<Plural other="...">` no longer works, and `<Branch other="...">`, which used to match only the value `"other"`, no longer does: write the content as the children. `gt`, the compiler and the Vue and Svelte extractors report an `other` prop, slot or snippet as an error. Stored content and translations hold the children under the ICU key `other`, with the other branches. `gt` and the compiler also warn about a `<Plural>` prop that looks like an exact number but is not one, such as `_01` or `_1e3`.
  - **Stricter props.** `<Plural>` requires children, takes `n` as a `number` or a `bigint`, and no longer has a `locales` prop, so in Vue a `locales` attribute is a branch like any other. `<Branch>` requires children unless its branches cover every value of `branch`, as in `<Branch branch={isAdmin} true="Admin" false="Member" />`. `_locale` and `_enableI18n` are no longer in the prop types of `<Plural>` and `<Branch>`. `gt-react` exports the `BranchProps` type beside `PluralProps`.
  - **The translation picks the branch.** In a translated locale, the branch is chosen among the translation's branches, and the source branch of the same name fills in its variables and elements; when the source has no branch of that name, its children do. A source `_0` branch no longer renders untranslated in a locale whose translation has no `=0` branch. A translation with no branch for the value renders the source: that element in React and Vue, the whole `<T>` in Svelte.
  - **Errors.** In React, an `n` that is not a number or a bigint, and a value with no branch and no children, throw in development. In production they log an error; a non-numeric `n` renders the children, and a missing branch renders nothing. Children that are empty, such as `{null}`, are a fallback that renders nothing. A `bigint` too large to have a plural category throws a `RangeError` unless an exact branch matches it, as in `plural()`. In Svelte, a branch passed as `undefined` counts as absent, as in React.
  - **Synchronous `<Branch>` in gt-next.** In a Server Component, gt-next's `<Branch>` is now gt-react's component and no longer an async wrapper around it: choosing a branch never needed the request's locale.

  A `<T>` with a `<Plural>` or a `<Branch>` has new source content, so its hash changes and it is translated again: the children are stored as the `other` branch, and the elements and unnamed variables after them are numbered from the component, not from its children. `gt`, the compiler, the gt-next SWC plugin and the Vue and Svelte extractors all read the new props, so update them together with the runtime packages.

  The `static-jsx` lint rule's fix writes `{x && "Active"}` as `<Branch branch={!!x} true="Active">{null}</Branch>`, since a `false` value needs a fallback, and a `null` alternative of a ternary the same way. A string that JSX text would not read back as written, such as `"&amp;"` or `"a < b"`, is written in braces.

- 911fad6: **Breaking:** a spread attribute on a `<Plural>` or `<Branch>` in translated content, as in `<Plural n={count} {...forms} />`, is now an error in `gt` and the compiler. Both read the props of these components from the source to build the stored content of the enclosing `<T>` and its hash, and a spread hides its props from them: the branches were left out, the runtime hashed the real props, and the translation was never found. Write each prop out on the component. The Vue and Svelte extractors already reported such a spread. A `<Plural>` or `<Branch>` outside translated content is not affected.

  With `autoderive`, the compiler now reports an error like this one in a `<T>` even when an earlier child is dynamic content. It used to stop at the dynamic child, which `autoderive` allows, and never reach the error; `gt` already reported it.

- c0f8d3d: **Breaking:** a variable in the content of a `<T>` is found by its id, and has a name only when its author gave it one. A variable component without a `name` used to get a generated one, such as `_gt_cost_2`.

  ```diff
  - { "i": 2, "k": "_gt_cost_2", "v": "c" }   // <Currency>
  + { "i": 2, "v": "c" }

    { "i": 3, "k": "price", "v": "c" }        // <Currency name="price">, unchanged
  ```

  - `i` identifies a variable among its siblings, as it does an element. The runtimes match a translated variable to its value by `i`, so two variables with the same `name` no longer render the same value.
  - `v`, the type, is always there, and is how a variable is told from an element. `Variable` in `@generaltranslation/format` is now `{ i: number; v: VariableType; k?: string }`.
  - `k` is only a label for translators. An empty `name` counts as none, in every runtime and extractor.
  - `hashSource` hashes a variable by its `v` and, when it has one, its `k`.

  Every `<T>` that holds a `<Var>`, `<Num>`, `<Currency>`, `<DateTime>` or `<RelativeTime>` without a `name` gets a new hash. The runtimes, `gt`, the compiler, the Next.js SWC plugin and the Vue and Svelte extractors all write the new form, so upgrade them together, then run `gt translate` again. Translations stored under the old hashes are no longer found, and a translated variable needs its `i`: local translation files need their keys and variables updated or regenerated. A `<T>` whose variables all have a `name`, or that has no variables, keeps its hash.

  gt-svelte's `_gtm` metadata no longer lists variable names.

### Patch Changes

- ac272be: The compiler no longer expands `` t`...` `` imported from `gt-tanstack-start`, since `gt-tanstack-start` no longer exports `t`, which is only available in client-rendered (SPA) apps. Other imports from `gt-tanstack-start` are handled as before.
- Updated dependencies [2c3f4f6]
- Updated dependencies [2c3f4f6]
- Updated dependencies [cdee423]
- Updated dependencies [c30676f]
- Updated dependencies [7b5075a]
- Updated dependencies [2eec421]
- Updated dependencies [48db495]
- Updated dependencies [48db495]
- Updated dependencies [984147d]
- Updated dependencies [63851ee]
- Updated dependencies [550e8ca]
- Updated dependencies [5cb51b4]
- Updated dependencies [c0f8d3d]
- Updated dependencies [b078069]
  - generaltranslation@10.0.0-samsara.10
  - @generaltranslation/format@1.0.0-samsara.10
  - @generaltranslation/icu@1.0.0-samsara.8

## 2.0.0-samsara.8

### Major Changes

- 13dae8a: Remove the remaining backward compatibility:
  - The `legacyGtReactImportSource` option and `files.gt.parsingFlags.legacyGtReactImportSource` are removed; injected imports always come from `gt-react` (or `autoJsxImportSource`).
  - `gt-react/client` and `gt-react/browser` are no longer recognized as GT import sources; import from `gt-react`.
  - `<T>` hashing no longer reads `$context`, `$id`, `$maxChars`, `$requiresReview`, or `$_hash`; use the unprefixed props.

- 63b6748: The compiler validates the `gt.config.json` it reads from the project root with the shared schema. A file with invalid values is now ignored with a warning that lists the invalid keys, as a file that is not valid JSON already was, instead of being used as is. A JSON syntax error no longer quotes the file content, which can hold credentials.

  **Breaking:** `createInvalidGTConfigWarning` is no longer exported; the compiler formats its invalid-config warning itself. To format a similar message, use `createDiagnosticMessage()` from `generaltranslation/diagnostics`.

### Patch Changes

- ea429a2: The `enableAutoJsxInjection`, `autoderive` and `devHotReload` plugin options take their types from `generaltranslation`'s `GTParsingFlags`, and the compiler uses `resolveAutoderive()` from `generaltranslation/config-schema`. No behavior changes.
- cf7029c: Stop tracking `useTranslations()` and `getTranslations()` as translation callbacks. The tracking only ran a validation that never reported anything, so output is unchanged; the dictionary API now lives in `/compat` entries.
- e29f6f9: Resolve option defaults once, where the options are accepted, and pass required values to the code below. No behaviour change for apps.
  - `@generaltranslation/api` exports `DEFAULT_TIMEOUT_MS`, the default request timeout.
  - `gt-i18n/internal`: `I18nConfig`'s `resolveSupportedLocale(candidates)` no longer takes a config override and uses the configuration GT was initialized with. `determineSupportedLocale(candidates)` is removed; use `determineLocale(candidates)`, which matches the same way. `LocaleResolverConfig` is no longer exported.
  - `gt-i18n/internal/compat`: `new DictionaryManager()` takes a config with `dictionary`, `loadDictionary` and `cacheExpiryTime` all set. `initializeDictionaryManager()` still accepts the optional params and fills in the defaults.

- 943c094: Import types and helpers from their single owning entry now that the types-only subpaths are removed. No public API change.
- Updated dependencies [96f428a]
- Updated dependencies [2d7f9bd]
- Updated dependencies [ba09ee2]
- Updated dependencies [ba09ee2]
- Updated dependencies [63b6748]
- Updated dependencies [ea429a2]
- Updated dependencies [82999f0]
- Updated dependencies [ba09ee2]
- Updated dependencies [ba09ee2]
- Updated dependencies [943c094]
- Updated dependencies [ba09ee2]
- Updated dependencies [82999f0]
- Updated dependencies [96f428a]
- Updated dependencies [3832c15]
- Updated dependencies [943c094]
- Updated dependencies [06ccdfd]
- Updated dependencies [a191c9a]
- Updated dependencies [2d7f9bd]
- Updated dependencies [1a5e9ae]
- Updated dependencies [e29f6f9]
  - generaltranslation@10.0.0-samsara.9
  - @generaltranslation/format@1.0.0-samsara.9
  - @generaltranslation/icu@0.2.0-samsara.7

## 1.4.0-samsara.7

### Patch Changes

- Updated dependencies [fe7b0cc]
- Updated dependencies [2a5fe85]
- Updated dependencies [2a5fe85]
  - @generaltranslation/icu@0.2.0-samsara.6
  - generaltranslation@10.0.0-samsara.8
  - @generaltranslation/format@1.0.0-samsara.8

## 1.4.0-samsara.6

### Patch Changes

- Updated dependencies [b1b9d26]
- Updated dependencies [27c26cd]
- Updated dependencies [27c26cd]
  - @generaltranslation/icu@0.2.0-samsara.5
  - @generaltranslation/format@1.0.0-samsara.7
  - generaltranslation@10.0.0-samsara.7

## 1.4.0-samsara.5

### Patch Changes

- Updated dependencies [6440bd1]
- Updated dependencies [930e443]
- Updated dependencies [8dde4bb]
- Updated dependencies [84d0104]
- Updated dependencies [ada6894]
  - @generaltranslation/format@1.0.0-samsara.6
  - generaltranslation@10.0.0-samsara.6
  - @generaltranslation/icu@0.2.0-samsara.4

## 1.4.0-samsara.4

### Minor Changes

- 886232a: The data format of a message tree is named `MESSAGE_TREE`. It was `ICU_TREE`, which reads as the ICU parser's syntax tree, the one tree it is not; everything else already calls it a message tree (`MessageTree`, `formatMessageTree`, `messageTreeToIcu`).

  The name is part of what `hashSource` hashes, so every tagged-template message gets a new hash: regenerate the translations of `/unstable` messages. A server that still expects `ICU_TREE` rejects the new name, and the other way round.

### Patch Changes

- Updated dependencies [886232a]
  - generaltranslation@10.0.0-samsara.5
  - @generaltranslation/format@1.0.0-samsara.5

## 1.4.0-samsara.3

### Minor Changes

- 7ef8d91: Extraction and `$_hash` injection for `/unstable` tagged templates support `time()` and accept any expression for a formatting-context option such as `currency` or `timeZone`. Message options (`style`, `unit`, date and time fields) must still be literals. A message without placeholders, including `msg('Save')`, is one string tree, so its hash changes once.

### Patch Changes

- Updated dependencies [7ef8d91]
- Updated dependencies [7ef8d91]
- Updated dependencies [7ef8d91]
- Updated dependencies [3c013b5]
- Updated dependencies [c7ae5e3]
- Updated dependencies [7ef8d91]
- Updated dependencies [884e499]
- Updated dependencies [a186111]
- Updated dependencies [2eadfe1]
- Updated dependencies [b7fdac5]
  - @generaltranslation/icu@0.2.0-samsara.3
  - @generaltranslation/format@1.0.0-samsara.4
  - generaltranslation@10.0.0-samsara.4

## 1.4.0-samsara.2

### Patch Changes

- Updated dependencies [cf23e00]
  - generaltranslation@10.0.0-samsara.3

## 1.4.0-samsara.1

### Patch Changes

- Updated dependencies [b2aaf5e]
  - @generaltranslation/icu@0.2.0-samsara.2
  - generaltranslation@10.0.0-samsara.2
  - @generaltranslation/format@1.0.0-samsara.3

## 1.4.0-samsara.0

### Minor Changes

- f3ed76d: Inject compile-time `$_hash` values into statically analyzable `/unstable` tagged templates (`t`, `useGT()`, `getGT()`), so the runtime skips hashing them. Templates using `derive()` or other non-static values are left for the runtime to hash. The list of unstable import sources now lives in `generaltranslation/internal`.
- 07209de: The CLI extracts deferred `msg` messages imported from an `/unstable` entry as message trees. `` msg`...` `` and `` msg({ context, maxChars, requiresReview })`...` `` are extracted like `t`, including aliases, configured tags, and `derive()` variants. `msg('Save')`, or a template literal without values, uploads the literal text as the tree `['Save']`; any other `msg()` argument is skipped with a warning. Calls to the `m` function from `useMessages()` / `getMessages()` are not extracted. The compiler injects `$_hash` into static `` msg`...` `` templates, as it does for `t`.

### Patch Changes

- Updated dependencies [22b6915]
- Updated dependencies [f3ed76d]
- Updated dependencies [4b6ea22]
- Updated dependencies [cc73381]
- Updated dependencies [726168a]
- Updated dependencies [040ea63]
  - generaltranslation@10.0.0-samsara.1
  - @generaltranslation/format@1.0.0-samsara.2
  - @generaltranslation/icu@0.2.0-samsara.1

## 1.3.69

### Patch Changes

- Updated dependencies [[`7aae545`](https://github.com/generaltranslation/gt/commit/7aae545bd9e65148b8cbf98a4df3ce750ab1cdbf)]:
  - @generaltranslation/format@0.1.10
  - generaltranslation@9.5.12

## 1.3.68

### Patch Changes

- Updated dependencies [[`b3c3647`](https://github.com/generaltranslation/gt/commit/b3c3647239a6c44c3549e722b7001b83624865f8)]:
  - generaltranslation@9.5.11

## 1.3.67

### Patch Changes

- Updated dependencies [[`e1c64a3`](https://github.com/generaltranslation/gt/commit/e1c64a3c27c7a05ffeb81eb2d04ace795d0c3ab5)]:
  - generaltranslation@9.5.10

## 1.3.66

### Patch Changes

- Updated dependencies [[`c460193`](https://github.com/generaltranslation/gt/commit/c46019337dda8440a7174d783ad94a0f9b15f79a)]:
  - generaltranslation@9.5.9

## 1.3.66-samsara.0

### Patch Changes

- 85eab51: The compiler now handles `<T>`, `useGT`, `t`, and other GT imports from `gt-tanstack-start` the same way it handles imports from `gt-react`.
- 002f579: Export `GTCompilerOptions` from `generaltranslation/types`, the compiler options that framework integrations pass to `@generaltranslation/compiler`. The compiler's `PluginConfig`, gt-next's `experimentalCompilerOptions` and gt-tanstack-start's `experimentalCompilerOptions` now share it instead of repeating its fields.
- Updated dependencies [da7af80]
- Updated dependencies [bb107a8]
- Updated dependencies [002f579]
  - generaltranslation@10.0.0-samsara.0
  - @generaltranslation/format@1.0.0-samsara.1

## 1.3.65

### Patch Changes

- Updated dependencies []:
  - generaltranslation@9.5.8

## 1.3.65-samsara.0

### Patch Changes

- generaltranslation@9.5.8-samsara.0
- @generaltranslation/format@0.1.10-samsara.0

## 1.3.64

### Patch Changes

- Updated dependencies [[`c220f39`](https://github.com/generaltranslation/gt/commit/c220f39182a61be3d8139bfe18c5bced0f2956dc)]:
  - generaltranslation@9.5.7

## 1.3.63

### Patch Changes

- [#2452](https://github.com/generaltranslation/gt/pull/2452) [`aafa001`](https://github.com/generaltranslation/gt/commit/aafa0010d06d13d0c2d4f33a5cd86907037396b8) Thanks [@eoinest](https://github.com/eoinest)! - Number JSX elements after `Branch`/`Plural` children the same way the React runtime does, so extracted and compile-time hashes match the rendered `<T>` content.

## 1.3.62

### Patch Changes

- Updated dependencies [[`fe9f4b8`](https://github.com/generaltranslation/gt/commit/fe9f4b898548b94d7809be18f5e0dd9e80987428)]:
  - generaltranslation@9.5.6

## 1.3.61

### Patch Changes

- Updated dependencies []:
  - generaltranslation@9.5.5

## 1.3.60

### Patch Changes

- Updated dependencies []:
  - generaltranslation@9.5.4

## 1.3.59

### Patch Changes

- Updated dependencies [[`24db902`](https://github.com/generaltranslation/gt/commit/24db9022171bb47160545d94691ba528d93a08f3)]:
  - generaltranslation@9.5.3

## 1.3.58

### Patch Changes

- Updated dependencies [[`458398d`](https://github.com/generaltranslation/gt/commit/458398de6b89cb7124a838581cc5660aac25574b)]:
  - generaltranslation@9.5.2

## 1.3.57

### Patch Changes

- Updated dependencies [[`5d75eb4`](https://github.com/generaltranslation/gt/commit/5d75eb475a9e36a61845f0368566a9d40466251c)]:
  - generaltranslation@9.5.1

## 1.3.56

### Patch Changes

- Updated dependencies [[`87fa5b1`](https://github.com/generaltranslation/gt/commit/87fa5b17cc2dcd265bc96ab77259e4bc4a6c987f), [`78e3a57`](https://github.com/generaltranslation/gt/commit/78e3a57c19caffe8fbce2e9bc74e573071d662e8), [`0e87e42`](https://github.com/generaltranslation/gt/commit/0e87e42ac5d93a1c9ee1f5993d074d4c9a4ae387), [`370c31f`](https://github.com/generaltranslation/gt/commit/370c31f975cd1d2bfa9609ea1827c2900f812665), [`c734b08`](https://github.com/generaltranslation/gt/commit/c734b084f0a50d1b2787c86ec790403f88803650), [`322e927`](https://github.com/generaltranslation/gt/commit/322e9279b7efb17faf220e626a5a3696efc5d863), [`052d499`](https://github.com/generaltranslation/gt/commit/052d499556f3dcf7c6801d2ba91399783608e70b), [`d5649a4`](https://github.com/generaltranslation/gt/commit/d5649a4d9711c3f752a1706348398935bf44e8e1), [`abc7fea`](https://github.com/generaltranslation/gt/commit/abc7feaeb8be41709178d34db550d7af36c809af)]:
  - generaltranslation@9.5.0

## 1.3.55

### Patch Changes

- Updated dependencies []:
  - generaltranslation@9.4.3

## 1.3.54

### Patch Changes

- Updated dependencies []:
  - generaltranslation@9.4.2

## 1.3.53

### Patch Changes

- Updated dependencies [[`90109bf`](https://github.com/generaltranslation/gt/commit/90109bf9ec4900819023176320629a5069fd7b51)]:
  - @generaltranslation/format@0.1.9
  - generaltranslation@9.4.1

## 1.3.52

### Patch Changes

- Updated dependencies [[`50098c6`](https://github.com/generaltranslation/gt/commit/50098c68e33b13585dde418e227cfca1cef3bf7e), [`5f5843b`](https://github.com/generaltranslation/gt/commit/5f5843b94066d9ee9c0703722105a189d2a4e3d5)]:
  - generaltranslation@9.4.0

## 1.3.51

### Patch Changes

- Updated dependencies []:
  - generaltranslation@9.3.1

## 1.3.50

### Patch Changes

- Updated dependencies [[`8e59be2`](https://github.com/generaltranslation/gt/commit/8e59be28c129b4b9509ce8897156de3282b2a295)]:
  - generaltranslation@9.3.0

## 1.3.49

### Patch Changes

- Updated dependencies [[`8725a5c`](https://github.com/generaltranslation/gt/commit/8725a5c9235926cf1653a9306cca44045874c0dc), [`0e5d7e0`](https://github.com/generaltranslation/gt/commit/0e5d7e0efd48f98659a8229f7e48273070981f5b), [`3c33a75`](https://github.com/generaltranslation/gt/commit/3c33a75c738c2f433cfdf4e19d75b189c0100f38), [`4496e16`](https://github.com/generaltranslation/gt/commit/4496e161d7885f329bdfd7f4d04a7a58ed12d9d1), [`6ac4ba3`](https://github.com/generaltranslation/gt/commit/6ac4ba33a0230fb8aecae7c7677cfd38c361bd9c)]:
  - generaltranslation@9.2.0

## 1.3.48

### Patch Changes

- Updated dependencies [[`de66e5f`](https://github.com/generaltranslation/gt/commit/de66e5f41e05f22d51661faacae78b4fb3d86035)]:
  - generaltranslation@9.1.13

## 1.3.47

### Patch Changes

- Updated dependencies [[`44aabc7`](https://github.com/generaltranslation/gt/commit/44aabc734d99fab4fcab7faedc84d20b5772bde3)]:
  - generaltranslation@9.1.12

## 1.3.46

### Patch Changes

- Updated dependencies [[`091c964`](https://github.com/generaltranslation/gt/commit/091c964b45eba191d6e35bc1cdb93cc3683a3f71), [`b8a9679`](https://github.com/generaltranslation/gt/commit/b8a96797860f2bb7b12f3c307d47c9b1fead2096)]:
  - generaltranslation@9.1.11

## 1.3.45

### Patch Changes

- Updated dependencies []:
  - generaltranslation@9.1.10

## 1.3.44

### Patch Changes

- Updated dependencies []:
  - generaltranslation@9.1.9

## 1.3.43

### Patch Changes

- Updated dependencies [[`34845f9`](https://github.com/generaltranslation/gt/commit/34845f92d64fd9c94a712e4710e8958022066b7b)]:
  - generaltranslation@9.1.8

## 1.3.42

### Patch Changes

- [#2068](https://github.com/generaltranslation/gt/pull/2068) [`f2204b9`](https://github.com/generaltranslation/gt/commit/f2204b990278865c54d14d337392930ea1ec31bf) Thanks [@eoinest](https://github.com/eoinest)! - Represent React's persisted boolean and null rich-content values in the shared
  JSX wire types used by framework runtimes and translation catalogs.
- Updated dependencies [[`f2204b9`](https://github.com/generaltranslation/gt/commit/f2204b990278865c54d14d337392930ea1ec31bf), [`b05b470`](https://github.com/generaltranslation/gt/commit/b05b4703fbbfd34a3cbee335c786e2e606346167)]:
  - @generaltranslation/format@0.1.8
  - generaltranslation@9.1.7

## 1.3.38-iris.0

### Patch Changes

- f2204b9: Represent React's persisted boolean and null rich-content values in the shared
  JSX wire types used by framework runtimes and translation catalogs.
- 5d8b78a: Migrate the package license from FSL-1.1-ALv2 to MIT.
- Updated dependencies [f2204b9]
- Updated dependencies [b05b470]
- Updated dependencies [5d8b78a]
  - @generaltranslation/format@0.1.5-iris.0
  - generaltranslation@9.1.3-iris.0

## 1.3.41

### Patch Changes

- Updated dependencies [[`bb08d8c`](https://github.com/generaltranslation/gt/commit/bb08d8cc5df87c71dd2a31416087821dbae38aa8)]:
  - @generaltranslation/format@0.1.7
  - generaltranslation@9.1.6

## 1.3.40

### Patch Changes

- Updated dependencies [[`d0ae632`](https://github.com/generaltranslation/gt/commit/d0ae632ac0cd53600f6b893c23754dde06fbe808)]:
  - @generaltranslation/format@0.1.6
  - generaltranslation@9.1.5

## 1.3.39

### Patch Changes

- Updated dependencies [[`6607925`](https://github.com/generaltranslation/gt/commit/660792523b15d2e43e9752ea599e5229c1b45bc7)]:
  - generaltranslation@9.1.4

## 1.3.38

### Patch Changes

- [#2074](https://github.com/generaltranslation/gt/pull/2074) [`240a65e`](https://github.com/generaltranslation/gt/commit/240a65e9305a74cdfd4df07537fb4cfae8a2eac8) Thanks [@eoinest](https://github.com/eoinest)! - Migrate the package license from FSL-1.1-ALv2 to MIT.

- Updated dependencies [[`240a65e`](https://github.com/generaltranslation/gt/commit/240a65e9305a74cdfd4df07537fb4cfae8a2eac8)]:
  - @generaltranslation/format@0.1.5
  - generaltranslation@9.1.3

## 1.3.37

### Patch Changes

- Updated dependencies [[`b00b93e`](https://github.com/generaltranslation/gt/commit/b00b93eb3b830b8528ef3dbd5f503ff76d1b338a)]:
  - generaltranslation@9.1.2

## 1.3.36

### Patch Changes

- Updated dependencies [[`9b3eb92`](https://github.com/generaltranslation/gt/commit/9b3eb92fb1a916b5f47d15f51a9f39f6c62840a9)]:
  - generaltranslation@9.1.1

## 1.3.35

### Patch Changes

- Updated dependencies [[`bd961d1`](https://github.com/generaltranslation/gt/commit/bd961d1474547f7c6d470583c1b1190dce0112ca)]:
  - generaltranslation@9.1.0

## 1.3.34

### Patch Changes

- Updated dependencies [[`29cd6b8`](https://github.com/generaltranslation/gt/commit/29cd6b89f3587d3253cfadde6bec925d8697324b)]:
  - generaltranslation@9.0.5
  - @generaltranslation/format@0.1.4

## 1.3.33

### Patch Changes

- [#1950](https://github.com/generaltranslation/gt/pull/1950) [`d801c41`](https://github.com/generaltranslation/gt/commit/d801c41134554726a0436eaf5b7b3f0242a3a91f) Thanks [@JoshKappler](https://github.com/JoshKappler)! - Export an `rspack` plugin adapter alongside the existing `webpack`, `vite`, `rollup`, and `esbuild` adapters. This lets Rspack based toolchains (such as Rsbuild) wire the GT compiler in through `tools.rspack.plugins`. The adapter is the `rspack` output of the shared unplugin instance, so it behaves identically to the other bundler adapters.

- Updated dependencies [[`bbf4eb0`](https://github.com/generaltranslation/gt/commit/bbf4eb0cf77160baa615776619acd7afe35697ba), [`f53bb5e`](https://github.com/generaltranslation/gt/commit/f53bb5ea4b4989a2a4ad3aebf464011f01e029ad)]:
  - generaltranslation@9.0.4
  - @generaltranslation/format@0.1.3

## 1.3.32

### Patch Changes

- [#1918](https://github.com/generaltranslation/gt/pull/1918) [`dce7a7a`](https://github.com/generaltranslation/gt/commit/dce7a7a0b5b82ee0ac7ca3518030ab51026da103) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Allow framework integrations to configure the package used for automatic JSX injection imports.

- [#1916](https://github.com/generaltranslation/gt/pull/1916) [`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Unify `gt.config.json` types so complete config objects can be spread into compiler plugins and runtime initializers while file settings remain optional.

- Updated dependencies [[`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8)]:
  - generaltranslation@9.0.3

## 1.3.31

### Patch Changes

- [#1887](https://github.com/generaltranslation/gt/pull/1887) [`da32fa0`](https://github.com/generaltranslation/gt/commit/da32fa05bd718fc55ce418e68678c2d2691d5433) Thanks [@bgub](https://github.com/bgub)! - Remove empty callback registration and injection modules while preserving callback validation and `useGT` hash injection behavior.

- Updated dependencies [[`5d93858`](https://github.com/generaltranslation/gt/commit/5d9385872eb041af0991fc273d5eddd7a032e584), [`5721267`](https://github.com/generaltranslation/gt/commit/57212672a595c8c8578366636767bcbfe8ab6e57), [`8b9b440`](https://github.com/generaltranslation/gt/commit/8b9b4404b703b552b9aa327dc0ae85fce584c97c)]:
  - generaltranslation@9.0.2

## 1.3.30

### Patch Changes

- [#1862](https://github.com/generaltranslation/gt/pull/1862) [`7f0fbfe`](https://github.com/generaltranslation/gt/commit/7f0fbfef78f677372d39087252ab8d6c72d78e7e) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Skip compile-time hash injection for `<T>` components containing `<Derive>` children. A single injected hash pinned the runtime lookup to a hash matching none of the per-variant translations, so the rendered translation was stuck on one variant. Also stops injecting an empty `_hash` for `<T $context={derive(...)}>` and autoderive dynamic content.

- [#1863](https://github.com/generaltranslation/gt/pull/1863) [`ed53c71`](https://github.com/generaltranslation/gt/commit/ed53c71bc5c6a8d82feaef1b52f68d20b3794c0b) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Fix `$_hash` injection for `gt()` callbacks with derive content: a derive call no longer shifts the injected hashes of sibling `gt()` calls (counter misalignment), and derive `$context` no longer injects an empty `$_hash` or an empty-hash `useGT()` prefetch entry, both of which broke translation lookups.

- Updated dependencies [[`3ad93f8`](https://github.com/generaltranslation/gt/commit/3ad93f89da099ef345b707bf37db425662d87e2a)]:
  - generaltranslation@9.0.1

## 1.3.29

### Patch Changes

- [#1873](https://github.com/generaltranslation/gt/pull/1873) [`2e57a08`](https://github.com/generaltranslation/gt/commit/2e57a08a3f8539400f0aef5b90fff25c0a44dce1) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Retrigger package publication after repairing release workspace dependency resolution.

## 1.3.28

### Patch Changes

- [#1864](https://github.com/generaltranslation/gt/pull/1864) [`cb8f38e`](https://github.com/generaltranslation/gt/commit/cb8f38ebe5e9c7336bb4820dbef4b6ee5675645d) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Honor the `compileTimeHash` option: setting it to `false` now actually disables hash injection (previously it was ignored and injection always ran). The default flips to `true`, matching the previously observed always-inject behavior, so default behavior is unchanged.

- [#1866](https://github.com/generaltranslation/gt/pull/1866) [`53e61ab`](https://github.com/generaltranslation/gt/commit/53e61abbb4522631f252bcd268eae9c079dd9967) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Recover the stable releases skipped after the Odysseus version regression and publish the accumulated package changes under new npm versions.

## 1.3.26

### Patch Changes

- [#1858](https://github.com/generaltranslation/gt/pull/1858) [`006e071`](https://github.com/generaltranslation/gt/commit/006e071bf87ffe80f2d18958ddfa8f18cc2d85d2) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Accept parsed `gt.config.json` objects in the compiler and React SPA configuration types.

## 1.3.25

### Patch Changes

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`8870496`](https://github.com/generaltranslation/gt/commit/88704963eb74e81401994681ce7cdae3ba91b6c0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Support dev hot reload lookups for server `getGT` strings.

  `getGT` can now receive compiler-injected message metadata and prefetch missing translations through the runtime cache in development. `gt-next` forwards the server request conditions into this path so App Router server strings can participate in hot reload translation updates.

  Compiler-injected `getGT` and `useGT` preload messages now emit the same sugar metadata keys used by runtime lookup options.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`55c77ea`](https://github.com/generaltranslation/gt/commit/55c77ea871f5c7bc333c046d89a32472e68f0f4b) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Preserve `$format` in compiler-injected `getGT` and `useGT` preload metadata so preloaded runtime lookups use the same hash format as the original translation call.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`d48604e`](https://github.com/generaltranslation/gt/commit/d48604e2171aa84c76873cacb6eb8d43c2f17546) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Trigger an odysseus prerelease patch for all publishable packages.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`693288d`](https://github.com/generaltranslation/gt/commit/693288d632c42b923920a2fdd9ae2babc1bc28f5) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove internal source barrel exports and update imports to reference defining files directly.

- Updated dependencies [[`b72c30b`](https://github.com/generaltranslation/gt/commit/b72c30bc603562310a51b656fb003f1486315a8a), [`72e9e16`](https://github.com/generaltranslation/gt/commit/72e9e1643797be8e4ae1453897fd0b023fce2674), [`5adeede`](https://github.com/generaltranslation/gt/commit/5adeede157922d547a33a078d0f527f572c9a8b4), [`d48604e`](https://github.com/generaltranslation/gt/commit/d48604e2171aa84c76873cacb6eb8d43c2f17546), [`88f3a2e`](https://github.com/generaltranslation/gt/commit/88f3a2e0f304fdd19891afac0b41954edc9497c6), [`e12fb17`](https://github.com/generaltranslation/gt/commit/e12fb17d41cfa5fa231e64fe70423434739ea985), [`5752fe8`](https://github.com/generaltranslation/gt/commit/5752fe81bf5b5deaae878638e0de99959bf719be), [`97dc7f4`](https://github.com/generaltranslation/gt/commit/97dc7f4818476a319a54b1519e994a62d5a9a3a5), [`693288d`](https://github.com/generaltranslation/gt/commit/693288d632c42b923920a2fdd9ae2babc1bc28f5), [`2e85ebd`](https://github.com/generaltranslation/gt/commit/2e85ebd1528a4f99a8e36e1d8d6714a639040596), [`d5cf2d3`](https://github.com/generaltranslation/gt/commit/d5cf2d34f412ad49e8b2818fe788b870a5964d65), [`4986567`](https://github.com/generaltranslation/gt/commit/498656728741898a56ae348a536107bd92f95c04), [`795edc8`](https://github.com/generaltranslation/gt/commit/795edc8a2b3e91fc9801d726f4b5cd6fbbc98fb0)]:
  - generaltranslation@9.0.0
  - @generaltranslation/format@0.1.2

## 1.3.25-odysseus.8

### Patch Changes

- Updated dependencies [b72c30b]
- Updated dependencies [d5cf2d3]
  - generaltranslation@9.0.0-odysseus.6

## 1.3.25-odysseus.7

### Patch Changes

- Updated dependencies [72e9e16]
- Updated dependencies [5adeede]
- Updated dependencies [2e85ebd]
  - generaltranslation@9.0.0-odysseus.5

## 1.3.25-odysseus.6

### Patch Changes

- c34cab3: Preserve `$format` in compiler-injected `getGT` and `useGT` preload metadata so preloaded runtime lookups use the same hash format as the original translation call.

## 1.3.25-odysseus.5

### Patch Changes

- 432fa49: Support dev hot reload lookups for server `getGT` strings.

  `getGT` can now receive compiler-injected message metadata and prefetch missing translations through the runtime cache in development. `gt-next` forwards the server request conditions into this path so App Router server strings can participate in hot reload translation updates.

  Compiler-injected `getGT` and `useGT` preload messages now emit the same sugar metadata keys used by runtime lookup options.

## 1.3.25-odysseus.4

### Patch Changes

- Updated dependencies [26faa87]
  - generaltranslation@9.0.0-odysseus.4

## 1.3.25-odysseus.3

### Patch Changes

- Updated dependencies [b1eef00]
  - generaltranslation@9.0.0-odysseus.3

## 1.3.25-odysseus.2

### Patch Changes

- Updated dependencies [[`4b97bc3`](https://github.com/generaltranslation/gt/commit/4b97bc360b2869bbb6e5f214589ef84f6d58a660), [`020c6bd`](https://github.com/generaltranslation/gt/commit/020c6bdd8c604bc07d80d75e8ea2ace1e70d7447)]:
  - @generaltranslation/format@0.1.2-odysseus.1
  - generaltranslation@9.0.0-odysseus.2

## 1.3.25-odysseus.1

### Patch Changes

- [#1677](https://github.com/generaltranslation/gt/pull/1677) [`87d6320`](https://github.com/generaltranslation/gt/commit/87d6320d271a1bf455f4e283dc1bb23893c7ba64) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove internal source barrel exports and update imports to reference defining files directly.

- Updated dependencies [[`87d6320`](https://github.com/generaltranslation/gt/commit/87d6320d271a1bf455f4e283dc1bb23893c7ba64)]:
  - generaltranslation@9.0.0-odysseus.1

## 1.3.25-odysseus.0

### Patch Changes

- [#1508](https://github.com/generaltranslation/gt/pull/1508) [`cc1499d`](https://github.com/generaltranslation/gt/commit/cc1499d12789ffd7ee3c6ca20d2eec734a1c9575) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Trigger an odysseus prerelease patch for all publishable packages.

- Updated dependencies [[`cc1499d`](https://github.com/generaltranslation/gt/commit/cc1499d12789ffd7ee3c6ca20d2eec734a1c9575), [`620621a`](https://github.com/generaltranslation/gt/commit/620621aceeafedbb958884cacc5495736191b065), [`bd0d788`](https://github.com/generaltranslation/gt/commit/bd0d7883601a183a31b47b36ea4ea2dca69c62d0)]:
  - @generaltranslation/format@0.1.2-odysseus.0
  - generaltranslation@9.0.0-odysseus.0

## 1.3.26

### Patch Changes

- Updated dependencies [[`9709a2f`](https://github.com/generaltranslation/gt/commit/9709a2f2b97b9d8239298e39bb31e57692bbffd8)]:
  - generaltranslation@8.2.18

## 1.3.25

### Patch Changes

- Updated dependencies [[`3197028`](https://github.com/generaltranslation/gt/commit/319702855a7b129f95217d41be9f2402680a2f01)]:
  - generaltranslation@8.2.17

## 1.3.24

### Patch Changes

- Updated dependencies [[`e041312`](https://github.com/generaltranslation/gt/commit/e04131263dd61e469db977bcc196dc1283e773d0)]:
  - generaltranslation@8.2.16

## 1.3.27

### Patch Changes

- [#1786](https://github.com/generaltranslation/gt/pull/1786) [`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Add `requiresReview`

- Updated dependencies [[`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6)]:
  - generaltranslation@8.2.19

## 1.3.26

### Patch Changes

- Updated dependencies [[`9709a2f`](https://github.com/generaltranslation/gt/commit/9709a2f2b97b9d8239298e39bb31e57692bbffd8)]:
  - generaltranslation@8.2.18

## 1.3.25

### Patch Changes

- Updated dependencies [[`3197028`](https://github.com/generaltranslation/gt/commit/319702855a7b129f95217d41be9f2402680a2f01)]:
  - generaltranslation@8.2.17

## 1.3.24

### Patch Changes

- Updated dependencies [[`e041312`](https://github.com/generaltranslation/gt/commit/e04131263dd61e469db977bcc196dc1283e773d0)]:
  - generaltranslation@8.2.16

## 1.3.23

### Patch Changes

- Updated dependencies [[`bb3624e`](https://github.com/generaltranslation/gt/commit/bb3624e58546c334c04370a1f5a262238bd040fa), [`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300)]:
  - @generaltranslation/format@0.1.1
  - generaltranslation@8.2.15

## 1.3.22

### Patch Changes

- [#1408](https://github.com/generaltranslation/gt/pull/1408) [`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6) Thanks [@bgub](https://github.com/bgub)! - Use @generaltranslation/format directly for shared formatting and locale helpers.

- Updated dependencies [[`73f3ac1`](https://github.com/generaltranslation/gt/commit/73f3ac1308df11c1e6230c13c1999bfc5f6afc99), [`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6)]:
  - @generaltranslation/format@0.1.0
  - generaltranslation@8.2.14

## 1.3.21

### Patch Changes

- Updated dependencies [[`e88fd39`](https://github.com/generaltranslation/gt/commit/e88fd399683868d5af1fe2b0ba2974fe5b17d7a7), [`95f852a`](https://github.com/generaltranslation/gt/commit/95f852ae086ac79d2c446f4d3072d8fd18688796)]:
  - generaltranslation@8.2.13

## 1.3.20

### Patch Changes

- [#1342](https://github.com/generaltranslation/gt/pull/1342) [`6a255fb`](https://github.com/generaltranslation/gt/commit/6a255fb7ee440c88f6374fe14e7b0008e051d3a8) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Auto-load gt.config.json for compiler plugins when no gtConfig option is passed.

- Updated dependencies [[`9eae4d9`](https://github.com/generaltranslation/gt/commit/9eae4d93476688b621c739683c8bac64cbf50bf0)]:
  - generaltranslation@8.2.12

## 1.3.19

### Patch Changes

- [#1315](https://github.com/generaltranslation/gt/pull/1315) [`5801996`](https://github.com/generaltranslation/gt/commit/58019961cf4142e5468fbbc523a514e3f90b4123) Thanks [@bgub](https://github.com/bgub)! - Preserve invalid template escape errors in `msg()` and `t()` validation even when string autoderive is enabled.

- [#1331](https://github.com/generaltranslation/gt/pull/1331) [`3dedd4a`](https://github.com/generaltranslation/gt/commit/3dedd4a07b674f7b943f963190232e5c0f01026f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Thread JSX collection through path-aware helpers for future derivation support.

## 1.3.18

### Patch Changes

- [#1313](https://github.com/generaltranslation/gt/pull/1313) [`b6098f8`](https://github.com/generaltranslation/gt/commit/b6098f87e2355e7d862d201c24b25467fb569015) Thanks [@bgub](https://github.com/bgub)! - Do not treat JavaScript labels as shadowing GT translation imports during string extraction.

- Updated dependencies [[`fecaf93`](https://github.com/generaltranslation/gt/commit/fecaf93d1dcae65598b3f81b8eeabaeb35be13c6)]:
  - generaltranslation@8.2.11

## 1.3.17

### Patch Changes

- [#1272](https://github.com/generaltranslation/gt/pull/1272) [`7ce1813`](https://github.com/generaltranslation/gt/commit/7ce18131c7a1e494fdc5c488e2f53d033b083311) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: add error enforcement for msg(), t() and t``

## 1.3.16

### Patch Changes

- [#1271](https://github.com/generaltranslation/gt/pull/1271) [`7b1fd81`](https://github.com/generaltranslation/gt/commit/7b1fd816f8c8c9f2997bc0b9abe2cabd1dab00e8) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor(compiler): consolidate string extraction logic

- Updated dependencies [[`20276d0`](https://github.com/generaltranslation/gt/commit/20276d03cc1494e79d93d9dc131eee2815a4fae6)]:
  - generaltranslation@8.2.10

## 1.3.15

### Patch Changes

- Updated dependencies [[`ce0933a`](https://github.com/generaltranslation/gt/commit/ce0933ab102d34a0c38634f7c2b0d634c9a620a8)]:
  - generaltranslation@8.2.9

## 1.3.14

### Patch Changes

- Updated dependencies [[`b12d57d`](https://github.com/generaltranslation/gt/commit/b12d57dab1d5cb1f602c5ac24a702b48cda7f11e)]:
  - generaltranslation@8.2.8

## 1.3.13

### Patch Changes

- [`28d0c06`](https://github.com/generaltranslation/gt/commit/28d0c06f3e8366fc2c119b7792620c4764eda2de) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - patch: inject compile-time hashes into standalone t() calls

## 1.3.12

### Patch Changes

- Updated dependencies [[`e3a8008`](https://github.com/generaltranslation/gt/commit/e3a8008ed0a3ab82d053f549265f9de7829e94c5), [`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7)]:
  - generaltranslation@8.2.7

## 1.3.11

### Patch Changes

- Updated dependencies [[`8b75420`](https://github.com/generaltranslation/gt/commit/8b7542091233fb2c87284a365cc9ab8ce70371d3)]:
  - generaltranslation@8.2.6

## 1.3.10

### Patch Changes

- [#1236](https://github.com/generaltranslation/gt/pull/1236) [`3d6c60e`](https://github.com/generaltranslation/gt/commit/3d6c60e1595bc9409a2d21a153caa5f909154691) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: string extraction for concat with non-strings

## 1.3.9

### Patch Changes

- [#1233](https://github.com/generaltranslation/gt/pull/1233) [`2e1869d`](https://github.com/generaltranslation/gt/commit/2e1869d464714427e018911c61bd06b2cf5bb900) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: more robust string extraction

## 1.3.8

### Patch Changes

- [#1218](https://github.com/generaltranslation/gt/pull/1218) [`02ef6fc`](https://github.com/generaltranslation/gt/commit/02ef6fcbd979247b9157e768e5a07b3285aaa6ec) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat(react/browser): dev hot reload

- Updated dependencies [[`02ef6fc`](https://github.com/generaltranslation/gt/commit/02ef6fcbd979247b9157e768e5a07b3285aaa6ec)]:
  - generaltranslation@8.2.5

## 1.3.7

### Patch Changes

- Updated dependencies [[`151f516`](https://github.com/generaltranslation/gt/commit/151f51686e52e70176f659a5d297a074a17fe20f)]:
  - generaltranslation@8.2.4

## 1.3.6

### Patch Changes

- Updated dependencies [[`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47)]:
  - generaltranslation@8.2.3

## 1.3.5

### Patch Changes

- [#1199](https://github.com/generaltranslation/gt/pull/1199) [`1828cd4`](https://github.com/generaltranslation/gt/commit/1828cd4eafb1f3ea868b437b914c844670d2c50f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: enable autoderive for jsx

- [#1201](https://github.com/generaltranslation/gt/pull/1201) [`fbb9d26`](https://github.com/generaltranslation/gt/commit/fbb9d268dbee58142e305b9076e44000205d5437) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: customize autoderive

## 1.3.4

### Patch Changes

- [#1195](https://github.com/generaltranslation/gt/pull/1195) [`2090de3`](https://github.com/generaltranslation/gt/commit/2090de3613b9684fd43adc3b83f677bc33c1d9a6) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor: standardize naming convention for "autoderive"

## 1.3.3

### Patch Changes

- [#1188](https://github.com/generaltranslation/gt/pull/1188) [`a76a386`](https://github.com/generaltranslation/gt/commit/a76a38624a2defbfd8d0540ccb74bb264079f61a) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix(compiler): extend autoderive gt msg

## 1.3.2

### Patch Changes

- [#1182](https://github.com/generaltranslation/gt/pull/1182) [`80fe63f`](https://github.com/generaltranslation/gt/commit/80fe63fa349f8ece0871ba455f16dae614327fdd) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: handle member expressions without throwing errors

## 1.3.1

### Patch Changes

- [#1173](https://github.com/generaltranslation/gt/pull/1173) [`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - add context derivation

## 1.3.0

### Minor Changes

- [#1158](https://github.com/generaltranslation/gt/pull/1158) [`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - add auto injection for jsx translation

### Patch Changes

- Updated dependencies [[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)]:
  - generaltranslation@8.2.2

## 1.2.1

### Patch Changes

- [#1161](https://github.com/generaltranslation/gt/pull/1161) [`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Update logo blocks in READMEs

- Updated dependencies [[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)]:
  - generaltranslation@8.2.1

## 1.2.0

### Minor Changes

- [#1153](https://github.com/generaltranslation/gt/pull/1153) [`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Add `<RelativeTime>` component for localized relative time formatting
  - New `<RelativeTime>` component with two usage modes:
    - Auto-select unit from a Date: `<RelativeTime>{someDate}</RelativeTime>` → "2 hours ago"
    - Explicit value + unit: `<RelativeTime value={-1} unit="day" />` → "yesterday"
  - Core: `_selectRelativeTimeUnit()` auto-selects the best unit (seconds → minutes → hours → days → weeks → months → years)
  - Core: `formatRelativeTimeFromDate()` standalone function and `GT.formatRelativeTimeFromDate()` class method
  - Week unit included in auto-selection thresholds (7-27 days)
  - CLI, compiler, and SWC plugin updated to recognize `RelativeTime` as a variable component

### Patch Changes

- Updated dependencies [[`9d2349c`](https://github.com/generaltranslation/gt/commit/9d2349cfc41862d9e3d8364659b678055b9fa290), [`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc)]:
  - generaltranslation@8.2.0

## 1.1.36

### Patch Changes

- [#1147](https://github.com/generaltranslation/gt/pull/1147) [`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: add support for multiple format types

- Updated dependencies [[`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f)]:
  - generaltranslation@8.1.23

## 1.1.35

### Patch Changes

- Updated dependencies [[`16521f8`](https://github.com/generaltranslation/gt/commit/16521f83be814ca75be7956b00fc644e60f72e8e)]:
  - generaltranslation@8.1.22

## 1.1.34

### Patch Changes

- [#1141](https://github.com/generaltranslation/gt/pull/1141) [`4820643`](https://github.com/generaltranslation/gt/commit/4820643665d5aecacc34c52707c0c81bf4da18ca) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: auto derive for the t() function

## 1.1.33

### Patch Changes

- Updated dependencies [[`d688831`](https://github.com/generaltranslation/gt/commit/d688831d124f9719357100a93e5a7c37729e751e), [`46e089c`](https://github.com/generaltranslation/gt/commit/46e089c63725acc2c478a4c1965bebd6f2d2cc0e)]:
  - generaltranslation@8.1.21

## 1.1.32

### Patch Changes

- [#1125](https://github.com/generaltranslation/gt/pull/1125) [`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fix logo URLs in README files (updated to `/brand/gt-logo-*.svg`)

- Updated dependencies [[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)]:
  - generaltranslation@8.1.20

## 1.1.31

### Patch Changes

- [#1129](https://github.com/generaltranslation/gt/pull/1129) [`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: derivation support for the t macro

- Updated dependencies [[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)]:
  - generaltranslation@8.1.19

## 1.1.30

### Patch Changes

- Updated dependencies [[`6d516a7`](https://github.com/generaltranslation/gt/commit/6d516a784f1192f7758689fcf4557e8a19de740a)]:
  - generaltranslation@8.1.18

## 1.1.29

### Patch Changes

- [#1118](https://github.com/generaltranslation/gt/pull/1118) [`de6a2d1`](https://github.com/generaltranslation/gt/commit/de6a2d1caa150383c70844b3ee6b9b2e66f77769) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add t macro

## 1.1.28

### Patch Changes

- [#1062](https://github.com/generaltranslation/gt/pull/1062) [`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor: rename static to derive, and deprecate static

- Updated dependencies [[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)]:
  - generaltranslation@8.1.17

## 1.1.27

### Patch Changes

- Updated dependencies [[`e364093`](https://github.com/generaltranslation/gt/commit/e3640931cf0ca2df08dcadbae30b1668e14a3ed8)]:
  - generaltranslation@8.1.16

## 1.1.26

### Patch Changes

- Updated dependencies [[`1793010`](https://github.com/generaltranslation/gt/commit/1793010ea33ceceba307832195433ff3b7f1143e)]:
  - generaltranslation@8.1.15

## 1.1.25

### Patch Changes

- [#1076](https://github.com/generaltranslation/gt/pull/1076) [`19ae4eb`](https://github.com/generaltranslation/gt/commit/19ae4eb0baf7e6f15d19f9fad384621d38d73d57) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Apply style guide to error messages and warnings: remove "Please", simplify verbose phrasing, fix `in-line` → `inline`.

- Updated dependencies [[`dad7824`](https://github.com/generaltranslation/gt/commit/dad78246d164b201d4fc14c89213cc04f21c8b76)]:
  - generaltranslation@8.1.14

## 1.1.24

### Patch Changes

- [#1069](https://github.com/generaltranslation/gt/pull/1069) [`ff38c7c`](https://github.com/generaltranslation/gt/commit/ff38c7c72886882ddb8851fc8173e1ba863d0078) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add new gt package

## 1.1.23

### Patch Changes

- [#1068](https://github.com/generaltranslation/gt/pull/1068) [`94b95ef`](https://github.com/generaltranslation/gt/commit/94b95ef662b81dac51416ecc64f3318339171f0b) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: runtime calculation for the injection of 'data-' attribute in jsx

## 1.1.22

### Patch Changes

- Updated dependencies [[`21b3304`](https://github.com/generaltranslation/gt/commit/21b33040774f9638fdf7edcfcf7170246a36fbec)]:
  - generaltranslation@8.1.13

## 1.1.21

### Patch Changes

- Updated dependencies [[`47918b7`](https://github.com/generaltranslation/gt/commit/47918b7a4c38967fe2148d972f0a3c740e0bc25d)]:
  - generaltranslation@8.1.12

## 1.1.20

### Patch Changes

- Updated dependencies [[`7cd02ba`](https://github.com/generaltranslation/gt/commit/7cd02ba200c8645de01527a88f7cf32346e67d12)]:
  - generaltranslation@8.1.11

## 1.1.19

### Patch Changes

- Updated dependencies [[`9e99e94`](https://github.com/generaltranslation/gt/commit/9e99e945cbf9e31990930e3428468f64d7240da5)]:
  - generaltranslation@8.1.10

## 1.1.18

### Patch Changes

- Updated dependencies [[`4a66903`](https://github.com/generaltranslation/gt/commit/4a669031f74a0b20783709752ab7fc0ab40869df)]:
  - generaltranslation@8.1.9

## 1.1.17

### Patch Changes

- Updated dependencies [[`fca3a25`](https://github.com/generaltranslation/gt/commit/fca3a2583eb7f21bc3ef13516351d479f7bef882)]:
  - generaltranslation@8.1.8

## 1.1.16

### Patch Changes

- Updated dependencies [[`eb07e8c`](https://github.com/generaltranslation/gt/commit/eb07e8ce1b610551437b40f96c72ac76d0af7b67)]:
  - generaltranslation@8.1.7

## 1.1.15

### Patch Changes

- Updated dependencies [[`feada39`](https://github.com/generaltranslation/gt/commit/feada3918ad78a1584f07245ac158c2d994a38da)]:
  - generaltranslation@8.1.6

## 1.1.14

### Patch Changes

- [#932](https://github.com/generaltranslation/gt/pull/932) [`dcdd751`](https://github.com/generaltranslation/gt/commit/dcdd7516edfe2e51ed633c79bc2045fb14fd938b) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: compiler cli deps when installed at the same time caused an bug in npm with the esbuild version

## 1.1.13

### Patch Changes

- Updated dependencies [[`1e7e52f`](https://github.com/generaltranslation/gt/commit/1e7e52f3a77835887ff187ffeb99d6e3dc2a9e6c)]:
  - generaltranslation@8.1.5

## 1.1.12

### Patch Changes

- [#806](https://github.com/generaltranslation/gt/pull/806) [`d59dd40`](https://github.com/generaltranslation/gt/commit/d59dd40e7b042e2bb4e718f17f3b2e764165151f) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - feat: declareStatic()

- Updated dependencies [[`d59dd40`](https://github.com/generaltranslation/gt/commit/d59dd40e7b042e2bb4e718f17f3b2e764165151f)]:
  - generaltranslation@8.1.4

## 1.1.11

### Patch Changes

- Updated dependencies [[`e113d8d`](https://github.com/generaltranslation/gt/commit/e113d8d8fb5e37f45a4aa77544e8f4666519bfe8)]:
  - generaltranslation@8.1.3

## 1.1.10

### Patch Changes

- Updated dependencies [[`3dc7b64`](https://github.com/generaltranslation/gt/commit/3dc7b6460cd05ddcb656a247602f4f50b06312fd)]:
  - generaltranslation@8.1.2

## 1.1.9

### Patch Changes

- [#859](https://github.com/generaltranslation/gt/pull/859) [`b585745`](https://github.com/generaltranslation/gt/commit/b585745b64e005a977b837cd1f59be6d61c681ab) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: max char compatibility

- Updated dependencies [[`37bac4c`](https://github.com/generaltranslation/gt/commit/37bac4ce11689a2f729efbcb2e052205447a7f71)]:
  - generaltranslation@8.1.1

## 1.1.8

### Patch Changes

- Updated dependencies [[`3e8ceb4`](https://github.com/generaltranslation/gt/commit/3e8ceb4526530d38eae469b05e8bf273d5ca05ac)]:
  - generaltranslation@8.1.0

## 1.1.7

### Patch Changes

- Updated dependencies [[`997a5df`](https://github.com/generaltranslation/gt/commit/997a5df6ac355b49a77e768935f9017af689de21)]:
  - generaltranslation@8.0.6

## 1.1.6

### Patch Changes

- Updated dependencies [[`30a04f9`](https://github.com/generaltranslation/gt/commit/30a04f955c64013daf2a32480fb33b3d4e08d678)]:
  - generaltranslation@8.0.5

## 1.1.5

### Patch Changes

- [#816](https://github.com/generaltranslation/gt/pull/816) [`e42a442`](https://github.com/generaltranslation/gt/commit/e42a44280442e588b82b3fe1aff52f1e53aa8605) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add gt-i18n, a pure js library for translation

- Updated dependencies [[`e42a442`](https://github.com/generaltranslation/gt/commit/e42a44280442e588b82b3fe1aff52f1e53aa8605)]:
  - generaltranslation@8.0.4

## 1.1.4

### Patch Changes

- Updated dependencies [[`afbd29a`](https://github.com/generaltranslation/gt/commit/afbd29a34b051c76fce387269c4eb4a2e00a5831)]:
  - generaltranslation@8.0.3

## 1.1.3

### Patch Changes

- Updated dependencies [[`e7d25b0`](https://github.com/generaltranslation/gt/commit/e7d25b06a3e1d7ca404d64257570b88e7b0d1915)]:
  - generaltranslation@8.0.2

## 1.1.2

### Patch Changes

- [#803](https://github.com/generaltranslation/gt/pull/803) [`b0715ff`](https://github.com/generaltranslation/gt/commit/b0715ffd91c119c4546790f03f1cfcafcae00c3f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: repository field

## 1.1.1

### Patch Changes

- Updated dependencies [[`f98c504`](https://github.com/generaltranslation/gt/commit/f98c504f1e025024b3e1e5e16a0271e86ed095fa)]:
  - generaltranslation@8.0.1

## 1.1.0

### Minor Changes

- [#788](https://github.com/generaltranslation/gt/pull/788) [`99e4648`](https://github.com/generaltranslation/gt/commit/99e46486ae2046c689e0045372d63c4eb3dc5d48) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - More information: https://https://generaltranslation.com/en-US/blog/gt-next_v6_8_0

  feat: static component

### Patch Changes

- Updated dependencies [[`fee5d4a`](https://github.com/generaltranslation/gt/commit/fee5d4a3d0fd20e0928eebb83201a87289265719)]:
  - generaltranslation@8.0.0

## 1.0.9

### Patch Changes

- Updated dependencies [[`3da05a1`](https://github.com/generaltranslation/gt/commit/3da05a12a37a62ace3c7e321aa2fed5a4af52ad9)]:
  - generaltranslation@7.9.1

## 1.0.8

### Patch Changes

- Updated dependencies [[`93881f1`](https://github.com/generaltranslation/gt/commit/93881f159455a9bbc13d14e7fec9befa60998ba3)]:
  - generaltranslation@7.9.0

## 1.0.7

### Patch Changes

- Updated dependencies [[`7434c15`](https://github.com/generaltranslation/gt/commit/7434c1503c2a62bdb90d4058f903a56331276365)]:
  - generaltranslation@7.8.0

## 1.0.6

### Patch Changes

- Updated dependencies [[`7ba2e84`](https://github.com/generaltranslation/gt/commit/7ba2e8412b608aa3415f4865dc26adbbd3daa236)]:
  - generaltranslation@7.7.3

## 1.0.5

### Patch Changes

- Updated dependencies [[`20ec920`](https://github.com/generaltranslation/gt/commit/20ec920ecf3fb04e464f281400429c68f3c1a701)]:
  - generaltranslation@7.7.2

## 1.0.4

### Patch Changes

- Updated dependencies [[`7114780`](https://github.com/generaltranslation/gt/commit/71147803bf3e4cf21556ffb9b5f77756e283a32a)]:
  - generaltranslation@7.7.1

## 1.0.3

### Patch Changes

- Updated dependencies [[`5208937`](https://github.com/generaltranslation/gt/commit/520893719480b40774ccd749fe73727cf490f46c)]:
  - generaltranslation@7.7.0

## 1.0.2

### Patch Changes

- Updated dependencies [[`ed93e41`](https://github.com/generaltranslation/gt/commit/ed93e419e9547e6f2353d99f896702016f8ba751)]:
  - generaltranslation@7.6.5

## 1.0.1

### Patch Changes

- [#723](https://github.com/generaltranslation/gt/pull/723) [`3cb2e06`](https://github.com/generaltranslation/gt/commit/3cb2e06490820d6a27d2dc3e749044a81c48a07a) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: release

## 1.0.0

### Major Changes

- [#575](https://github.com/generaltranslation/gt/pull/575) [`fa9c8d6`](https://github.com/generaltranslation/gt/commit/fa9c8d695ca8d17d03c79dee524f47f25ea63728) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: babel compiler
