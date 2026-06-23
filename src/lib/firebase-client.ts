'use client';

import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getApp() {
  return getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
}

let _messaging: Messaging | null = null;

export function getFirebaseMessaging(): Messaging | null {
  if (typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator)) return null;
  if (_messaging) return _messaging;
  try {
    _messaging = getMessaging(getApp());
    return _messaging;
  } catch { return null; }
}

/** Solicita permissão e retorna o FCM registration token */
export async function requestNotificationToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const messaging = getFirebaseMessaging();
  if (!messaging) return null;

  try {
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
    const token = await getToken(messaging, { serviceWorkerRegistration: swReg });
    return token || null;
  } catch (e) {
    console.error('[FCM] getToken error:', e);
    return null;
  }
}

/** Listener de mensagens em foreground */
export function onForegroundMessage(callback: (payload: any) => void) {
  const messaging = getFirebaseMessaging();
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}
