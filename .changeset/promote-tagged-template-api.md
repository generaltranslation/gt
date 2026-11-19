---
'gt-i18n': major
'@generaltranslation/react-core': major
'gt-react': major
'gt-react-native': major
'gt-next': major
'gt-tanstack-start': major
'gt-node': major
'gt': major
'@generaltranslation/compiler': major
'generaltranslation': major
'@generaltranslation/react-core-linter': minor
---

**Breaking:** the tagged-template API is now the message API of the main entries, and the string functions it replaces are removed. `t`, `msg`, `tx`, and the functions that `useGT()`, `getGT()`, `useMessages()` and `getMessages()` return no longer take an ICU string. `<T>` and the other components, the dictionary API under `/compat`, gt-svelte and gt-vue are unchanged.

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
- `derive()` must be the whole context. `<T context={'tone: ' + derive(getFormality())}>`, a template literal around `derive()`, and `derive()` in one branch of a conditional → `<T context={derive(getTone())}>`, with `getTone()` returning the full text, as in `` return `tone: ${getFormality()}` as const ``. The CLI and the compiler report the old forms as errors.
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

**`gt` (CLI):** `gt translate`, `gt validate` and the other commands that read source extract `t`, `msg` and the functions from `useGT()` and `getGT()` as message trees when they are imported by name from a main entry. They no longer extract a string call such as `t('Hello')` or `msg('Hello, {name}!', { name })`, nor a `t` that is not imported, such as a global. `msg('Save')` is still extracted, as a message tree. In a `<T>` context, the CLI no longer reads `declareVar()`, and it reports a `derive()` it cannot resolve as an error: it used to upload the source text of the expression as the context. The CLI now warns when a main entry is loaded through `require()`, `import()`, a namespace import or a re-export that could carry one of these functions, since it follows only named imports. It no longer warns about `useGT()` in an async function or `getGT()` in a synchronous one. In a gt-svelte project, string calls in JavaScript and TypeScript modules are now extracted by the same rules as in `.svelte` files: an alias of `t` such as `const translate = t`, a `t` passed to a function in another file, and a literal `m('...')` call are no longer followed.

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
