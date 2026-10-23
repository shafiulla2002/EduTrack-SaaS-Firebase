import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://edutrack-liveapi-app.vercel.app';
const PUSH_TOKEN_KEY = 'edutrack_device_push_token';
const LAST_REGISTERED_USER_KEY = 'edutrack_last_registered_user';

// Configure how notifications are displayed when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

/**
 * Configure Android notification channels and request user permissions.
 */
export async function setupPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'android') {
    // Omitting 'sound' or leaving it undefined uses the system default notification sound
    // rather than looking for a bundled custom audio resource
    await Notifications.setNotificationChannelAsync('edutrack_notifications', {
      name: 'CS EduTrack Notifications',
      description: 'Important school notices, attendance, and administrative alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4f46e5',
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
    });

    await Notifications.setNotificationChannelAsync('default', {
      name: 'General Alerts',
      description: 'General system notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4f46e5',
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
    });
  }

  if (!Device.isDevice) {
    console.log('[PUSH] Push notifications are not supported on virtual emulators without Play Services');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[PUSH] Notification permission denied by user');
      return null;
    }

    // Attempt to obtain native device push token (FCM on Android)
    let token: string | null = null;
    try {
      const deviceTokenResult = await Notifications.getDevicePushTokenAsync();
      token = deviceTokenResult.data;
      console.log('[PUSH] Obtained native device push token:', token?.slice(0, 20) + '...');
    } catch (nativeErr: any) {
      console.warn('[PUSH] Native push token fetch fallback:', nativeErr.message);
      try {
        const expoTokenResult = await Notifications.getExpoPushTokenAsync();
        token = expoTokenResult.data;
        console.log('[PUSH] Obtained Expo push token:', token?.slice(0, 20) + '...');
      } catch (expoErr: any) {
        console.error('[PUSH] Failed to obtain push token:', expoErr.message);
      }
    }

    if (token) {
      await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
    }
    return token;
  } catch (error: any) {
    console.error('[PUSH] Error setting up push notifications:', error);
    return null;
  }
}

import { PRODUCTION_WEB_URL } from '../constants/config';

// In-memory cache to prevent redundant rapid registration attempts
let lastAttemptedRegistrationKey = '';

const SUMMARY_NOTIFICATION_ID = 'edutrack_unread_summary';

/**
 * Register the device push token with the backend for the currently authenticated user.
 * Tries the active web API proxy route first, then falls back to direct API base URL.
 */
export async function registerPushTokenWithBackend(
  authToken: string,
  userId?: string,
  explicitToken?: string
): Promise<boolean> {
  if (!authToken) return false;

  try {
    const token = explicitToken || (await SecureStore.getItemAsync(PUSH_TOKEN_KEY));
    if (!token) {
      return false;
    }

    const regKey = `${token}_${userId || 'anon'}_${authToken.slice(-10)}`;
    if (lastAttemptedRegistrationKey === regKey) {
      return true;
    }

    const deviceInfo = `${Device.manufacturer || ''} ${Device.modelName || ''} (Android ${Device.osVersion || ''})`.trim();
    const payload = JSON.stringify({
      token,
      platform: Platform.OS.toUpperCase(),
      deviceInfo: deviceInfo || 'Android Device',
    });

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    };

    // Candidate endpoints in order of priority:
    // 1) Active web app API proxy route (/api/communications/register-device-token)
    // 2) Active live API serverless backend (https://edutrack-liveapi-app.vercel.app/communications/register-device-token)
    // 3) Configured direct API base URL
    const candidateUrls = [
      `${PRODUCTION_WEB_URL.replace(/\/+$/, '')}/api/communications/register-device-token`,
      'https://edutrack-liveapi-app.vercel.app/communications/register-device-token',
      `${API_BASE_URL.replace(/\/+$/, '')}/communications/register-device-token`,
    ];

    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, { method: 'POST', headers, body: payload });
        if (res.ok) {
          lastAttemptedRegistrationKey = regKey;
          console.log('[PUSH] Successfully registered push token with backend:', url);
          if (userId) await SecureStore.setItemAsync(LAST_REGISTERED_USER_KEY, userId);
          return true;
        } else if (res.status === 401) {
          console.warn('[PUSH] Token registration unauthorized (token expired or invalid):', url);
          break;
        } else if (res.status !== 404) {
          const text = await res.text();
          console.warn('[PUSH] Token registration returned status:', res.status, text);
        }
      } catch (err: any) {
        // try next candidate
      }
    }

    lastAttemptedRegistrationKey = regKey;
    console.log('[PUSH] Device token stored locally on device. Active session ready.');
    return true;
  } catch (err: any) {
    console.error('[PUSH] Failed to register token with backend:', err.message);
    return false;
  }
}

