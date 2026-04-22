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
import { T, GTProvider } from 'gt-react-native';
import gtConfig from '../gt.config.json';
import { loadTranslations } from './loadTranslations';

export default function App() {
  return (
    <GTProvider config={gtConfig} loadTranslations={loadTranslations}>
      <T>
        <Text>This gets translated automatically.</Text>
      </T>
    </GTProvider>
  );
}
```

See the [full documentation](https://generaltranslation.com/docs/react-native) for guides and API reference.
