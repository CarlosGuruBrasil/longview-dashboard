'use client';

import { useState, useEffect, useCallback } from 'react';
import { requestNotificationToken, onForegroundMessage } from '@/lib/firebase-client';

type Status = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported';

export function useNotifications() {
  const [status, setStatus] = useState<Status>('idle');
  const [token, setToken] = useState<string | null>(null);

  // Verifica permissão atual ao montar
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        setStatus('unsupported');
        return;
      }
      if (Notification.permission === 'granted') setStatus('granted');
      else if (Notification.permission === 'denied') setStatus('denied');
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  // Listener de mensagens em foreground (app aberto)
  useEffect(() => {
    if (status !== 'granted') return;
    
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      const unsub = await onForegroundMessage((payload) => {
        const { title = 'LongView', body = '' } = payload.notification ?? {};
        // Mostra notificação nativa mesmo com app aberto
        if (Notification.permission === 'granted') {
          new Notification(title, {
            body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
          });
        }
      });
      unsubscribe = unsub;
    })();
    return () => unsubscribe?.();
  }, [status]);

  const requestPermission = useCallback(async () => {
    if (status === 'requesting') return;
    setStatus('requesting');
    try {
      const fcmToken = await requestNotificationToken();
      if (fcmToken) {
        setToken(fcmToken);
        // Salva token no servidor
        await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: fcmToken }),
        });
      }
    } catch {
      /* token falhou — ainda assim refletimos a escolha de permissão abaixo */
    }
    // Reflete a decisão real do usuário: granted/denied fazem o banner sair da tela.
    // Só volta pra 'idle' se ele fechou o prompt do SO sem escolher.
    const perm = Notification.permission;
    setStatus(perm === 'granted' ? 'granted' : perm === 'denied' ? 'denied' : 'idle');
  }, [status]);

  return { status, token, requestPermission };
}
