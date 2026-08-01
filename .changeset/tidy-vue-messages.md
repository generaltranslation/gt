---
'gt-i18n': minor
---

Make `msg(..., { $format: 'STRING' })` preserve source text literally instead
of applying ICU interpolation. For example, `msg('Hello {name}', {
$format: 'STRING', name: 'Ada' })` now encodes `Hello {name}` rather than
`Hello Ada`. Add lightweight shared helpers for registering, hashing, and
decoding literal STRING messages, and validate encoded fields by type.
