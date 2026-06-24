'use client';

import NotificationPrefsPanel from '@/components/NotificationPrefsPanel';
import { Bell, Megaphone, Users } from 'lucide-react';

export default function NotificacoesPage() {
  return (
    <div className="px-4 pt-6 pb-12 max-w-lg mx-auto lg:px-8 lg:pt-10 space-y-8">

      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Notificações</h1>
        <p className="text-sm text-zinc-500 mt-1">Controle o que você recebe, em cada módulo</p>
      </div>

      {/* Dispositivo + Project Vision */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Users size={14} className="text-emerald-400" />
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Project Vision</h2>
        </div>
        <NotificationPrefsPanel />
      </section>

      {/* Marketing Vision (coming soon) */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Megaphone size={14} className="text-sky-400" />
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Marketing Vision</h2>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
          {[
            { icon: '📊', label: 'Alertas de Campanhas', desc: 'Campanhas pausadas ou sem gasto recente' },
            { icon: '👥', label: 'Leads sem Atendimento', desc: 'Leads aguardando há mais de 24h' },
            { icon: '💰', label: 'CPL Elevado', desc: 'Custo por lead acima do limite configurado' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] opacity-60">
              <span className="text-base shrink-0">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-300">{item.label}</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">{item.desc}</p>
              </div>
              <span className="text-[10px] text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full shrink-0">Em breve</span>
            </div>
          ))}
        </div>
      </section>

      {/* Sistema */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Bell size={14} className="text-orange-400" />
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Sistema</h2>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
          {[
            { icon: '🔔', label: 'Aprovações de Cadastro',   desc: 'Notificado quando um usuário solicita acesso' },
            { icon: '🔐', label: 'Login em novo dispositivo', desc: 'Alerta quando sua conta é acessada de outro local' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] opacity-60">
              <span className="text-base shrink-0">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-300">{item.label}</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">{item.desc}</p>
              </div>
              <span className="text-[10px] text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full shrink-0">Em breve</span>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
