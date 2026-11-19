---
'@generaltranslation/compiler': patch
---

A build with the experimental `experimentalSplitTranslations` option also writes `gt-current.json` into its assets directory, under that one name in every build: what the names of each locale's translation files follow from, and, for the split by chunk, how the build assigned messages to files. A page that stayed open while the app was deployed again reads it when a translation file it asks for is gone, which happens on a host that drops the files of earlier builds. Translation files are assets named by what they hold: deploy them with the chunks they sit next to and keep them as long, and serve `gt-current.json` as `index.html` is served, not cached for good.
