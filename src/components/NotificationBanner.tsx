'use client';

import { Bell, X } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useState, useEffect } from 'react';

export default function NotificationBanner() {
  const { status, requestPermission } = useNotifications();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDismissed(localStorage.getItem('notif-dismissed') === '1');
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  // Não mostrar se: não suportado, já concedido, negado, ou dispensado
  if (status === 'unsupported' || status === 'granted' || status === 'denied' || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    localStorage.setItem('notif-dismissed', '1');
  }

  return (
    <div
      className="md:hidden fixed bottom-[76px] inset-x-0 z-40 px-4 pb-2"
      style={{ animation: 'slideUp 0.3s cubic-bezier(0.32,0,0.67,0)' }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-2xl"
        style={{
          background: 'rgba(14,165,233,0.12)',
          border: '1px solid rgba(14,165,233,0.25)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <Bell size={18} className="text-sky-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-zinc-100 leading-tight">Ativar notificações</p>
          <p className="text-[11px] text-zinc-400 leading-tight mt-0.5">Vendas, tarefas e alertas em tempo real</p>
        </div>
        <button
          onClick={requestPermission}
          disabled={status === 'requesting'}
          className="no-tap shrink-0 h-8 px-3 rounded-full bg-sky-500 text-white text-[12px] font-semibold active:scale-95 transition-transform disabled:opacity-60"
        >
          {status === 'requesting' ? '...' : 'Ativar'}
        </button>
        <button onClick={dismiss} className="no-tap shrink-0 p-1 text-zinc-500 active:text-zinc-300">
          <X size={14} />
        </button>
      </div>
      <style>{`@keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </div>
  );
}
