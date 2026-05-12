import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '../context/ThemeContext';

function RootContent() {
  const { theme } = useTheme();

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: '800', fontSize: 16, letterSpacing: 0.3 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen
          name="index"
          options={{ title: 'SeeRun', headerShown: false }}
        />
        <Stack.Screen
          name="visualizer"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="history"
          options={{ headerShown: false }}
        />
      </Stack>
      <StatusBar style={theme.statusBarStyle} backgroundColor={theme.background} />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootContent />
    </ThemeProvider>
  );
}
