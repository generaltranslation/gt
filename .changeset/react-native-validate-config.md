---
'gt-react-native': patch
---

The Babel plugin validates the `gt.config.json` it reads locales from with the shared schema. A file with invalid values, such as a string `locales`, now fails the build with the invalid keys, instead of splitting the string into single-letter locales. A JSON syntax error is reported without quoting the file content, which can hold credentials.
