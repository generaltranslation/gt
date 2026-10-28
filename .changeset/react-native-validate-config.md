---
'gt-react-native': patch
---

The Babel plugin validates the `gt.config.json` it reads locales from with the shared schema. A file with invalid values, such as a string `locales`, is now reported with the invalid keys and the plugin falls back to the default locale, instead of splitting the string into single-letter locales. A JSON syntax error is reported without quoting the file content, which can hold credentials.
