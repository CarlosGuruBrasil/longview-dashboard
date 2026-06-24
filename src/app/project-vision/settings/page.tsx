'use client';

import NotificationPrefsPanel from '@/components/NotificationPrefsPanel';
import { Bell } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="px-4 pt-6 pb-10 max-w-lg mx-auto lg:px-8 lg:pt-10">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Configurações</h1>
        <p className="text-sm text-zinc-500 mt-1">Gerencie suas preferências de notificação</p>
      </div>

      {/* Seção de Notificações */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Bell size={15} className="text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
            Notificações Push
          </h2>
        </div>

        <NotificationPrefsPanel />
      </section>

    </div>
  );
}
