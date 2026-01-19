import { Text, View, StyleSheet, Button } from 'react-native';
import { useLocale, useSetLocale, T, GTProvider } from 'gt-react-native';
import gtConfig from '../gt.config.json';
import { getLocaleProperties } from 'generaltranslation';

export default function App() {
  return (
    <GTProvider {...gtConfig}>
      <Content />
    </GTProvider>
  );
}

function Content() {
  const locale = useLocale();
  const setLocale = useSetLocale();
  return (
    <View style={styles.container}>
      <Text>Locale: {locale}</Text>
      <Text>
        Locale Properties: {JSON.stringify(getLocaleProperties(locale))}
      </Text>
      <Button title="Set Locale to zh" onPress={() => setLocale('zh')} />
      <Button title="Set Locale to es" onPress={() => setLocale('es')} />
      <Button title="Set Locale to en" onPress={() => setLocale('en')} />
      <T>
        <Text>Hello, my friendly guy friends! Very cool!!!</Text>
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
