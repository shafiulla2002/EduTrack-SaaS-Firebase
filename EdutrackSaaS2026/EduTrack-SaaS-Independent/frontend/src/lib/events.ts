// src/lib/events.ts
export const SCHOOL_SETUP_UPDATED = 'school-setup-updated';

const syncChannel = typeof window !== 'undefined' ? new BroadcastChannel('edutrack-sync') : null;

if (syncChannel) {
  syncChannel.onmessage = (event) => {
    if (event.data === SCHOOL_SETUP_UPDATED) {
      const ev = new CustomEvent(SCHOOL_SETUP_UPDATED);
      window.dispatchEvent(ev);
    }
  };
}

/** Dispatch the school‑setup‑updated event */
export const dispatchSchoolSetupUpdated = () => {
  const ev = new CustomEvent(SCHOOL_SETUP_UPDATED);
  window.dispatchEvent(ev);
  if (syncChannel) {
    syncChannel.postMessage(SCHOOL_SETUP_UPDATED);
  }
};

/** Hook to register a listener that triggers a refetch callback */
import { useEffect } from 'react';
export const useSchoolSetupUpdate = (refetch: () => void) => {
  useEffect(() => {
    const handler = () => {
      console.info('[school-setup-updated] listener triggered');
      refetch();
    };
    window.addEventListener(SCHOOL_SETUP_UPDATED, handler);
    // flag for debugging (optional)
    (window as any).__hasSchoolSetupListener = true;
    return () => {
      window.removeEventListener(SCHOOL_SETUP_UPDATED, handler);
      (window as any).__hasSchoolSetupListener = false;
    };
  }, [refetch]);
};

/** Utility to debounce rapid successive updates and ensure only the latest data is applied */
export const debouncePromise = <T>(fn: () => Promise<T>, delay: number = 300) => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastReject: ((reason?: any) => void) | null = null;
  return new Promise<T>((resolve, reject) => {
    if (timer) clearTimeout(timer);
    if (lastReject) lastReject(); // cancel previous promise
    lastReject = reject;
    timer = setTimeout(() => {
      fn().then(resolve).catch(reject);
    }, delay);
  });
};
