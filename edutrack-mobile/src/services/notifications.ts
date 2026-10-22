import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.edutrackapplication.covenantsynergy.in';
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
    await Notifications.setNotificationChannelAsync('edutrack_notifications', {
      name: 'CS EduTrack Notifications',
      description: 'Important school notices, attendance, and administrative alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4f46e5',
      enableLights: true,
      enableVibrate: true,
      sound: 'default',
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

/**
 * Register the device push token with the backend for the currently authenticated user.
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
      console.log('[PUSH] No device push token available to register');
      return false;
    }

    const deviceInfo = `${Device.manufacturer || ''} ${Device.modelName || ''} (Android ${Device.osVersion || ''})`.trim();

    const response = await fetch(`${API_BASE_URL}/communications/register-device-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        token,
        platform: Platform.OS.toUpperCase(),
        deviceInfo: deviceInfo || 'Android Device',
      }),
    });

    if (response.ok) {
      console.log('[PUSH] Successfully registered push token with CS EduTrack backend');
      if (userId) {
        await SecureStore.setItemAsync(LAST_REGISTERED_USER_KEY, userId);
      }
      return true;
    } else {
      const errorText = await response.text();
      console.warn('[PUSH] Backend rejected token registration:', response.status, errorText);
      return false;
    }
  } catch (err: any) {
    console.error('[PUSH] Failed to register token with backend:', err.message);
    return false;
  }
}

/**
 * Unregister the device push token on explicit logout.
 */
export async function unregisterPushTokenFromBackend(authToken?: string): Promise<void> {
  try {
    const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
    if (!token) return;

    if (authToken) {
      await fetch(`${API_BASE_URL}/communications/unregister-device-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ token }),
      });
    }

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

