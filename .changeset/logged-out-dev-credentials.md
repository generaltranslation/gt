---
'gt': patch
---

`gt init` no longer defaults to creating development credentials when you are signed out: the "set up a project ID and hot-reload key" prompt now defaults to No unless you are signed in or have an API key, so pressing Enter never starts a browser sign-in. After creating a development key, setup now names the key and the project (name and ID) it was created for; the key itself is still never printed.
