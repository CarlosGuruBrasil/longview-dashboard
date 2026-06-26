'use client';

import NotificationPrefsPanel from '@/components/NotificationPrefsPanel';
import { Bell } from 'lucide-react';
import ProjectSheetImportPanel from './ProjectSheetImportPanel';

export default function SettingsPage() {
  return (
    <div className="w-full space-y-6 p-4 md:p-6 lg:px-6 lg:py-4">
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

      <ProjectSheetImportPanel />

    </div>
  );
}
