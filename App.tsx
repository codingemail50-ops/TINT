import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';
import { useFonts } from 'expo-font';
import { VT323_400Regular } from '@expo-google-fonts/vt323';
import { Anton_400Regular } from '@expo-google-fonts/anton';
import { AppNavigator } from './src/navigation/AppNavigator';
import { Colors } from './src/constants/theme';

// Font loading is a nice-to-have, not a hard requirement — if it fails or
// hangs (seen on some devices), the app must still render with system
// fonts rather than get stuck on a blank screen forever.
const FONT_LOAD_TIMEOUT_MS = 4000;

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ VT323_400Regular, Anton_400Regular });
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    console.log('[App] font load state:', { fontsLoaded, fontError });
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    const t = setTimeout(() => {
      console.log('[App] font load timed out after', FONT_LOAD_TIMEOUT_MS, 'ms — rendering anyway');
      setTimedOut(true);
    }, FONT_LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  if (!fontsLoaded && !fontError && !timedOut) {
    return <View style={styles.root} />;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
});
