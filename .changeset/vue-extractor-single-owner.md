---
'@generaltranslation/vue-extractor': major
---

Each name is now exported from one entry:

- `@generaltranslation/vue-extractor/types` is removed. Import the source extraction types from `@generaltranslation/vue-extractor`, `VueProjectExtractionOptions`, `VueProjectExtractionOutput` and `VueProjectExtractionResult` from `@generaltranslation/vue-extractor/project`, and `VueProjectInspection` from `@generaltranslation/vue-extractor/inspect`.
- `planVueExtraction`, `PrimaryInlineExtractor`, `VueExtractionPlan`, `VueExtractionPlannerOptions` and `VueExtractionRunOptions` are no longer exported from `@generaltranslation/vue-extractor`. Import them from `@generaltranslation/vue-extractor/integration`.
- `InlineExtractionOutput` is exported only from `@generaltranslation/vue-extractor/project`. The root and `/integration` no longer export it.
- `VueProjectExtractionOptions`, `VueProjectExtractionOutput`, `VueProjectExtractionResult` and `VueProjectInspection` are no longer exported from `@generaltranslation/vue-extractor`. Import the first three from `/project` and `VueProjectInspection` from `/inspect`. `/project` no longer exports `VueProjectInspection`.
