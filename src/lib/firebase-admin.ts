// Firebase Admin SDK desabilitado para Coolify
// Notificações push comentadas — implementar via outro método se necessário

export async function sendFCMMulticast(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
) {
  console.log('[FCM] Notificações desabilitadas em Coolify:', { tokens, title, body, data });
  return { successCount: 0 };
}
