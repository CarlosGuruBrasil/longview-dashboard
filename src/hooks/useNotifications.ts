'use client';

import { useState, useEffect, useCallback } from 'react';
import { requestNotificationToken, onForegroundMessage } from '@/lib/firebase-client';

type Status = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported';

export function useNotifications() {
  const [status, setStatus] = useState<Status>('idle');
  const [token, setToken] = useState<string | null>(null);

  // Verifica permissão atual ao montar
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setStatus('unsupported');
      return;
    }
    if (Notification.permission === 'granted') setStatus('granted');
    else if (Notification.permission === 'denied') setStatus('denied');
  }, []);

  // Listener de mensagens em foreground (app aberto)
  useEffect(() => {
    if (status !== 'granted') return;
    const unsub = onForegroundMessage((payload) => {
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
    return unsub;
  }, [status]);

  const requestPermission = useCallback(async () => {
    if (status === 'requesting') return;
    setStatus('requesting');
    try {
      const fcmToken = await requestNotificationToken();
      if (!fcmToken) {
        setStatus(Notification.permission === 'denied' ? 'denied' : 'idle');
        return;
      }
      setToken(fcmToken);
      setStatus('granted');
      // Salva token no servidor
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: fcmToken }),
      });
    } catch {
      setStatus('idle');
    }
  }, [status]);

  return { status, token, requestPermission };
}
