---
'gt': patch
---

`gt init` now detects Expo and React Native apps instead of setting them up as plain React. It stops before changing anything and links the React Native quickstart. Previously it installed `gt-react`, wrote a loader that Metro can't bundle, and saved `REACT_APP_` env names that Expo never loads.
