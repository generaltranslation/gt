---
'gt': patch
'gtx-cli': patch
---

Publish the bin-tagged binary release as per-platform optional dependency packages so installs only download the binary for the current platform instead of all five.

- Detect musl (Alpine) at runtime and use the JS fallback instead of spawning the glibc-only Linux binary, which package managers that ignore the "libc" field install on musl anyway.
- Format the launcher's fallback, load, and runtime messages as standard diagnostics.
