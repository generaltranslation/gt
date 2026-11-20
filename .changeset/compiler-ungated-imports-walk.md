---
'@generaltranslation/compiler': patch
---

A build with the experimental `experimentalSplitTranslations` option no longer walks the static imports of a chunk again for every pair of dynamic imports it checks. The check that every dynamic import which loads translations is wrapped asked, for each import of a chunk and each wrapped import before it, whether one loads the other, and each answer walked the chunk graph anew, so a chunk with many dynamic imports, such as a table of lazy routes, cost time that grew with the square of their number: 2.2 s of a build with 1,500 lazy routes, now 0.08 s. Each chunk's static imports are walked once. What the build emits and reports is unchanged.
