---
'@generaltranslation/vue-extractor': patch
'gt-vue': patch
'gt-sanity': patch
'gt-payload': patch
'gt-react-native': patch
---

Locale options now take their types from `GTConfig` or `LocaleConfig` instead of repeating them: `VueCompilerOptions`, gt-vue's `CreateGTOptions` and `InitializeGTSPAOptions`, gt-sanity's `GTPluginConfig`, gt-payload's `GtPluginOptions` and the gt-react-native plugin's `config` option. The accepted values are unchanged. gt-sanity links to the dashboard URL from `generaltranslation`.
