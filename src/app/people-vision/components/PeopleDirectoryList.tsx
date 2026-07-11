'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight, Filter, Mail, Phone, Search, UserPlus } from 'lucide-react';
import LogoLoader from '@/components/ui/LogoLoader';

type DirectoryMode = 'colaboradores' | 'fornecedores';

interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  profile?: {
    category?: 'colaborador' | 'fornecedor';
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
  ativo: { label: 'Ativo', color: 'text-emerald-400 bg-emerald-500/10' },
  inativo: { label: 'Inativo', color: 'text-zinc-400 bg-zinc-500/10' },
  ferias: { label: 'Férias', color: 'text-sky-400 bg-sky-500/10' },
  afastado: { label: 'Afastado', color: 'text-amber-400 bg-amber-500/10' },
};

function getInitials(name?: string) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function avatarBg(name?: string) {
  const colors = [
    'bg-emerald-800/40 text-emerald-300',
    'bg-sky-800/40 text-sky-300',
    'bg-violet-800/40 text-violet-300',
    'bg-orange-800/40 text-orange-300',
    'bg-rose-800/40 text-rose-300',
  ];
  if (!name) return colors[0];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx] ?? colors[0];
}

function isSupplier(user: SafeUser) {
  return user.profile?.category === 'fornecedor' || user.role === 'Parceiro';
}

