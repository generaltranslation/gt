---
'gt-react-native': patch
---

Guard the native module lookup on web so importing gt-react-native no longer crashes web renders (react-native-web and Expo web). The native TurboModule now resolves to null on web, where the existing Platform.OS guards already handle it, and native platforms are unchanged.
