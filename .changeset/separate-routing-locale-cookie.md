---
'gt-next': patch
'gt-react': patch
---

Keep the active client locale unchanged while a locale-routed navigation is pending. Store the requested locale in a separate routing cookie and apply the server-rendered locale when the provider updates, so falling back to an unavailable locale's default page does not leave client translations in the rejected locale.

Custom locale cookie names also isolate pending locale requests between apps sharing a host.
