import { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "../src/auth/AuthContext";
import { LoadingScreen } from "../src/components/common/LoadingScreen";

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthInitializer>
        <RootNavigator />
      </AuthInitializer>
    </AuthProvider>
  );
}

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { isReady } = useAuth();
  const [showLoading, setShowLoading] = useState(true);
  const [animationComplete, setAnimationComplete] = useState(false);

  useEffect(() => {
    // Hide loading screen once auth is ready
    if (isReady) {
      setShowLoading(false);
    }
  }, [isReady]);

  // Don't render children until both auth is ready AND animation is complete
  if (!isReady || (showLoading && !animationComplete)) {
    return (
      <>
        <LoadingScreen
          visible={showLoading}
          onAnimationComplete={() => setAnimationComplete(true)}
        />
        {/* Fallback for very slow loads */}
        {!isReady && (
          <View style={styles.fallbackContainer}>
            <ActivityIndicator size="small" color="rgba(255,255,255,0.3)" />
          </View>
        )}
      </>
    );
  }

  // Only render children (RootNavigator) after everything is ready
  return <>{children}</>;
}

function RootNavigator() {
  const { isAuthed, isReady } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [navigationReady, setNavigationReady] = useState(false);

  useEffect(() => {
    console.log('[NAV] Auth state - isReady:', isReady, 'isAuthed:', isAuthed, 'segments:', segments);

    if (!isReady) {
      console.log('[NAV] Not ready, waiting...');
      return;
    }

    const inAuthGroup = segments[0] === "(auth)";
    console.log('[NAV] In auth group?', inAuthGroup);

    if (!isAuthed && !inAuthGroup) {
      console.log('[NAV] Not authed and not in auth group - redirecting to login');
      router.replace("/(auth)/login");
    } else if (isAuthed && inAuthGroup) {
      console.log('[NAV] Authed but in auth group - redirecting to home');
      router.replace("/(app)/(drawer)");
    } else {
      console.log('[NAV] No redirect needed');
    }

    // Mark navigation as ready after first check
    console.log('[NAV] Setting navigationReady to true');
    setNavigationReady(true);
  }, [isAuthed, segments, isReady]);

  // Don't render Stack until navigation is ready to prevent screen mounting before redirect
  if (!navigationReady) {
    return (
      <View style={styles.fallbackContainer}>
        <ActivityIndicator size="small" color="rgba(255,255,255,0.3)" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({
  fallbackContainer: {
    position: "absolute",
    bottom: 60,
    alignSelf: "center",
  },
});
