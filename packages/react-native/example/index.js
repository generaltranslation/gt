import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';
// import { testLocalePolyfill } from 'gt-react-native/internal';
// testLocalePolyfill('fr');
// testLocalePolyfill('fr-FR');

AppRegistry.registerComponent(appName, () => App);
