---
"gt-next": patch
---

Fix type error in `tx()`: narrow `DataFormat` to `StringFormat` before passing to `formatMessage()`, filtering out `'JSX'` which is not a valid string format.
