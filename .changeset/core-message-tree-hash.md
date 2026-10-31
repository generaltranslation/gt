---
'generaltranslation': minor
'@generaltranslation/format': minor
'@generaltranslation/api': minor
'gt': patch
---

Message trees are a data format: `DataFormat` adds `'ICU_TREE'`, and `ContentByFormat` and `ContentFor` in `@generaltranslation/format/types` map each data format to its content, and `Content` covers every data format, message trees included. `hashSource` in `generaltranslation/id` hashes a message tree passed with `dataFormat: 'ICU_TREE'` like any other source, with its `context`, `maxChars` and `requiresReview`; object key order is ignored, and the format in the hashed data keeps tree keys apart from string and JSX keys. The API contract and runtime translation accept `ICU_TREE`.
