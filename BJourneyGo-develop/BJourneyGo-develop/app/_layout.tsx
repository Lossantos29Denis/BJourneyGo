import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import 'react-native-reanimated';

import { Asset } from 'expo-asset';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

import { Splash } from '@/components/splash';
import { AuthProvider } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/auth-context';

// Keep the native splash screen visible while we load resources
SplashScreen.preventAutoHideAsync().catch(() => {
  /* ignore errors */
});

// Hide the native splash immediately and show our custom splash
SplashScreen.hideAsync().catch(() => {
  /* ignore errors */
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [showCustomSplash, setShowCustomSplash] = useState(true);

  // Immediately hide the native splash screen when component mounts
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {
      /* ignore errors */
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    const start = Date.now();
    const MINIMUM_VISIBLE = 1500; // ensure splash shows for at least 1.5 seconds

    async function prepare() {
      try {
        // Respect OS reduce motion setting
        try {
          const reduce = await AccessibilityInfo.isReduceMotionEnabled();
          if (mounted) setReduceMotionEnabled(reduce);
        } catch (e) {
          // ignore
        }

        // Preload images and fonts (add any other assets or fonts here)
        const images = [
          // prefer existing logo; bJourneyGO4.png was missing in this workspace
          require('@/assets/images/logo.png'),
          require('@/assets/images/partial-react-logo.png'),
        ];

        // Example fonts: to preload fonts, add entries here pointing to files in assets/fonts using a static require
        // e.g. const fontsToRequire = [{ name: 'Inter-Bold', module: require('@/assets/fonts/Inter-Bold.ttf') }];
        const fontsToRequire: Array<{ name: string; module: any }> = [];

        // set up a fallback to avoid locking forever (increased to 18 seconds)
        fallbackTimer = setTimeout(() => {
          if (mounted) {
            // eslint-disable-next-line no-console
            console.log('[splash] Fallback timeout reached');
            setShowCustomSplash(false);
            SplashScreen.hideAsync().catch(() => {});
          }
        }, 18000);

        // fontsToRequire should already contain modules (static requires). Skip any missing entries.
        const fontsToLoad: Array<{ name: string; module: any }> = fontsToRequire.filter((f) => f && f.module);

        const totalAssets = images.length + fontsToLoad.length || 1;
        let loaded = 0;
        setProgress(0);

        // Load images sequentially (so we can show progress)
        for (const img of images) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            await Asset.fromModule(img).downloadAsync();
          } catch (e) {
            // If an asset fails to load, warn and continue — do not block the splash indefinitely
            // eslint-disable-next-line no-console
            console.warn('[splash] failed to load image asset', e);
          }
          loaded += 1;
          if (mounted) {
            const p = loaded / totalAssets;
            setProgress(p);
            // debug
            // eslint-disable-next-line no-console
            console.log('[splash] image loaded', img, 'progress', p);
          }
        }

        // Load fonts sequentially and update progress
        for (const f of fontsToLoad) {
          // Font.loadAsync accepts an object map
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          await Font.loadAsync({ [f.name]: f.module });
          loaded += 1;
          if (mounted) {
            const p = loaded / totalAssets;
            setProgress(p);
            // eslint-disable-next-line no-console
            console.log('[splash] font loaded', f.name, 'progress', p);
          }
        }

        // Wait for all assets to complete loading
        await new Promise((r) => setTimeout(r, 300));
        
        // CRITICAL: Ensure minimum visible time so the splash is ALWAYS shown
        const elapsed = Date.now() - start;
        const remainingTime = Math.max(0, MINIMUM_VISIBLE - elapsed);
        
        // eslint-disable-next-line no-console
        console.log(`[splash] Assets loaded in ${elapsed}ms. Waiting ${remainingTime}ms more to reach minimum visible time.`);
        
        // Always wait the remaining time, even if it's the full duration
        if (remainingTime > 0) {
          await new Promise((r) => setTimeout(r, remainingTime));
        }
        
        // Add a small extra delay to ensure smooth transition
        await new Promise((r) => setTimeout(r, 200));
        
        // eslint-disable-next-line no-console
        console.log('[splash] Minimum visible time reached. Proceeding to app...');

        // Hide custom splash and show the app
        if (mounted) {
          setShowCustomSplash(false);
        }
      } catch (e) {
        // If prepare throws, log and allow the app to continue instead of hanging on the splash
        // eslint-disable-next-line no-console
        console.warn('[splash] prepare() failed:', e);
        if (mounted) {
          setShowCustomSplash(false);
          SplashScreen.hideAsync().catch(() => {});
        }
      } finally {
        if (fallbackTimer) {
          clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
      }
    }

    void prepare();

    return () => {
      mounted = false;
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, []);

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        {showCustomSplash ? (
          <Splash
            playAnimation={!reduceMotionEnabled}
            progress={progress}
          />
        ) : (
          <RootNavigator />
        )}
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}

function RootNavigator() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  // Guard navigation based on auth state and current segment.
  React.useEffect(() => {
    if (isLoading) return;

    const inTabsGroup = segments[0] === '(tabs)';
    const inAuthScreen = segments[0] === 'login' || segments[0] === 'register' || segments[0] === 'sign_up';

    if (!user && inTabsGroup) {
      void router.replace('/login');
      return;
    }

    if (user && inAuthScreen) {
      void router.replace('/(tabs)/home');
    }
  }, [isLoading, user, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="sign_up" />
      <Stack.Screen name="terms_conditions" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="trip/[ticketUuid]" />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
    </Stack>
  );
}
