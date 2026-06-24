'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Users, UserPlus, UserCheck, Gift, Clock, AlertCircle,
  Building2, TrendingUp, CheckCircle2, ChevronRight,
} from 'lucide-react';

interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  profile?: {
    department?: string;
    position?: string;
    status?: string;
    birthDate?: string;
    phone?: string;
    avatarUrl?: string;
    activatedAt?: string;
  };
}

interface Pending {
  id: string;
  name: string;
  email: string;
  approverName: string;
  createdAt: string;
}

function KpiCard({
  icon: Icon, label, value, sub, color, href,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  href?: string;
}) {
  const inner = (
    <div className={`rounded-2xl border bg-white/[0.02] p-5 flex items-start gap-4 hover:bg-white/[0.04] transition-colors ${href ? 'cursor-pointer' : ''}`}
      style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-bold text-white leading-none">{value}</p>
        <p className="text-xs text-zinc-400 mt-1 font-medium">{label}</p>
        {sub && <p className="text-[11px] text-zinc-600 mt-0.5">{sub}</p>}
      </div>
      {href && <ChevronRight size={14} className="text-zinc-600 mt-1 shrink-0" />}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function getInitials(name?: string) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function roleColor(role: string) {
  const map: Record<string, string> = {
    Desenvolvedor: 'bg-purple-500/15 text-purple-300',
    Diretoria:     'bg-red-500/15 text-red-300',
    Gestor:        'bg-emerald-500/15 text-emerald-300',
    Parceiro:      'bg-amber-500/15 text-amber-300',
    Corretor:      'bg-blue-500/15 text-blue-300',
    Operador:      'bg-sky-500/15 text-sky-300',
  };
  return map[role] ?? 'bg-zinc-500/15 text-zinc-300';
}

export default function RHDashboard() {
  const [users, setUsers]       = useState<SafeUser[]>([]);
  const [pending, setPending]   = useState<Pending[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/users').then(r => r.json()),
      fetch('/api/admin/registrations').then(r => r.json()),
    ]).then(([usersData, regData]) => {
      setUsers(usersData.users ?? []);
      setPending((regData.registrations ?? []).filter((r: Pending & { status: string }) => r.status === 'pending'));
    }).finally(() => setLoading(false));
  }, []);

  const now   = new Date();
  const month = now.getMonth();
  const year  = now.getFullYear();

  const stats = useMemo(() => {
    const active     = users.filter(u => !u.profile?.status || u.profile.status === 'ativo');
    const inactive   = users.filter(u => u.profile?.status && u.profile.status !== 'ativo');
    const newThisMonth = users.filter(u => {
      const d = new Date(u.createdAt);
      return d.getMonth() === month && d.getFullYear() === year;
    });
    const birthdays  = users.filter(u => {
      if (!u.profile?.birthDate) return false;
      const d = new Date(u.profile.birthDate);
      return d.getMonth() === month;
    });
    const byDept: Record<string, number> = {};
    users.forEach(u => {
      const dept = u.profile?.department || 'Sem departamento';
      byDept[dept] = (byDept[dept] || 0) + 1;
    });
    const byRole: Record<string, number> = {};
    users.forEach(u => { byRole[u.role] = (byRole[u.role] || 0) + 1; });

    return { active, inactive, newThisMonth, birthdays, byDept, byRole };
  }, [users, month, year]);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '60dvh' }}>
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const monthName = now.toLocaleString('pt-BR', { month: 'long' });

  return (
    <div className="px-4 pt-6 pb-12 max-w-5xl mx-auto lg:px-8 lg:pt-10 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">RH Vision</h1>
        <p className="text-sm text-zinc-500 mt-1">Visão geral dos colaboradores</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Users}     label="Total"          value={users.length}            color="bg-emerald-500/15 text-emerald-300" href="/rh-vision/colaboradores" />
        <KpiCard icon={UserCheck} label="Ativos"         value={stats.active.length}     color="bg-sky-500/15 text-sky-300"         href="/rh-vision/colaboradores" />
        <KpiCard icon={UserPlus}  label="Novos este mês" value={stats.newThisMonth.length} color="bg-violet-500/15 text-violet-300" sub={monthName} href="/rh-vision/colaboradores" />
        <KpiCard icon={AlertCircle} label="Aprovações pendentes" value={pending.length} color={pending.length > 0 ? 'bg-amber-500/15 text-amber-300' : 'bg-zinc-500/15 text-zinc-400'} href="/rh-vision/cadastro" />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Gift}      label={`Aniversários — ${monthName}`} value={stats.birthdays.length}  color="bg-pink-500/15 text-pink-300" />
        <KpiCard icon={Building2} label="Departamentos"  value={Object.keys(stats.byDept).length}       color="bg-orange-500/15 text-orange-300" href="/rh-vision/colaboradores" />
        <KpiCard icon={Clock}     label="Inativos / Afastados" value={stats.inactive.length}            color="bg-zinc-500/15 text-zinc-400"  href="/rh-vision/colaboradores" />
        <KpiCard icon={TrendingUp} label="Funções diferentes" value={Object.keys(stats.byRole).length} color="bg-teal-500/15 text-teal-300" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Por departamento */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
            <Building2 size={14} className="text-emerald-400" />
            Por Departamento
          </h2>
          {Object.keys(stats.byDept).length === 0 ? (
            <p className="text-xs text-zinc-600">Nenhum departamento cadastrado</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(stats.byDept)
                .sort(([, a], [, b]) => b - a)
                .map(([dept, count]) => (
                  <div key={dept} className="flex items-center gap-3">
                    <span className="text-xs text-zinc-300 flex-1 truncate">{dept}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 rounded-full bg-emerald-500/30 overflow-hidden" style={{ width: '80px' }}>
                        <div
                          className="h-full bg-emerald-400 rounded-full"
                          style={{ width: `${Math.round((count / users.length) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-400 w-6 text-right">{count}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Aniversariantes do mês */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
            <Gift size={14} className="text-pink-400" />
            Aniversariantes — {monthName.charAt(0).toUpperCase() + monthName.slice(1)}
          </h2>
          {stats.birthdays.length === 0 ? (
            <p className="text-xs text-zinc-600">Nenhum aniversário este mês</p>
          ) : (
            <div className="space-y-2">
              {stats.birthdays.map(u => (
                <Link key={u.id} href={`/rh-vision/colaboradores/${u.id}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.04] transition-colors">
                  <div className="w-8 h-8 rounded-full bg-pink-500/20 border border-pink-500/20 flex items-center justify-center text-xs font-bold text-pink-300">
                    {getInitials(u.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-100 font-medium truncate">{u.name}</p>
                    <p className="text-[11px] text-zinc-500">
                      {u.profile?.birthDate ? new Date(u.profile.birthDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }) : ''}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Aprovações pendentes */}
      {pending.length > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
          <h2 className="text-sm font-semibold text-amber-300 mb-4 flex items-center gap-2">
            <AlertCircle size={14} />
            Aprovações Pendentes ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.slice(0, 5).map(reg => (
              <div key={reg.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-300">
                  {getInitials(reg.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-100 font-medium truncate">{reg.name}</p>
                  <p className="text-[11px] text-zinc-500">{reg.email} · aprovação: {reg.approverName}</p>
                </div>
                <Link href="/rh-vision/cadastro" className="text-xs text-amber-400 hover:text-amber-300 font-medium shrink-0">
                  Revisar →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista rápida de colaboradores recentes */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
            <Users size={14} className="text-emerald-400" />
            Colaboradores
          </h2>
          <Link href="/rh-vision/colaboradores" className="text-xs text-emerald-400 hover:text-emerald-300">
            Ver todos →
          </Link>
        </div>
        <div className="space-y-1">
          {users.slice(0, 8).map(u => (
            <Link key={u.id} href={`/rh-vision/colaboradores/${u.id}`} className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors group">
              {u.profile?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u.profile.avatarUrl} alt={u.name} className="w-8 h-8 rounded-full object-cover border border-white/10" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-emerald-800/30 border border-emerald-700/20 flex items-center justify-center text-xs font-bold text-emerald-300">
                  {getInitials(u.name)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-100 font-medium truncate">{u.name}</p>
                <p className="text-[11px] text-zinc-500 truncate">{u.profile?.position ?? u.role} {u.profile?.department ? `· ${u.profile.department}` : ''}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase hidden sm:inline-flex ${roleColor(u.role)}`}>
                {u.role}
              </span>
              <ChevronRight size={13} className="text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0" />
            </Link>
          ))}
        </div>
        {users.length > 8 && (
          <Link href="/rh-vision/colaboradores" className="mt-3 block text-center text-xs text-zinc-500 hover:text-emerald-400 transition-colors">
            + {users.length - 8} colaboradores
          </Link>
        )}
      </div>

    </div>
  );
}
