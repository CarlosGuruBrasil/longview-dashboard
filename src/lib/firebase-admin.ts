// firebase-admin está em serverExternalPackages no next.config.ts
// — não é bundado pelo Turbopack, usa require() nativo do Node.js
import { App, getApps, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging as _getMessaging, Message, MulticastMessage } from 'firebase-admin/messaging';

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
  return _getMessaging(getApp());
}

export async function sendFCM(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ ok: boolean; invalid?: boolean }> {
  const msg: Message = {
    token,
    notification: { title, body },
    data,
    webpush: { notification: { icon: '/icon-192.png', badge: '/icon-192.png' } },
  };
  try {
    await getMessaging().send(msg);
    return { ok: true };
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === 'messaging/registration-token-not-registered') return { ok: false, invalid: true };
    throw e;
  }
}

export async function sendFCMMulticast(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
) {
  if (!tokens.length) return { successCount: 0, failureCount: 0, invalidTokens: [] };

  const msg: MulticastMessage = {
    tokens,
    notification: { title, body },
    data,
    webpush: { notification: { icon: '/icon-192.png', badge: '/icon-192.png' } },
  };

  const res = await getMessaging().sendEachForMulticast(msg);
  const invalid = res.responses
    .map((r, i) =>
      (!r.success && r.error?.code === 'messaging/registration-token-not-registered') ? tokens[i] : null
    )
    .filter((t): t is string => t !== null);

  return { successCount: res.successCount, failureCount: res.failureCount, invalidTokens: invalid };
}