export default function PeopleDirectoryList({ mode }: { mode: DirectoryMode }) {
  const router = useRouter();
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [canCreate, setCanCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMaterial, setFilterMaterial] = useState('');

  useEffect(() => {
    fetch('/api/admin/users')
      .then((response) => response.json())
      .then((data) => {
        setUsers(data.users ?? []);
        setCanCreate(data.meta?.canCreate === true);
      })
      .finally(() => setLoading(false));
  }, []);

  const scopedUsers = useMemo(() => {
    return users.filter((user) => (mode === 'fornecedores' ? isSupplier(user) : !isSupplier(user)));
  }, [mode, users]);

  const departments = useMemo(() => {
    const set = new Set(scopedUsers.map((user) => user.profile?.department ?? '').filter(Boolean));
    return Array.from(set).sort();
  }, [scopedUsers]);

  const roles = useMemo(() => {
    const set = new Set(scopedUsers.map((user) => user.role).filter(Boolean));
    return Array.from(set).sort();
  }, [scopedUsers]);

  const materialTypes = useMemo(() => {
    const set = new Set(scopedUsers.map((user) => user.profile?.position ?? '').filter(Boolean));
    return Array.from(set).sort();
  }, [scopedUsers]);

  const filtered = useMemo(() => {
    return scopedUsers.filter((user) => {
      const query = search.trim().toLowerCase();
      const position = (user.profile?.position ?? '').toLowerCase();
      const email = user.email.toLowerCase();
      const company = (user.profile?.company ?? '').toLowerCase();
      const name = user.name.toLowerCase();

      if (query && !name.includes(query) && !email.includes(query) && !position.includes(query) && !company.includes(query)) {
        return false;
      }

      if (mode === 'fornecedores') {
        if (filterMaterial && user.profile?.position !== filterMaterial) return false;
      } else {
        if (filterDept && user.profile?.department !== filterDept) return false;
        if (filterRole && user.role !== filterRole) return false;
      }

      if (filterStatus) {
        const status = user.profile?.status ?? 'ativo';
        if (status !== filterStatus) return false;
      }

      return true;
    });
  }, [filterDept, filterMaterial, filterRole, filterStatus, mode, scopedUsers, search]);

  const emptyText = mode === 'fornecedores' ? 'Nenhum fornecedor encontrado' : 'Nenhum colaborador encontrado';
  const loaderText = mode === 'fornecedores' ? 'Sincronizando base de fornecedores...' : 'Sincronizando Banco de Colaboradores...';

  return (
    <div className="w-full space-y-6 p-4 md:p-6 lg:px-6 lg:py-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{scopedUsers.length} registros</p>
        {canCreate && mode === 'colaboradores' && (
          <Link href="/people-vision/cadastro" className="flex items-center gap-2 h-9 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-colors">
            <UserPlus size={15} />
            <span className="hidden sm:inline">Convidar</span>
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={mode === 'fornecedores' ? 'Buscar fornecedor, empresa, email, material...' : 'Buscar nome, email, cargo...'}
            className="w-full pl-8 pr-3 h-9 rounded-xl bg-[#121214]/60 border border-[#1E1E22] text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        {mode === 'fornecedores' ? (
          <select
            value={filterMaterial}
            onChange={(event) => setFilterMaterial(event.target.value)}
            className="h-9 px-3 rounded-xl bg-[#121214]/60 border border-[#1E1E22] text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50"
          >
            <option value="">Todos materiais</option>
            {materialTypes.map((material) => (
              <option key={material} value={material}>{material}</option>
            ))}
          </select>
        ) : (
          <>
            <select
              value={filterDept}
              onChange={(event) => setFilterDept(event.target.value)}
              className="h-9 px-3 rounded-xl bg-[#121214]/60 border border-[#1E1E22] text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50"
            >
              <option value="">Todos depts.</option>
              {departments.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
            <select
              value={filterRole}
              onChange={(event) => setFilterRole(event.target.value)}
              className="h-9 px-3 rounded-xl bg-[#121214]/60 border border-[#1E1E22] text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50"
            >
              <option value="">Todos perfis</option>
              {roles.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </>
        )}

        <select
          value={filterStatus}
          onChange={(event) => setFilterStatus(event.target.value)}
          className="h-9 px-3 rounded-xl bg-[#121214]/60 border border-[#1E1E22] text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50"
        >
          <option value="">Todos status</option>
          <option value="ativo">Ativo</option>
          <option value="ferias">Férias</option>
          <option value="afastado">Afastado</option>
          <option value="inativo">Inativo</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <LogoLoader module="people" text={loaderText} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Filter size={32} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-500 text-sm">{emptyText}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((user) => {
            const status = STATUS_LABEL[user.profile?.status ?? 'ativo'] ?? STATUS_LABEL.ativo;
            return (
              <div
                key={user.id}
                onClick={() => router.push(`/people-vision/colaboradores/${user.id}`)}
                className="flex items-center gap-4 p-4 rounded-xl border border-[#1E1E22] bg-[#121214]/60 hover:bg-[#17171A] hover:border-zinc-700 transition-all group cursor-pointer"
              >
                {user.profile?.avatarUrl ? (
                  <Image src={user.profile.avatarUrl} alt={user.name} width={44} height={44} className="rounded-full object-cover border border-[#1E1E22] shrink-0" unoptimized />
                ) : (
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarBg(user.name)}`}>
                    {getInitials(user.name)}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-zinc-100">{user.name}</p>
                    {mode === 'fornecedores' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase bg-amber-500/10 text-amber-400">
                        Fornecedor
                      </span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5 truncate">
                    {user.profile?.position ?? user.role}
                    {user.profile?.department ? ` · ${user.profile.department}` : ''}
                    {mode === 'fornecedores' && user.profile?.company ? ` · ${user.profile.company}` : ''}
                  </p>
                  <p className="text-[11px] text-zinc-600 mt-0.5 truncate">{user.email}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {(user.profile?.phone || user.profile?.whatsapp) && (
                    <a
                      href={`tel:${user.profile.whatsapp ?? user.profile.phone}`}
                      onClick={(event) => event.stopPropagation()}
                      className="w-8 h-8 rounded-xl border border-[#1E1E22] bg-[#18181B] flex items-center justify-center text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                    >
                      <Phone size={13} />
                    </a>
                  )}
                  <a
                    href={`mailto:${user.email}`}
                    onClick={(event) => event.stopPropagation()}
                    className="w-8 h-8 rounded-xl border border-[#1E1E22] bg-[#18181B] hidden sm:flex items-center justify-center text-zinc-500 hover:text-sky-400 hover:bg-sky-500/10 transition-all"
                  >
                    <Mail size={13} />
                  </a>
                  <ChevronRight size={14} className="text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
