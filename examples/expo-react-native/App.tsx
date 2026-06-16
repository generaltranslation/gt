import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useLocale, T, GTProvider } from 'gt-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import gtConfig from './gt.config.json';

export default function App() {
  const [selectedLocale, setSelectedLocale] = useState('es');

  return (
    <GTProvider
      {...gtConfig}
      locale={selectedLocale}
      loadTranslations={loadTranslations}
    >
      <LocaleDemo setSelectedLocale={setSelectedLocale} />
      <StatusBar style='auto' />
    </GTProvider>
  );
}

async function loadTranslations(locale: string) {
  switch (locale) {
    case 'es':
      return import('./src/_gt/es.json');
    case 'fr':
      return import('./src/_gt/fr.json');
    default:
      return null;
  }
}

function LocaleDemo({
  setSelectedLocale,
}: {
  setSelectedLocale: (locale: string) => void;
}) {
  const locale = useLocale();
  const locales = [gtConfig.defaultLocale, ...gtConfig.locales];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>gt-react-native Expo</Text>
      <Text style={styles.locale}>Locale: {locale}</Text>
      <View style={styles.buttons}>
        {locales.map((nextLocale) => (
          <Pressable
            accessibilityRole='button'
            key={nextLocale}
            onPress={() => setSelectedLocale(nextLocale)}
            style={[
              styles.button,
              nextLocale === locale ? styles.activeButton : null,
            ]}
          >
            <Text
              style={[
                styles.buttonText,
                nextLocale === locale ? styles.activeButtonText : null,
              ]}
            >
              {nextLocale.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>
      <T id='welcomeMessage'>
        <Text style={styles.message}>
          This sentence is loaded from local GT translation files.
        </Text>
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    padding: 24,
    backgroundColor: '#f7f7f2',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2933',
  },
  locale: {
    fontSize: 18,
    color: '#374151',
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    minWidth: 58,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8b949e',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
  },
  activeButton: {
    borderColor: '#0f766e',
    backgroundColor: '#0f766e',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2933',
  },
  activeButtonText: {
    color: '#ffffff',
  },
  message: {
    maxWidth: 320,
    textAlign: 'center',
    fontSize: 17,
    lineHeight: 24,
    color: '#1f2933',
  },
});
