# PR Stack Split Plan

## Source

- Source branch: `e/odysseus/move-cache-to-provider`
- Source tip at planning time: `049b91d1633b539fb9a5c03fb7adc1b3d61d17d7`
- Backup branch: `backup/e-odysseus-move-cache-to-provider-unsplit`
- Base branch: `origin/odysseus`
- Coordination branch: `e/odysseus/pr-stack-split-plan`
- Existing PR: https://github.com/generaltranslation/gt/pull/1541

## Branch Plan

| Branch | Base | Title | Status | PR |
| --- | --- | --- | --- | --- |
| `e/odysseus/vscode-format-settings` | `odysseus` | `chore: update vscode formatter settings` | Local commit `fd9b7b2a3`; verified; opened | https://github.com/generaltranslation/gt/pull/1542 |
| `e/odysseus/relax-dictionary-cache-config` | `odysseus` | `refactor: relax dictionary cache config` | Local commit `1858b9852`; verified standalone; opened | https://github.com/generaltranslation/gt/pull/1543 |
| `e/odysseus/export-browser-condition-helpers` | `odysseus` | `refactor: export browser condition helpers` | Local commit `f081100f5`; verified; opened | https://github.com/generaltranslation/gt/pull/1544 |
| `e/odysseus/lookup-condition-adapter-scaffold` | `odysseus` | `refactor: add lookup and condition adapters` | Local commit `3ad98a6df`; verified; opened | https://github.com/generaltranslation/gt/pull/1545 |
| `e/odysseus/provider-runtime-adapter-routing` | `e/odysseus/lookup-condition-adapter-scaffold` | `refactor: route provider runtime through adapters` | Local commit `3c2aa5337`; verified; opened | https://github.com/generaltranslation/gt/pull/1546 |
| `e/odysseus/tracked-gt-lookups` | `e/odysseus/provider-runtime-adapter-routing` | `refactor: track runtime gt lookups` | Local commit `d409744ee`; verified except inherited test failure; opened | https://github.com/generaltranslation/gt/pull/1547 |

## Source File Inventory

Generated from:

```sh
git diff --name-status origin/odysseus...backup/e-odysseus-move-cache-to-provider-unsplit
```

