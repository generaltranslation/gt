---
'gt-rrweb': minor
---

Add the replayer: `createGTReplayer()` (framework-agnostic) + `<GTReplayer>` via the new `gt-rrweb/replay` entry play a recording in any of its traced locales — live in-player locale switching, a synthesized cursor that follows the recorded clicks, scrubbing, light/dark toggle, and full-screen. Options: `initialLocale`, `switchLocalesAllowed`, `debug` (drop a recording JSON to hot-swap). Events-only exports still replay localized via the locale/overlay events the recorder embeds in the stream. `@rrweb/replay` joins `@rrweb/record` as an optional peer.
