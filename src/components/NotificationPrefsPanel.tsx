'use client';

/**
 * NotificationPrefsPanel
 *
 * Painel de controle de notificações push do usuário.
 * Permite ativar/desativar cada tipo de alerta individualmente.
 * Também exibe o status da permissão do browser e permite ativar/revogar.
 *
 * Uso: importar em qualquer page/layout onde fizer sentido mostrar
 * configurações (ex: página de perfil, settings, sidebar).
 */

import { useState, useEffect, useCallback } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { Bell, BellOff, Loader2, Check } from 'lucide-react';

interface NotifPrefs {
  emergencial:    boolean;
  critica:        boolean;
  nova_tarefa:    boolean;
  projeto_parado: boolean;
}

interface PrefItem {
  key: keyof NotifPrefs;
  label: string;
  description: string;
  icon: string;
  dedup: string;
}

const PREF_ITEMS: PrefItem[] = [
  {
    key:         'emergencial',
    label:       'Tarefas Emergenciais',
    description: 'Alertas quando uma tarefa emergencial não finalizada está aberta.',
    icon:        '🚨',
    dedup:       'Repetição máx: 1x a cada 4h',
  },
  {
    key:         'critica',
    label:       'Prazos Críticos',
    description: 'Notificado quando prazo de tarefa crítica vence ou está a < 24h.',
    icon:        '⚠️',
    dedup:       'Repetição máx: 1x a cada 4h',
  },
  {
    key:         'nova_tarefa',
    label:       'Nova Tarefa Atribuída',
    description: 'Avisado quando uma tarefa nova for atribuída ao seu usuário.',
    icon:        '📋',
    dedup:       'Apenas uma vez por tarefa',
  },
  {
    key:         'projeto_parado',
    label:       'Projeto sem Atualização',
    description: 'Alerta quando projeto fica 7 dias sem nenhum log de atualização.',
    icon:        '📊',
    dedup:       'Repetição máx: 1x a cada 24h',
  },
];

function Toggle({ checked, onChange, disabled }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      disabled={disabled}
      aria-checked={checked}
      role="switch"
      className={`
        relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200
        focus:outline-none disabled:opacity-40
        ${checked ? 'bg-sky-500' : 'bg-zinc-700'}
      `}
    >
      <span className={`
        absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow
        transition-transform duration-200
        ${checked ? 'translate-x-5' : 'translate-x-0'}
      `} />
    </button>
  );
}

export default function NotificationPrefsPanel() {
  const { status, requestPermission } = useNotifications();
  const [prefs, setPrefs]   = useState<NotifPrefs | null>(null);
  const [saving, setSaving] = useState<keyof NotifPrefs | null>(null);
  const [saved, setSaved]   = useState<keyof NotifPrefs | null>(null);
  const [loadErr, setLoadErr] = useState(false);

  // Carrega preferências do servidor
  useEffect(() => {
    fetch('/api/notifications/prefs')
      .then(r => r.json())
      .then(d => setPrefs(d.prefs ?? null))
      .catch(() => setLoadErr(true));
  }, []);

  const togglePref = useCallback(async (key: keyof NotifPrefs, value: boolean) => {
    if (!prefs) return;
    const optimistic = { ...prefs, [key]: value };
    setPrefs(optimistic);
    setSaving(key);
    setSaved(null);

    try {
      const res = await fetch('/api/notifications/prefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error();
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    } catch {
      // Reverte em caso de erro
      setPrefs(prev => prev ? { ...prev, [key]: !value } : prev);
    } finally {
      setSaving(null);
    }
  }, [prefs]);

  // ─── Status da permissão browser ─────────────────────────────────────────

  const permissionLabel: Record<string, { text: string; color: string }> = {
    granted:     { text: 'Ativo — push ativado neste dispositivo', color: 'text-emerald-400' },
    denied:      { text: 'Bloqueado — permissão negada pelo browser', color: 'text-red-400' },
    unsupported: { text: 'Não suportado neste browser', color: 'text-zinc-500' },
    requesting:  { text: 'Aguardando permissão…', color: 'text-amber-400' },
    idle:        { text: 'Não ativado neste dispositivo', color: 'text-zinc-500' },
  };

  const perm = permissionLabel[status] ?? permissionLabel.idle;

  return (
    <div className="flex flex-col gap-6">

      {/* ── Status do push neste dispositivo ── */}
      <section className="rounded-xl border border-white/8 bg-white/3 p-4">
        <div className="flex items-start gap-3">
          {status === 'granted'
            ? <Bell size={18} className="text-sky-400 mt-0.5 flex-shrink-0" />
            : <BellOff size={18} className="text-zinc-500 mt-0.5 flex-shrink-0" />
          }
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-100">Push neste dispositivo</p>
            <p className={`text-xs mt-0.5 ${perm.color}`}>{perm.text}</p>
          </div>
          {(status === 'idle') && (
            <button
              onClick={requestPermission}
              className="flex-shrink-0 h-8 px-3 rounded-full bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold transition-colors"
            >
              Ativar
            </button>
          )}
          {status === 'denied' && (
            <span className="flex-shrink-0 text-[10px] text-zinc-500 text-right leading-tight max-w-[100px]">
              Desbloqueie nas configurações do browser
            </span>
          )}
        </div>
      </section>

      {/* ── Tipos de notificação ── */}
      <section>
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
          Tipos de alerta
        </p>

        {loadErr && (
          <p className="text-xs text-red-400 mb-3">Erro ao carregar preferências.</p>
        )}

        <div className="flex flex-col gap-2">
          {PREF_ITEMS.map(item => {
            const isOn     = prefs?.[item.key] ?? true;
            const isSaving = saving === item.key;
            const isSaved  = saved === item.key;
            const disabled = !prefs || isSaving || status === 'denied' || status === 'unsupported';

            return (
              <div
                key={item.key}
                className={`
                  flex items-center gap-3 p-3.5 rounded-xl border transition-colors
                  ${isOn
                    ? 'border-white/8 bg-white/3'
                    : 'border-white/4 bg-transparent opacity-60'
                  }
                `}
              >
                <span className="text-lg flex-shrink-0">{item.icon}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-zinc-100 leading-tight">
                      {item.label}
                    </p>
                    {isSaved && (
                      <span className="flex items-center gap-0.5 text-[10px] text-emerald-400">
                        <Check size={10} /> Salvo
                      </span>
                    )}
                    {isSaving && (
                      <Loader2 size={10} className="text-zinc-500 animate-spin" />
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">
                    {item.description}
                  </p>
                  <p className="text-[10px] text-zinc-600 mt-1">{item.dedup}</p>
                </div>

                <Toggle
                  checked={isOn}
                  onChange={v => togglePref(item.key, v)}
                  disabled={disabled}
                />
              </div>
            );
          })}
        </div>

        {(status === 'denied' || status === 'unsupported') && (
          <p className="mt-3 text-[11px] text-zinc-500 text-center">
            {status === 'denied'
              ? 'Push bloqueado neste browser — ative nas configurações para usar preferências.'
              : 'Push não disponível neste browser/dispositivo.'}
          </p>
        )}
      </section>
    </div>
  );
}
