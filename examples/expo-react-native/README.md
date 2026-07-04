# gt-react-native + Expo Example

Minimal Expo development app for testing the workspace `gt-react-native` package.

## Quick Start

```sh
# From the monorepo root
pnpm install
pnpm --filter gt-react-native-expo-example start
```

`gt-react-native` includes native code, so use an Expo development build instead
of Expo Go:

```sh
pnpm --filter gt-react-native-expo-example ios
pnpm --filter gt-react-native-expo-example android
```

The app resolves `gt-react-native` from `packages/react-native/src` through
Metro, so edits to the library source are picked up by the Expo dev server.