| Status | File | Owner | Notes |
| --- | --- | --- | --- |
| M | `.vscode/settings.json` | standalone PR: `e/odysseus/vscode-format-settings` | Optional chore PR. |
| M | `packages/i18n/src/i18n-cache/I18nCache.ts` | standalone PR: `e/odysseus/relax-dictionary-cache-config` | Typecheck did not require moving this into PR 2. |
| M | `packages/i18n/src/i18n-cache/types.ts` | standalone PR: `e/odysseus/relax-dictionary-cache-config` | Typecheck did not require moving this into PR 2. |
| M | `packages/i18n/src/internal.ts` | stacked PR 1: `e/odysseus/lookup-condition-adapter-scaffold` | `hashMessage` export required by lookup adapter utilities. |
| A | `packages/react-core/src/condition-store/condition-adapter/ConditionAdapter.ts` | stacked PR 1: `e/odysseus/lookup-condition-adapter-scaffold` | Adapter scaffold. |
| A | `packages/react-core/src/condition-store/condition-adapter/factories.ts` | stacked PR 1: `e/odysseus/lookup-condition-adapter-scaffold` | Adapter scaffold. |
| A | `packages/react-core/src/condition-store/condition-adapter/useConditionAdapter.ts` | stacked PR 1: `e/odysseus/lookup-condition-adapter-scaffold` | Adapter scaffold. |
| M | `packages/react-core/src/condition-store/singleton-operations.ts` | stacked PR 2: `e/odysseus/provider-runtime-adapter-routing` | Include if needed by adapter/provider changes. |
| M | `packages/react-core/src/context/InternalGTProvider.tsx` | stacked PR 2: `e/odysseus/provider-runtime-adapter-routing` | Provider runtime routing. |
| A | `packages/react-core/src/context/context.ts` | stacked PR 1: `e/odysseus/lookup-condition-adapter-scaffold` | Context scaffold. |
| M | `packages/react-core/src/hooks/condition-store.ts` | stacked PR 2: `e/odysseus/provider-runtime-adapter-routing` | Hook routing. |
| M | `packages/react-core/src/hooks/external-store.ts` | stacked PR 2: `e/odysseus/provider-runtime-adapter-routing` | Hook routing. |
| M | `packages/react-core/src/hooks/useGT.ts` | stacked PR 2 and PR 3 | PR 2 uses basic `useLookupResolver()`, PR 3 switches to tracked resolver. |
| M | `packages/react-core/src/hooks/useTranslations.ts` | stacked PR 2: `e/odysseus/provider-runtime-adapter-routing` | Remove direct `getReactI18nCache()` reads. |
| M | `packages/react-core/src/hooks/utils.ts` | stacked PR 2: `e/odysseus/provider-runtime-adapter-routing` | Hook routing utilities. |
| M | `packages/react-core/src/i18n-cache/ReactI18nCache.ts` | stacked PR 2: `e/odysseus/provider-runtime-adapter-routing` | Runtime cache/provider changes. |
| M | `packages/react-core/src/i18n-store/I18nStore.ts` | stacked PR 2 and PR 3 | PR 2 excludes broad translation event subscription; PR 3 adds it. |
| M | `packages/react-core/src/i18n-store/RuntimeDictionaryScope.ts` | stacked PR 2: `e/odysseus/provider-runtime-adapter-routing` | Runtime routing. |
| M | `packages/react-core/src/i18n-store/RuntimeTranslationScope.ts` | stacked PR 2: `e/odysseus/provider-runtime-adapter-routing` | Runtime routing. |
| A | `packages/react-core/src/i18n-store/lookup-adapter/LookupAdapter.ts` | stacked PR 1 and PR 3 | PR 1 scaffold; PR 3 adds `subscribeToTranslationEvents`. |
| A | `packages/react-core/src/i18n-store/lookup-adapter/factories.ts` | stacked PR 1 and PR 3 | PR 1 scaffold; PR 3 wires translation event subscription. |
| A | `packages/react-core/src/i18n-store/lookup-adapter/useLookupAdapter.ts` | stacked PR 1: `e/odysseus/lookup-condition-adapter-scaffold` | Adapter scaffold. |
| A | `packages/react-core/src/i18n-store/lookup-adapter/useLookupResolver.ts` | stacked PR 2: `e/odysseus/provider-runtime-adapter-routing` | Basic resolver used before tracking. |
| A | `packages/react-core/src/i18n-store/lookup-adapter/useTrackedTranslationResolver.ts` | stacked PR 3: `e/odysseus/tracked-gt-lookups` | Per-hook tracking. |
| A | `packages/react-core/src/i18n-store/lookup-adapter/utils/dictionaries.ts` | stacked PR 1: `e/odysseus/lookup-condition-adapter-scaffold` | Lookup utility. |
| A | `packages/react-core/src/i18n-store/lookup-adapter/utils/translations.ts` | stacked PR 1: `e/odysseus/lookup-condition-adapter-scaffold` | Lookup utility. |
| M | `packages/react-core/src/i18n-store/storeTypes.ts` | stacked PR 3: `e/odysseus/tracked-gt-lookups` | Adds `TranslateEventListener`. |
| M | `packages/react-core/src/setup/initializeGTSSR.ts` | stacked PR 2: `e/odysseus/provider-runtime-adapter-routing` | SSR provider setup. |
| M | `packages/react/src/condition-store/createBrowserConditionStore.ts` | standalone PR: `e/odysseus/export-browser-condition-helpers` | Helper export. |
| M | `packages/react/src/context.client.ts` | stacked PR 2: `e/odysseus/provider-runtime-adapter-routing` | Provider exports. |
| M | `packages/react/src/context.server.ts` | stacked PR 2: `e/odysseus/provider-runtime-adapter-routing` | Provider exports. |
| M | `packages/react/src/context.types.ts` | stacked PR 2: `e/odysseus/provider-runtime-adapter-routing` | Provider types. |
| D | `packages/react/src/provider/BrowserGTProvider.tsx` | stacked PR 2: `e/odysseus/provider-runtime-adapter-routing` | Deleted by provider consolidation. |
| A | `packages/react/src/provider/GTProvider.tsx` | stacked PR 2: `e/odysseus/provider-runtime-adapter-routing` | Provider consolidation. |
| R082 | `packages/react/src/provider/SharedGTProviderProps.ts -> packages/react/src/provider/GTProviderProps.ts` | stacked PR 2: `e/odysseus/provider-runtime-adapter-routing` | Provider prop rename. |
| D | `packages/react/src/provider/ServerGTProvider.tsx` | stacked PR 2: `e/odysseus/provider-runtime-adapter-routing` | Deleted by provider consolidation. |

## Verification Log

Use:

