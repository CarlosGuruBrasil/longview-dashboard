import * as admin from 'firebase-admin';
import { App, getApps, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging as getAdminMessaging } from 'firebase-admin/messaging';

let _app: App | undefined;

function getApp(): App {
  if (_app) return _app;
  if (getApps().length) { _app = getApps()[0]; return _app!; }

  const privateKey = process.env.FIREBASE_PRIVATE_KEY_B64
    ? Buffer.from(process.env.FIREBASE_PRIVATE_KEY_B64, 'base64').toString('utf8')
    : undefined;

  if (!privateKey || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    throw new Error('Firebase Admin: variáveis FIREBASE_* não configuradas');
  }

  _app = initializeApp({
    credential: cert({
      projectId:   process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
  return _app;
}

export function getMessaging() {
  return getAdminMessaging(getApp());
}

/** Envia notificação FCM para um token específico */
export async function sendFCM(token: string, title: string, body: string, data?: Record<string, string>) {
  try {
    await getMessaging().send({
      token,
      notification: { title, body },
      data,
      webpush: { notification: { icon: '/icon-192.png', badge: '/icon-192.png' } },
    });
    return { ok: true };
  } catch (e: any) {
    if (e?.code === 'messaging/registration-token-not-registered') return { ok: false, invalid: true };
    throw e;
  }
}

/** Envia para múltiplos tokens, remove os inválidos */
export async function sendFCMMulticast(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
) {
  if (!tokens.length) return { successCount: 0, failureCount: 0, invalidTokens: [] };
  const res = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data,
    webpush: { notification: { icon: '/icon-192.png', badge: '/icon-192.png' } },
  });
  const invalid = res.responses
    .map((r, i) =>
      (!r.success && r.error?.code === 'messaging/registration-token-not-registered') ? tokens[i] : null
    )
    .filter((t): t is string => t !== null);
  return { successCount: res.successCount, failureCount: res.failureCount, invalidTokens: invalid };
}
