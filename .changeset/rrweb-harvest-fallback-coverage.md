---
'gt-rrweb': patch
---

fix(rrweb): compute harvest fallback coverage from every text node owned by a marked message, not only the overlay entries `overlayFromDict` emits. A dictionary entry for an unrelated bare source string can no longer rewrite a variable, an unchanged leaf, or a marked message that was skipped as untranslated or structurally ambiguous. Genuinely unmarked text still uses the bare-string fallback.
