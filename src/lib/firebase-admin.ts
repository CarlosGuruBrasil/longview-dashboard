// Firebase Admin SDK — envio de push (FCM) pelo servidor
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import logger from '@/lib/logger'

let app: App | null = null;

function getAdminApp(): App | null {
  if (app) return app;
  if (getApps().length) { app = getApps()[0]; return app; }

  const projectId   = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const pkB64       = process.env.FIREBASE_PRIVATE_KEY_B64;
  if (!projectId || !clientEmail || !pkB64) {
    logger.warn('[FCM] credenciais admin ausentes (PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY_B64)');
    return null;
  }

  const privateKey = Buffer.from(pkB64, 'base64').toString('utf8');
  app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return app;
}

export async function sendFCMMulticast(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
) {
  if (!tokens.length) return { successCount: 0, failureCount: 0, invalidTokens: [] };

  const adminApp = getAdminApp();
  if (!adminApp) {
    // Sem credenciais não derruba tokens — só reporta falha
    return { successCount: 0, failureCount: tokens.length, invalidTokens: [] };
  }

  const res = await getMessaging(adminApp).sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: data ?? {},
  });

  // Coleta tokens que o FCM marcou como não-registrados/inválidos para limpeza
  const invalidTokens: string[] = [];
  res.responses.forEach((r, i) => {
    const code = r.error?.code;
    if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-argument') {
      invalidTokens.push(tokens[i]);
    }
  });

  return { successCount: res.successCount, failureCount: res.failureCount, invalidTokens };
}
