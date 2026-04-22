# gt-react-native example

Example React Native app for testing `gt-react-native` locally.

## Setup

```sh
# From the monorepo root
pnpm install
pnpm --filter gt-react-native build

# iOS
cd examples/react-native/ios && bundle install && bundle exec pod install && cd ..
pnpm --filter gt-react-native-example ios

# Android
pnpm --filter gt-react-native-example android
```

## Note on Android architectures

The `build:android` script is configured for `arm64-v8a` only. If you're using an x86_64 emulator, override the architecture flag: `pnpm build:android --extra-params "-PreactNativeArchitectures=x86_64"`.
