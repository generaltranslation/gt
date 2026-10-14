---
'gt-next': patch
---

Install `@generaltranslation/compiler` as a regular dependency of `gt-next` instead of an optional peer dependency, so the experimental babel compiler works without a separate install and `gt-next` is released alongside every compiler update.
