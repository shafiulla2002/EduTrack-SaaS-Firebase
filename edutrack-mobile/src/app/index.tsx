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
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewNavigation } from 'react-native-webview';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import { PRODUCTION_WEB_URL } from '../constants/config';
import {
  initPushNotifications,
  unregisterPushTokenFromBackend,
  updateAppBadgeCount,
} from '../services/notifications';

const LAST_AUTHENTICATED_URL_KEY = 'edutrack_last_authenticated_url';
const LAST_BADGE_COUNT_KEY = 'edutrack_last_badge_count';

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

      // Sync unread notification count to React Native wrapper for app icon badge
      function reportNotificationCount() {
        try {
          var count = 0;
          if (typeof window.__EDUTRACK_UNREAD_COUNT__ === 'number') {
            count = window.__EDUTRACK_UNREAD_COUNT__;
          } else {
            // Find badge elements rendered in header (e.g. red/rose counter on notification bell)
            var badgeEls = document.querySelectorAll('span');
            for (var i = 0; i < badgeEls.length; i++) {
              var el = badgeEls[i];
              var cls = el.className || '';
              if (
                (cls.indexOf('bg-rose') !== -1 || cls.indexOf('bg-red') !== -1) &&
                el.closest('button, header, nav')
              ) {
                var text = (el.textContent || '').trim();
                var num = parseInt(text, 10);
                if (!isNaN(num) && num >= 0) {
                  count = num;
                  break;
                }
              }
            }
          }

          if (window.ReactNativeWebView && count !== window.__LAST_REPORTED_COUNT__) {
            window.__LAST_REPORTED_COUNT__ = count;
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'EDUTRACK_BADGE_COUNT',
              count: count
            }));
          }
        } catch(e) {}
      }

      reportAuthState();
      reportNotificationCount();

      window.addEventListener('storage', function() {
        reportAuthState();
        reportNotificationCount();
      });
      window.addEventListener('edutrack_auth_change', reportAuthState);
      window.addEventListener('edutrack_notification_change', reportNotificationCount);

      // Periodically sync and observe DOM changes
      setTimeout(reportAuthState, 1500);
      setTimeout(reportNotificationCount, 1500);
      setInterval(reportNotificationCount, 4000);

      try {
        var observer = new MutationObserver(function() {
          reportNotificationCount();
        });
        if (document.body) {
          observer.observe(document.body, { childList: true, subtree: true });
        }
      } catch(e) {}
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
        let savedUrl = await SecureStore.getItemAsync(LAST_AUTHENTICATED_URL_KEY);
        if (
          savedUrl &&
          !savedUrl.includes('/auth/login') &&
          !savedUrl.includes('/register-school')
        ) {
          if (savedUrl.includes('edutrackapplication.covenantsynergy.in')) {
            savedUrl = savedUrl.replace('https://edutrackapplication.covenantsynergy.in', PRODUCTION_WEB_URL.replace(/\/+$/, ''));
          }
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

  // 2. Initialize Push Notifications, Handle Tap Actions, and Manage Launcher Badge
  useEffect(() => {
    // Check if the app was opened by tapping a notification while closed/cold
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const data = response.notification.request.content.data;
        const targetUrl = data?.url || data?.click_action;
        if (targetUrl && typeof targetUrl === 'string' && webViewRef.current) {
          navigateWebViewTo(targetUrl);
        }
      }
    });

    // Handle notification tap while the app is in background or foreground
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        const targetUrl = data?.url || data?.click_action;
        if (targetUrl && typeof targetUrl === 'string' && webViewRef.current) {
          navigateWebViewTo(targetUrl);
        }
      }
    );

    // Update badge count whenever a new remote notification is received
    const notificationSubscription = Notifications.addNotificationReceivedListener(
      async (notification) => {
        // Prevent feedback loop from internal summary badge notifications
        if (
          notification.request.identifier === 'edutrack_unread_summary' ||
          notification.request.content.title === 'CS EduTrack'
        ) {
          return;
        }

        console.log('[PUSH] Received notification:', notification.request.content.title);
        const data = notification.request.content.data;
        const rawBadge = notification.request.content.badge ?? (data?.badge ? parseInt(String(data.badge), 10) : undefined);
        if (typeof rawBadge === 'number' && !isNaN(rawBadge)) {
          await updateAppBadgeCount(rawBadge);
          await SecureStore.setItemAsync(LAST_BADGE_COUNT_KEY, String(rawBadge)).catch(() => {});
        }

        // Trigger in-app notification counter and list refresh in WebView
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            try {
              if (typeof window.__EDUTRACK_REFRESH_NOTIFICATIONS__ === 'function') {
                window.__EDUTRACK_REFRESH_NOTIFICATIONS__();
              }
              window.dispatchEvent(new CustomEvent('edutrack_notification_change'));
            } catch(e) {}
            true;
          `);
        }
      }
    );

    // Keep badge count consistent when app is sent to background / minimized
    const appStateSubscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        try {
          const savedCountStr = await SecureStore.getItemAsync(LAST_BADGE_COUNT_KEY);
          if (savedCountStr !== null) {
            const count = parseInt(savedCountStr, 10);
            if (!isNaN(count)) {
              await updateAppBadgeCount(count);
            }
          }
        } catch {}
      }
    });

    return () => {
      responseSubscription.remove();
      notificationSubscription.remove();
      appStateSubscription.remove();
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
      } else if (data?.type === 'EDUTRACK_BADGE_COUNT' && typeof data.count === 'number') {
        const count = Math.max(0, Math.floor(data.count));
        console.log('[AUTH_BRIDGE] Synchronizing native launcher badge count:', count);
        await updateAppBadgeCount(count);
        await SecureStore.setItemAsync(LAST_BADGE_COUNT_KEY, String(count)).catch(() => {});
      } else if (data?.type === 'EDUTRACK_LOGOUT') {
        console.log('[AUTH_BRIDGE] User logged out, cleaning up device push tokens and badge');
        await unregisterPushTokenFromBackend(data.token);
        await updateAppBadgeCount(0);
        await SecureStore.deleteItemAsync(LAST_BADGE_COUNT_KEY).catch(() => {});
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
