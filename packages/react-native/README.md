<p align="center">
  <a href="https://generaltranslation.com/docs/react-native">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/brand/gt-logo-dark.svg">
      <img alt="General Translation" src="https://generaltranslation.com/brand/gt-logo-light.svg" width="100" height="100">
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://generaltranslation.com/docs/react-native"><strong>Documentation</strong></a> · <a href="https://github.com/generaltranslation/gt/issues">Report Bug</a>
</p>

# gt-react-native

Automatic i18n for React Native.

## Installation

```bash
npm install gt-react-native
npm install gt --save-dev
```

## Quick Start

```bash
npx gt init
```

```jsx
// index.ts
import { registerRootComponent } from 'expo';
import { initializeGT } from 'gt-react-native';
import App from './App';
import gtConfig from './gt.config.json';
import esTranslations from './src/_gt/es.json';
import frTranslations from './src/_gt/fr.json';

const localTranslations = {
  es: esTranslations,
  fr: frTranslations,
};

initializeGT({
  defaultLocale: gtConfig.defaultLocale,
  locales: gtConfig.locales,
  loadTranslations: async (locale) => localTranslations[locale] ?? {},
});

registerRootComponent(App);
```

```jsx
// App.tsx
import { Text } from 'react-native';
import { T, GTProvider } from 'gt-react-native';

export default function App() {
  return (
    <GTProvider>
      <T>
        <Text>This gets translated automatically.</Text>
      </T>
    </GTProvider>
  );
}
```

See the [full documentation](https://generaltranslation.com/docs/react-native) for guides and API reference.
