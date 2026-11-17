---
'@generaltranslation/icu': patch
---

`formatIcu` parses a message once for each locale instead of on every call, and returns a message without ICU syntax as its text without parsing it. Formatting a message again is 3 to 6 times faster. It keeps up to 1,024 parsed messages for each locale.
