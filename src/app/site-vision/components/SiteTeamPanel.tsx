'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Loader2, Mail, Phone, ShieldCheck } from 'lucide-react';

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string;
  whatsapp: string;
  position: string;
  department: string;
  company: string;
  avatarUrl: string;
  status: string;
  professionalId: string;
  professionalIdType: string;
  visibleOnSite: boolean;
};

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

export function SiteTeamPanel() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const visibleIds = useMemo(() => team.filter((member) => member.visibleOnSite).map((member) => member.id), [team]);

  useEffect(() => {
    fetch('/api/site-vision/team', { cache: 'no-store' })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json?.error || 'Erro ao carregar equipe.');
        setTeam(json.team ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar equipe.'))
      .finally(() => setLoading(false));
  }, []);

  const save = async (nextTeam: TeamMember[]) => {
    setTeam(nextTeam);
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/site-vision/team', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibleUserIds: nextTeam.filter((member) => member.visibleOnSite).map((member) => member.id) }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'Erro ao salvar equipe.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar equipe.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-[320px] items-center justify-center rounded-[28px] border border-white/8 bg-white/[0.03] text-sm text-zinc-400"><Loader2 size={16} className="mr-2 animate-spin" />Carregando equipe do site...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.18),transparent_36%),linear-gradient(180deg,rgba(10,14,15,0.96),rgba(9,9,11,0.98))] p-6 shadow-[0_28px_120px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="inline-flex rounded-full border border-teal-400/15 bg-teal-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-teal-300">Equipe no site</span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">Corretores e consultores que podem aparecer no site</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400">
              Esses dados são reaproveitados do People Vision. Aqui você decide quem vai ou não para o site com um botão de ligar e desligar.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-300">
            {visibleIds.length} visíveis no site
          </div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {team.map((member) => (
          <div key={member.id} className="rounded-[26px] border border-white/8 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_48px_rgba(0,0,0,0.22)]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                {member.avatarUrl ? (
                  <Image src={member.avatarUrl} alt={member.name} width={56} height={56} className="h-14 w-14 rounded-2xl object-cover" unoptimized />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/12 text-sm font-bold text-teal-300">
                    {initials(member.name)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-white">{member.name}</p>
                  <p className="mt-1 text-sm text-zinc-400">{member.position || member.role}{member.department ? ` • ${member.department}` : ''}</p>
                  <p className="mt-1 text-xs text-zinc-500">{member.professionalIdType || 'Perfil interno'}{member.professionalId ? ` • ${member.professionalId}` : ''}</p>
                </div>
              </div>
              <button
                onClick={() => save(team.map((entry) => entry.id === member.id ? { ...entry, visibleOnSite: !entry.visibleOnSite } : entry))}
                disabled={saving}
                className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition-colors ${member.visibleOnSite ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300' : 'border-zinc-400/20 bg-zinc-500/10 text-zinc-200'}`}
              >
                {member.visibleOnSite ? 'Ligado' : 'Desligado'}
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
                <div className="flex items-center gap-2 text-zinc-500"><Phone size={14} />Contato</div>
                <p className="mt-2 font-medium text-white">{member.whatsapp || member.phone || 'Não informado'}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
                <div className="flex items-center gap-2 text-zinc-500"><Mail size={14} />E-mail</div>
                <p className="mt-2 truncate font-medium text-white">{member.email || 'Não informado'}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 text-xs text-zinc-500">
              <span>{member.company || 'LongView'}</span>
              <span className="inline-flex items-center gap-1"><ShieldCheck size={12} /> {member.status || 'ativo'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
