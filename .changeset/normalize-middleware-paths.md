---
'gt-next': patch
---

Match encoded request paths against normalized Unicode middleware paths.

Preserve encoded dynamic parameter values during redirects and rewrites, decode static lookup keys only once, and avoid redirect loops for encoded or decomposed Unicode path templates.

Keep percent-encoded bracket literals distinct from dynamic route syntax.
