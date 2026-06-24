// Firebase Client SDK desabilitado para Coolify
// Push notifications comentadas

/*
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';

const firebaseConfig = {
  // config aqui
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export let messaging: Messaging | null = null;
*/

export async function requestNotificationToken(): Promise<string | null> {
  console.log('[Firebase] Notificações desabilitadas em Coolify');
  return null;
}

export async function onForegroundMessage(callback: (payload: any) => void): Promise<void> {
  console.log('[Firebase] Notificações desabilitadas em Coolify');
}
