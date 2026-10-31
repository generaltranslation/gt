---
"gt-i18n": minor
"gt-react": minor
"gt-react-native": minor
"gt-next": minor
"gt-node": minor
"gt-tanstack-start": minor
---

Add opt-in `/unstable/icu` entries that let `/unstable` translations be ICU strings as well as message trees. Import one once wherever messages render (`gt-i18n/unstable/icu`, `gt-react/unstable/icu`, `gt-react-native/unstable/icu`, `gt-next/unstable/icu`, `gt-node/unstable/icu`, or `gt-tanstack-start/unstable/icu`); with gt-next, import it from a module both server and client components load. A catalog entry may then be a string such as `'{count, plural, one {# fichier} other {# fichiers}}'`, keyed by the source tree's hash as before. Each string is converted on first use with `icuToMessageTree(icu, { source })` against the message's source tree, which restores Intl options ICU cannot spell, and is cached. A string that is not valid ICU or uses different variables renders the source with a warning. Without the entry, a string entry still renders the source, and its warning now points to the entry. Apps that store message trees do not load the ICU parser.
