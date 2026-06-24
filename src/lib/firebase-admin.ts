// Firebase Admin SDK desabilitado para Coolify
// Notificações push comentadas — implementar via outro método se necessário

/*
import { App, getApps, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging as _getMessaging, Message, MulticastMessage } from 'firebase-admin/messaging';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
const firebaseApp: App = getApps().length ? (getApps()[0] as App) : initializeApp({ credential: cert(serviceAccount) });
const messaging = _getMessaging(firebaseApp);

export async function sendFCMMulticast(tokens: string[], title: string, body: string) {
  if (tokens.length === 0) return { successCount: 0 };
  const message: MulticastMessage = {
    notification: { title, body },
    tokens,
  };
  return messaging.sendMulticast(message);
}
*/

export async function sendFCMMulticast(tokens: string[], title: string, body: string) {
  console.log('[FCM] Notificações desabilitadas em Coolify:', { tokens, title, body });
  return { successCount: 0 };
}
