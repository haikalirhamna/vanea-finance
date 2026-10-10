import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans';
import { Redirect, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '@/state/AppState';

const FORM = { presentation: 'modal', animation: 'slide_from_bottom' } as const;

/** Sends a first-time user to onboarding. Finishing it navigates home itself, so the stack is never unmounted mid-flow. */
function Gate() {
  const { snapshot } = useApp();
  const segments = useSegments();
  const inOnboarding = segments[0] === 'onboarding';
  if (!snapshot.profile && !inOnboarding) return <Redirect href="/onboarding" />;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      <Stack.Screen name="add-expense" options={FORM} />
      <Stack.Screen name="add-income" options={FORM} />
      <Stack.Screen name="add-business-cost" options={FORM} />
      <Stack.Screen name="pay-salary" options={FORM} />
      <Stack.Screen name="add-credit-line" options={FORM} />
      <Stack.Screen name="add-loan" options={FORM} />
      <Stack.Screen name="change-salary" options={FORM} />
      <Stack.Screen name="intention" options={FORM} />
      <Stack.Screen name="advance" options={FORM} />
      <Stack.Screen name="add-subscription" options={FORM} />
      <Stack.Screen name="reflection" options={FORM} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsReady] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, PlusJakartaSans_600SemiBold });
  if (!fontsReady) return null;
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppProvider>
        <Gate />
      </AppProvider>
    </SafeAreaProvider>
  );
}
