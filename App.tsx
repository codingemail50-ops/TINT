import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';
import { useFonts } from 'expo-font';
import { VT323_400Regular } from '@expo-google-fonts/vt323';
import { Anton_400Regular } from '@expo-google-fonts/anton';
import { AppNavigator } from './src/navigation/AppNavigator';
import { Colors } from './src/constants/theme';

export default function App() {
  const [fontsLoaded] = useFonts({ VT323_400Regular, Anton_400Regular });

  if (!fontsLoaded) {
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
