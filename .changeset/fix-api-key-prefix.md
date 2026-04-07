---
"gtx-cli": patch
---

Fixed setup wizard to not prefix GT_API_KEY with framework-specific prefixes (VITE_, NEXT_PUBLIC_, etc.) since production API keys should never be exposed to the client bundle.
