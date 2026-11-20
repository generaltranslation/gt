---
'generaltranslation': patch
---

Keep every request within the API's limits. Every batched call splits its requests at the 4MB body limit as well as by item count. `uploadSourceFiles()` and `uploadTranslations()` send content by reference only when no request holds it inline, and split their requests so none names more than 150MB of uploads; a source whose translations exceed that goes with each part of them.