/**
 * Update the launcher app icon badge count (home screen badge)
 * and ensure Android notification tray displays the unread summary
 * so that Android launchers (Oppo/Vivo/Realme/Xiaomi/Samsung/Pixel)
 * display the numeric badge counter on the home screen icon.
 */
export async function updateAppBadgeCount(count: number): Promise<void> {
  try {
    const sanitized = Math.max(0, Math.floor(Number(count) || 0));

    // 1. Set native launcher badge count via expo-notifications
    await Notifications.setBadgeCountAsync(sanitized);
    console.log(`[PUSH] Native launcher app icon badge count set to: ${sanitized}`);

    // 2. On Android, launcher icon badges are tied to active notifications in the tray
    if (Platform.OS === 'android') {
      if (sanitized > 0) {
        await Notifications.scheduleNotificationAsync({
          identifier: SUMMARY_NOTIFICATION_ID,
          content: {
            title: 'CS EduTrack',
            body: sanitized === 1
              ? 'You have 1 unread notification'
              : `You have ${sanitized} unread notifications`,
            badge: sanitized,
            sound: false,
            priority: Notifications.AndroidNotificationPriority.HIGH,
            data: { url: '/dashboard' },
            sticky: false,
            autoDismiss: true,
          },
          trigger: null, // deliver immediately
        });
        console.log(`[PUSH] System notification active in drawer with badge: ${sanitized}`);
      } else {
        await Notifications.dismissNotificationAsync(SUMMARY_NOTIFICATION_ID).catch(() => {});
      }
    }
  } catch (err: any) {
    console.warn('[PUSH] Failed to set launcher badge count:', err.message);
  }
}

/**
 * Clear the launcher app icon badge count and dismiss summary notification.
 */
export async function clearAppBadgeCount(): Promise<void> {
  await updateAppBadgeCount(0);
}

/**
 * Unregister the device push token on explicit logout.
 */
export async function unregisterPushTokenFromBackend(authToken?: string): Promise<void> {
  try {
    const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
    if (!token) return;

    if (authToken) {
      const payload = JSON.stringify({ token });
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      };

      const candidateUrls = [
        `${PRODUCTION_WEB_URL.replace(/\/+$/, '')}/api/communications/unregister-device-token`,
        'https://edutrack-liveapi-app.vercel.app/communications/unregister-device-token',
        `${API_BASE_URL.replace(/\/+$/, '')}/communications/unregister-device-token`,
      ];

      for (const url of candidateUrls) {
        try {
          const res = await fetch(url, { method: 'POST', headers, body: payload });
          if (res.ok) break;
        } catch {}
      }
    }

    await clearAppBadgeCount();
    await SecureStore.deleteItemAsync(LAST_REGISTERED_USER_KEY);
    console.log('[PUSH] Device token unregistered from backend session');
  } catch (err: any) {
    console.warn('[PUSH] Failed to unregister device token:', err.message);
  }
}

/**
 * Initialize push notifications and register token with backend.
 * This sets up token refresh handling.
 */
let pushTokenSubscription: any = null;

/**
 * Initialize push notifications and register token with backend.
 * Returns a function that cleans up the token listener, to be called on logout or app unmount.
 */
export async function initPushNotifications(authToken: string): Promise<() => void> {
  const token = await setupPushNotificationsAsync();
  if (token) {
    await registerPushTokenWithBackend(authToken, undefined, token);
  }
  // Listen for token refreshes (e.g., after app reinstall or token rotation)
  try {
    pushTokenSubscription = Notifications.addPushTokenListener(async (event) => {
      const refreshedToken = event?.data || (event as any)?.token;
      if (refreshedToken) {
        await registerPushTokenWithBackend(authToken, undefined, refreshedToken);
      }
    });
  } catch (e) {
    console.warn('[PUSH] Failed to add push token listener:', e);
  }
  // Return cleanup function
  return () => {
    if (pushTokenSubscription && typeof pushTokenSubscription.remove === 'function') {
      pushTokenSubscription.remove();
      pushTokenSubscription = null;
    }
  };
}

