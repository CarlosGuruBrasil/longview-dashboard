'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Search, Filter, ChevronRight, UserPlus, Phone, Mail } from 'lucide-react';

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
    phone?: string;
    whatsapp?: string;
    avatarUrl?: string;
    company?: string;
  };
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  ativo:     { label: 'Ativo',     color: 'text-emerald-400 bg-emerald-500/10' },
  inativo:   { label: 'Inativo',   color: 'text-zinc-400 bg-zinc-500/10' },
  ferias:    { label: 'Férias',    color: 'text-sky-400 bg-sky-500/10' },
  afastado:  { label: 'Afastado',  color: 'text-amber-400 bg-amber-500/10' },
};

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function avatarBg(name: string) {
  const colors = ['bg-emerald-800/40 text-emerald-300', 'bg-sky-800/40 text-sky-300', 'bg-violet-800/40 text-violet-300', 'bg-orange-800/40 text-orange-300', 'bg-rose-800/40 text-rose-300'];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
}

export default function ColaboradoresPage() {
  const [users, setUsers]   = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(d => setUsers(d.users ?? []))
      .finally(() => setLoading(false));
  }, []);

  const departments = useMemo(() => {
    const s = new Set(users.map(u => u.profile?.department ?? '').filter(Boolean));
    return Array.from(s).sort();
  }, [users]);

  const roles = useMemo(() => {
    const s = new Set(users.map(u => u.role));
    return Array.from(s).sort();
  }, [users]);

  const filtered = useMemo(() => {
    return users.filter(u => {
      const q = search.toLowerCase();
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q) && !(u.profile?.position ?? '').toLowerCase().includes(q)) return false;
      if (filterDept && u.profile?.department !== filterDept) return false;
      if (filterRole && u.role !== filterRole) return false;
      if (filterStatus) {
        const st = u.profile?.status ?? 'ativo';
        if (st !== filterStatus) return false;
      }
      return true;
    });
  }, [users, search, filterDept, filterRole, filterStatus]);

  return (
    <div className="px-4 pt-6 pb-12 max-w-4xl mx-auto lg:px-8 lg:pt-10">

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Colaboradores</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{users.length} registros</p>
        </div>
        <Link href="/rh-vision/cadastro" className="flex items-center gap-2 h-9 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-colors">
          <UserPlus size={15} />
          <span className="hidden sm:inline">Convidar</span>
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar nome, email, cargo..."
            className="w-full pl-8 pr-3 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          className="h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50">
          <option value="">Todos depts.</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          className="h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50">
          <option value="">Todos perfis</option>
          {roles.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50">
          <option value="">Todos status</option>
          <option value="ativo">Ativo</option>
          <option value="ferias">Férias</option>
          <option value="afastado">Afastado</option>
          <option value="inativo">Inativo</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Filter size={32} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-500 text-sm">Nenhum colaborador encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(u => {
            const st = STATUS_LABEL[u.profile?.status ?? 'ativo'] ?? STATUS_LABEL.ativo;
            return (
              <Link
                key={u.id}
                href={`/rh-vision/colaboradores/${u.id}`}
                className="flex items-center gap-4 p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.10] transition-all group"
              >
                {u.profile?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.profile.avatarUrl} alt={u.name} className="w-11 h-11 rounded-full object-cover border border-white/10 shrink-0" />
                ) : (
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarBg(u.name)}`}>
                    {getInitials(u.name)}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-zinc-100">{u.name}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${st.color}`}>
                      {st.label}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5 truncate">
                    {u.profile?.position ?? u.role}
                    {u.profile?.department ? ` · ${u.profile.department}` : ''}
                  </p>
                  <p className="text-[11px] text-zinc-600 mt-0.5 truncate">{u.email}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {(u.profile?.phone || u.profile?.whatsapp) && (
                    <a
                      href={`tel:${u.profile.whatsapp ?? u.profile.phone}`}
                      onClick={e => e.stopPropagation()}
                      className="w-8 h-8 rounded-xl bg-white/[0.04] flex items-center justify-center text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                    >
                      <Phone size={13} />
                    </a>
                  )}
                  <a
                    href={`mailto:${u.email}`}
                    onClick={e => e.stopPropagation()}
                    className="w-8 h-8 rounded-xl bg-white/[0.04] hidden sm:flex items-center justify-center text-zinc-500 hover:text-sky-400 hover:bg-sky-500/10 transition-all"
                  >
                    <Mail size={13} />
                  </a>
                  <ChevronRight size={14} className="text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
