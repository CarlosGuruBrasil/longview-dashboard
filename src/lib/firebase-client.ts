// Firebase Client SDK — push notifications (FCM) no navegador
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported, type Messaging, type MessagePayload } from 'firebase/messaging';

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

let messagingPromise: Promise<Messaging | null> | null = null;

function getMessagingInstance(): Promise<Messaging | null> {
  if (messagingPromise) return messagingPromise;
  messagingPromise = (async () => {
    if (typeof window === 'undefined') return null;
    if (!(await isSupported())) return null;
    if (!firebaseConfig.apiKey) {
      console.warn('[Firebase] config ausente — NEXT_PUBLIC_FIREBASE_* não setadas');
      return null;
    }
    const app: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    return getMessaging(app);
  })();
  return messagingPromise;
}

/** Pede permissão, registra o service worker e retorna o token FCM (ou null). */
export async function requestNotificationToken(): Promise<string | null> {
  const messaging = await getMessagingInstance();
  if (!messaging) return null;
  if (!VAPID_KEY) {
    console.warn('[Firebase] NEXT_PUBLIC_FIREBASE_VAPID_KEY ausente — não é possível gerar token');
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  return token || null;
}

/** Listener de mensagens com o app em foreground. */
export async function onForegroundMessage(callback: (payload: MessagePayload) => void): Promise<() => void> {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}
