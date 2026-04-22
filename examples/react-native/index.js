import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';
import { testLocalePolyfill } from 'gt-react-native/internal';
// import '@formatjs/intl-displaynames/locale-data/fr';
// import '@formatjs/intl-listformat/locale-data/fr';
// import '@formatjs/intl-pluralrules/locale-data/fr';
// import '@formatjs/intl-numberformat/locale-data/fr';
// import '@formatjs/intl-relativetimeformat/locale-data/fr';
// import '@formatjs/intl-datetimeformat/locale-data/fr';

testLocalePolyfill('fr');
testLocalePolyfill('fr-FR');

AppRegistry.registerComponent(appName, () => App);
