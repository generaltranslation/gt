import { StatusBar } from 'expo-status-bar';
import {
  type GTProviderProps,
  getLocale,
  getTranslationsSnapshot,
  useLocale,
  useGT,
  GTProvider,
  T,
  Var,
  Num,
} from 'gt-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import gtConfig from './gt.config.json';

type AppSnapshot = {
  locale: string;
  translations: GTProviderProps['translations'];
};

export default function App() {
  const [locale, setLocale] = useState(() => getLocale());
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);

  useEffect(() => {
    let isActive = true;

    void getTranslationsSnapshot(locale).then((translations) => {
      if (!isActive) return;
      setSnapshot({ locale, translations });
    });

    return () => {
      isActive = false;
    };
  }, [locale]);

  if (snapshot?.locale !== locale) {
    return <LoadingState />;
  }

  return (
    <>
      <GTProvider locale={locale} translations={snapshot.translations}>
        <LocaleDemo onLocaleChange={setLocale} />
      </GTProvider>
      <StatusBar style='auto' />
    </>
  );
}

type LocaleDemoProps = {
  onLocaleChange: (locale: string) => void;
};

function LocaleDemo({ onLocaleChange }: LocaleDemoProps) {
  const locale = useLocale();
  const gt = useGT();
  const locales = [gtConfig.defaultLocale, ...gtConfig.locales];
  const gtMessage = gt('This line is translated with gt().', {
    $_hash: 'tMessage',
  });

  return (
    <View style={styles.container}>
      <T _hash='title'>
        <Text style={styles.title}>gt-react-native Expo</Text>
      </T>
      <T _hash='localeLabel'>
        <Text style={styles.locale}>
          Locale: <Var name='locale'>{locale}</Var>
        </Text>
      </T>
      <View style={styles.buttons}>
        {locales.map((nextLocale) => (
          <Pressable
            accessibilityRole='button'
            key={nextLocale}
            onPress={() => onLocaleChange(nextLocale)}
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
      <T _hash='welcomeMessage'>
        <Text style={styles.message}>
          This sentence is loaded from local GT translation files with{' '}
          <Var name='library'>gt-react-native</Var>.
        </Text>
      </T>
      <Text style={styles.smallMessage}>{gtMessage}</Text>
      <T _hash='countMessage'>
        <Text style={styles.smallMessage}>
          The app has <Num name='count'>{3}</Num> translated examples.
        </Text>
      </T>
    </View>
  );
}

function LoadingState() {
  return (
    <View style={styles.loadingContainer}>
      <Text style={styles.loadingText}>Loading translations...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f7f7f2',
  },
  loadingText: {
    fontSize: 16,
    color: '#374151',
  },
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
  smallMessage: {
    maxWidth: 320,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    color: '#374151',
  },
});