```sh
PATH="$HOME/.nvm/versions/node/v24.6.0/bin:$PATH"
corepack pnpm --filter @generaltranslation/react-core typecheck
corepack pnpm --filter gt-react typecheck
corepack pnpm exec oxlint <touched files>
corepack pnpm --filter @generaltranslation/react-core test
```

| Branch | Command | Result |
| --- | --- | --- |
| `e/odysseus/vscode-format-settings` | `corepack pnpm --filter @generaltranslation/react-core typecheck` | Pass |
| `e/odysseus/vscode-format-settings` | `corepack pnpm --filter gt-react typecheck` | Pass |
| `e/odysseus/vscode-format-settings` | `corepack pnpm exec oxlint ./.vscode/settings.json --no-error-on-unmatched-pattern` | Pass; 0 lintable files |
| `e/odysseus/relax-dictionary-cache-config` | `corepack pnpm --filter @generaltranslation/react-core typecheck` | Pass |
| `e/odysseus/relax-dictionary-cache-config` | `corepack pnpm --filter gt-react typecheck` | Pass |
| `e/odysseus/relax-dictionary-cache-config` | `corepack pnpm exec oxlint ./packages/i18n/src/i18n-cache/I18nCache.ts ./packages/i18n/src/i18n-cache/types.ts` | Pass |
| `e/odysseus/export-browser-condition-helpers` | `corepack pnpm --filter @generaltranslation/react-core typecheck` | Pass |
| `e/odysseus/export-browser-condition-helpers` | `corepack pnpm --filter gt-react typecheck` | Pass |
| `e/odysseus/export-browser-condition-helpers` | `corepack pnpm exec oxlint ./packages/react/src/condition-store/createBrowserConditionStore.ts` | Pass |
| `e/odysseus/lookup-condition-adapter-scaffold` | `corepack pnpm --filter @generaltranslation/react-core typecheck` | Pass |
| `e/odysseus/lookup-condition-adapter-scaffold` | `corepack pnpm --filter gt-react typecheck` | Pass |
| `e/odysseus/lookup-condition-adapter-scaffold` | `corepack pnpm exec oxlint <10 touched files>` | Pass |
| `e/odysseus/provider-runtime-adapter-routing` | `corepack pnpm --filter @generaltranslation/react-core typecheck` | Pass |
| `e/odysseus/provider-runtime-adapter-routing` | `corepack pnpm --filter gt-react typecheck` | Pass |
| `e/odysseus/provider-runtime-adapter-routing` | `corepack pnpm exec oxlint <18 touched files>` | Pass |
| `e/odysseus/tracked-gt-lookups` | `corepack pnpm --filter @generaltranslation/react-core typecheck` | Pass |
| `e/odysseus/tracked-gt-lookups` | `corepack pnpm --filter gt-react typecheck` | Pass |
| `e/odysseus/tracked-gt-lookups` | `corepack pnpm exec oxlint <6 touched files>` | Pass |
| `e/odysseus/tracked-gt-lookups` | `corepack pnpm --filter @generaltranslation/react-core test` | Fail: inherited from unsplit source tree. `src/deprecated/provider/__tests__/i18n-store.test.ts` has 4 failing tests because `I18nStore({})` no longer uses the test's singleton manager/loaders; same failure reproduced on `e/odysseus/pr-stack-split-plan` source snapshot. |

## Audit Log

Source inventory recorded with:

```sh
git diff --name-status origin/odysseus...backup/e-odysseus-move-cache-to-provider-unsplit
```

Audit branch:

```sh
git switch -c tmp/pr-stack-split-audit origin/odysseus
git cherry-pick \
  e/odysseus/vscode-format-settings \
  e/odysseus/relax-dictionary-cache-config \
  e/odysseus/export-browser-condition-helpers \
  e/odysseus/lookup-condition-adapter-scaffold \
  e/odysseus/provider-runtime-adapter-routing \
  e/odysseus/tracked-gt-lookups
```

Required commands:

```sh
git diff --stat backup/e-odysseus-move-cache-to-provider-unsplit...HEAD
git diff --name-status backup/e-odysseus-move-cache-to-provider-unsplit...HEAD
```

Result: three-dot diff lists the expected full audit-branch changes from the shared `origin/odysseus` base. A direct tree comparison is empty:

```sh
git diff --stat backup/e-odysseus-move-cache-to-provider-unsplit HEAD
git diff --name-status backup/e-odysseus-move-cache-to-provider-unsplit HEAD
```

No output from the direct comparison. The split branches preserve the source tree exactly when applied together.

## Dropped Files

None.
