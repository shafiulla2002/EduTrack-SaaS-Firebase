import React, { useRef, useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  BackHandler,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewNavigation } from 'react-native-webview';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import { PRODUCTION_WEB_URL } from '../constants/config';
import {
  initPushNotifications,
  unregisterPushTokenFromBackend,
} from '../services/notifications';

const LAST_AUTHENTICATED_URL_KEY = 'edutrack_last_authenticated_url';

const INJECTED_STABILIZING_JS = `
  (function() {
    try {
      var meta = document.querySelector('meta[name="viewport"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'viewport';
        document.head.appendChild(meta);
      }
      meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

      var style = document.getElementById('edutrack-webview-stabilizer');
      if (!style) {
        style = document.createElement('style');
        style.id = 'edutrack-webview-stabilizer';
        style.innerHTML = 'html, body { overflow-x: hidden !important; max-width: 100vw !important; width: 100% !important; touch-action: pan-y !important; -webkit-overflow-scrolling: touch; } * { max-width: 100%; box-sizing: border-box; }';
        document.head.appendChild(style);
      }

      // Sync auth state to React Native wrapper for push token registration
      function reportAuthState() {
        try {
          var token = localStorage.getItem('admin_token') || localStorage.getItem('teacher_token') || localStorage.getItem('parent_token');
          var userRaw = localStorage.getItem('stored_current_user');
          var user = userRaw ? JSON.parse(userRaw) : null;
          var tenantId = localStorage.getItem('admin_tenantId') || localStorage.getItem('teacher_tenantId') || localStorage.getItem('parent_tenantId');

          if (token && window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'EDUTRACK_AUTH_STATE',
              token: token,
              userId: user ? user.id : null,
              tenantId: tenantId
            }));
          }
        } catch(e) {}
      }

      reportAuthState();
      window.addEventListener('storage', reportAuthState);
      window.addEventListener('edutrack_auth_change', reportAuthState);
      setTimeout(reportAuthState, 1500);
      setTimeout(reportAuthState, 4000);
    } catch(e) {}
  })();
  true;
`;

