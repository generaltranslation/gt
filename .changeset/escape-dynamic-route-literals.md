---
'gt-next': patch
---

Treat static text in configured dynamic routes literally when matching shared paths and localized aliases. Escape regex metacharacters such as `.`, `+`, parentheses, `|`, and `$` so valid routes match and lookalike paths do not, including unprefixed default-locale aliases used for locale selection.