export default function EduTrackMobileApp() {
  const [pushCleanup, setPushCleanup] = useState<(() => void) | null>(null);
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [initialUrl, setInitialUrl] = useState<string | null>(null);

  // 1. Restore Persistent Session URL on Launch
  useEffect(() => {
    async function restoreSessionUrl() {
      try {
        const savedUrl = await SecureStore.getItemAsync(LAST_AUTHENTICATED_URL_KEY);
        if (
          savedUrl &&
          !savedUrl.includes('/auth/login') &&
          !savedUrl.includes('/register-school')
        ) {
          console.log('[SESSION] Restoring last authenticated portal URL:', savedUrl);
          setInitialUrl(savedUrl);
          return;
        }
      } catch (err) {
        console.warn('[SESSION] Failed to read last authenticated URL:', err);
      }
      setInitialUrl(PRODUCTION_WEB_URL);
    }

    restoreSessionUrl();
  }, []);

  // 2. Initialize Push Notifications & Handle Tap Actions
  useEffect(() => {
    // Push notification setup will be triggered after auth state is received
    // Check if the app was opened by tapping a notification while closed/cold
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const rawUrl = response.notification.request.content.data?.url;
        const targetUrl = typeof rawUrl === 'string' ? rawUrl : null;
        if (targetUrl && webViewRef.current) {
          navigateWebViewTo(targetUrl);
        }
      }
    });

    // Handle notification tap while the app is in background or foreground
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const rawUrl = response.notification.request.content.data?.url;
        const targetUrl = typeof rawUrl === 'string' ? rawUrl : null;
        if (targetUrl && webViewRef.current) {
          navigateWebViewTo(targetUrl);
        }
      }
    );

    return () => {
      responseSubscription.remove();
    };
  }, []);

  const navigateWebViewTo = (targetUrl: string) => {
    let fullUrl = targetUrl;
    if (!targetUrl.startsWith('http')) {
      const base = PRODUCTION_WEB_URL.replace(/\/+$/, '');
      const path = targetUrl.startsWith('/') ? targetUrl : `/${targetUrl}`;
      fullUrl = `${base}${path}`;
    }
    console.log('[NAV] Deep-linking WebView to:', fullUrl);
    webViewRef.current?.injectJavaScript(`window.location.href = '${fullUrl}'; true;`);
  };

  // 3. Handle Android Hardware Back Button
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const onBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [canGoBack]);

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
    const currentUrl = navState.url;

    // Check if user is in an authenticated portal
    const isAuthenticatedRoute =
      currentUrl.includes('/dashboard') ||
      currentUrl.includes('/parent') ||
      currentUrl.includes('/teacher') ||
      currentUrl.includes('/driver');

    const isLoginOrExitRoute =
      currentUrl.includes('/auth/login') ||
      currentUrl.includes('/register-school') ||
      currentUrl === PRODUCTION_WEB_URL ||
      currentUrl === `${PRODUCTION_WEB_URL}/`;

    if (isAuthenticatedRoute) {
      SecureStore.setItemAsync(LAST_AUTHENTICATED_URL_KEY, currentUrl).catch(() => {});
    } else if (isLoginOrExitRoute) {
      SecureStore.deleteItemAsync(LAST_AUTHENTICATED_URL_KEY).catch(() => {});
    }
  };

  const handleMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data?.type === 'EDUTRACK_AUTH_STATE' && data.token) {
        console.log('[AUTH_BRIDGE] Received authenticated session from WebView');
        const cleanup = await initPushNotifications(data.token);
        setPushCleanup(() => cleanup);
      } else if (data?.type === 'EDUTRACK_LOGOUT') {
        console.log('[AUTH_BRIDGE] User logged out, cleaning up device push tokens');
        await unregisterPushTokenFromBackend(data.token);
        // Clean up push token listener if present
        if (pushCleanup) {
          pushCleanup();
          setPushCleanup(null);
        }
        await SecureStore.deleteItemAsync(LAST_AUTHENTICATED_URL_KEY);
      }
    } catch {}
  };

  const handleShouldStartLoad = (request: { url: string }) => {
    const url = request.url;

    if (
      url.startsWith('tel:') ||
      url.startsWith('mailto:') ||
      url.startsWith('whatsapp:') ||
      url.startsWith('intent:')
    ) {
      Linking.openURL(url).catch((err) =>
        console.warn('Failed to open external URL:', err)
      );
      return false;
    }

    return true;
  };

  const handleRetry = () => {
    setHasError(false);
    setIsLoading(true);
    webViewRef.current?.reload();
  };

  if (!initialUrl) {
    return (
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Initializing EduTrack...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.container}>
        {!hasError ? (
          <WebView
            ref={webViewRef}
            source={{ uri: initialUrl }}
            style={styles.webview}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            thirdPartyCookiesEnabled={true}
            sharedCookiesEnabled={true}
            allowFileAccess={true}
            allowsInlineMediaPlayback={true}
            pullToRefreshEnabled={true}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            overScrollMode="never"
            bounces={false}
            scrollEnabled={true}
            injectedJavaScript={INJECTED_STABILIZING_JS}
            injectedJavaScriptBeforeContentLoaded={INJECTED_STABILIZING_JS}
            originWhitelist={['*']}
            onNavigationStateChange={handleNavigationStateChange}
            onShouldStartLoadWithRequest={handleShouldStartLoad}
            onMessage={handleMessage}
            onLoadStart={() => setHasError(false)}
            onLoadEnd={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
            onHttpError={(syntheticEvent) => {
              const { statusCode } = syntheticEvent.nativeEvent;
              if (statusCode >= 500) {
                setIsLoading(false);
                setHasError(true);
              }
            }}
          />
        ) : (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Unable to connect to EduTrack.</Text>
            <Text style={styles.errorMessage}>
              Please check your internet connection and try again.
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {isLoading && !hasError && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Loading EduTrack...</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#020617',
  },
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  webview: {
    flex: 1,
    backgroundColor: '#020617',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#020617',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 12,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#020617',
  },
  errorTitle: {
    color: '#f87171',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});
