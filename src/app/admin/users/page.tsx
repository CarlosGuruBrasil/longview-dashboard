'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Users, 
  UserPlus, 
  Edit2, 
  Trash2, 
  Shield, 
  ArrowLeft, 
  Loader2, 
  Check, 
  AlertTriangle,
  LogOut,
} from 'lucide-react';
import type { DbUser } from '@/lib/db-kv';
import PasswordInput from '@/components/app/PasswordInput';
import {
  createDefaultPermissions,
  normalizePermissions,
  type UserPermissions,
} from '@/lib/permissions';

const defaultPermissions: UserPermissions = createDefaultPermissions();

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Omit<DbUser, 'passwordHash'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [backHref, setBackHref] = useState('/select-app');

  // Estados do formulário
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Desenvolvedor' | 'Diretoria' | 'Operador' | 'Gestor' | 'Parceiro' | 'Corretor' | 'Visualizador'>('Corretor');
  const [permissions, setPermissions] = useState<UserPermissions>(defaultPermissions);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar usuários.');
      setUsers(data.users || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const from = new URLSearchParams(window.location.search).get('from');
    if (from?.startsWith('/')) {
      // ponytail: defer state update to next tick to avoid cascading renders
      Promise.resolve().then(() => setBackHref(from));
    }
    // ponytail: mount flag para cancelar setState se component unmount antes de fetch
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/users');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao carregar usuários.');
        if (mounted) setUsers(data.users || []);
      } catch (err: unknown) {
        if (mounted) setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Autofill permissões ao mudar o perfil base (atalho para facilidade de uso)
  const handleRoleChange = (selectedRole: typeof role) => {
    setRole(selectedRole);

    let newPerms = createDefaultPermissions();
    if (selectedRole === 'Desenvolvedor') {
      newPerms = createDefaultPermissions({
        viewMarketingDashboard: true,
        viewMarketingLeads: true,
        viewMarketingOportunidades: true,
        viewMarketingEstoque: true,
        viewMarketingAds: true,
        viewMarketingVendas: true,
        viewProjectVision: true,
        manageProjects: true,
        manageCommentsDocs: true,
        deleteTasks: true,
        viewPeopleVision: true,
        viewQualityVision: true,
        isAdmin: true
      });
    } else if (selectedRole === 'Diretoria') {
      newPerms = createDefaultPermissions({
        viewMarketingDashboard: true,
        viewMarketingLeads: true,
        viewMarketingOportunidades: true,
        viewMarketingEstoque: true,
        viewMarketingAds: true,
        viewMarketingVendas: true,
        viewProjectVision: true,
        manageProjects: true,
        manageCommentsDocs: true,
        deleteTasks: true,
        viewPeopleVision: true,
        viewQualityVision: true,
        isAdmin: true
      });
    } else if (selectedRole === 'Operador') {
      newPerms = createDefaultPermissions({
        viewProjectVision: true,
        manageProjects: true,
        manageCommentsDocs: true,
        deleteTasks: true
      });
    } else if (selectedRole === 'Gestor') {
      newPerms = createDefaultPermissions({
        viewMarketingDashboard: true,
        viewMarketingLeads: true,
        viewMarketingEstoque: true,
        viewProjectVision: true,
        manageProjects: true,
        manageCommentsDocs: true,
        viewPeopleVision: true,
        viewQualityVision: true,
      });
    } else if (selectedRole === 'Parceiro') {
      newPerms = createDefaultPermissions({
        viewProjectVision: true,
        manageCommentsDocs: true
      });
    } else if (selectedRole === 'Corretor') {
      newPerms = createDefaultPermissions({
        viewMarketingDashboard: true,
        viewMarketingLeads: true,
        viewMarketingEstoque: true
      });
    } else if (selectedRole === 'Visualizador') {
      newPerms = createDefaultPermissions({
        viewProjectVision: true
      });
    }
    setPermissions(newPerms);
  };

  const handleCheckboxChange = (key: keyof UserPermissions) => {
    setPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleEditClick = (user: Omit<DbUser, 'passwordHash'>) => {
    setEditingUserId(user.id);
    setName(user.name);
    setEmail(user.email);
    setPassword(''); // Deixar em branco (só preenche se quiser alterar)
    setRole(user.role);
    setPermissions(normalizePermissions(user.permissions));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setName('');
    setEmail('');
    setPassword('');
    setRole('Corretor');
    setPermissions(createDefaultPermissions());
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setError(null);
    setSuccess(null);

    const isEditing = !!editingUserId;
    const url = '/api/admin/users';
    const method = isEditing ? 'PUT' : 'POST';
    
    const payload: Record<string, unknown> = {
      name,
      email,
      role,
      permissions
    };

    if (isEditing) {
      payload.id = editingUserId;
      if (password.trim() !== '') {
        payload.password = password;
      }
    } else {
      payload.password = password;
    }

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro na operação.');

      setSuccess(isEditing ? 'Usuário atualizado com sucesso!' : 'Novo usuário cadastrado com sucesso!');
      handleCancelEdit();
      void fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteClick = async (id: string, name: string) => {
    if (!confirm(`Tem certeza de que deseja excluir permanentemente o usuário "${name}"?`)) {
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/users?id=${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao excluir usuário.');
      
      setSuccess(`Usuário "${name}" foi removido com sucesso.`);
      void fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    }
  };

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <header className="flex shrink-0 items-center gap-4 border-b border-white/[0.06] bg-[#0d0d0f]/88 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl lg:px-6">
        <Link
          href={backHref}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-zinc-500 transition-colors hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white"
          title="Voltar"
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-base font-semibold text-zinc-100">
            <Shield className="text-red-400" size={16} />
            <span className="truncate">Gerenciamento de Usuários</span>
          </h1>
          <p className="mt-0.5 truncate text-xs text-zinc-500">Controle de Segurança · cadastros e permissões</p>
        </div>
        <div className="ml-auto hidden h-9 w-28 items-center sm:flex">
          <Image src="/logolongview.png" alt="LongView" width={112} height={32} className="object-contain" priority />
        </div>
        <a
          href="/api/auth/logout"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-zinc-500 transition-colors hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-400"
          title="Sair"
        >
          <LogOut size={15} />
        </a>
      </header>

      <div className="w-full space-y-6 px-4 py-4 lg:px-6">

      {/* Grid de Conteúdo */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        
        {/* Coluna 1 e 2: Listagem de Usuários */}
        <section className="min-w-0 space-y-4">
          <div className="bg-[#121214]/60 border border-[#1e1e22] rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Users size={16} />
              Usuários Ativos
            </h3>

            {success && (
              <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-300">
                <Check size={16} />
                <span>{success}</span>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-500 space-y-2">
                <Loader2 className="animate-spin" size={32} />
                <span className="text-xs">Buscando banco de dados KV...</span>
              </div>
            ) : users.length === 0 ? (
              <p className="text-zinc-500 text-center py-10 text-sm">Nenhum usuário cadastrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#1e1e22] text-zinc-500 font-bold uppercase tracking-wider">
                      <th className="py-3 px-2">Nome / E-mail</th>
                      <th className="py-3 px-2">Perfil</th>
                      <th className="py-3 px-2">Permissões Principais</th>
                      <th className="py-3 px-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e1e22]">
                    {users.map((u) => {
                      const permissionsCount = Object.values(u.permissions).filter(Boolean).length;
                      return (
                        <tr key={u.id} className="hover:bg-white/1 transition-colors">
                          <td className="py-4.5 px-2">
                            <Link
                              href={`/people-vision/colaboradores/${u.id}?from=${encodeURIComponent('/admin/users')}`}
                              className="font-bold text-white text-sm hover:text-emerald-300 transition-colors"
                              title="Abrir ficha no People Vision"
                            >
                              {u.name}
                            </Link>
                            <p className="text-zinc-500 text-xs mt-0.5">{u.email}</p>
                          </td>
                          <td className="py-4.5 px-2">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                              u.role === 'Desenvolvedor' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                              u.role === 'Diretoria' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                              u.role === 'Operador' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                              u.role === 'Gestor' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              u.role === 'Parceiro' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                              u.role === 'Visualizador' ? 'bg-zinc-500/10 text-zinc-300 border border-zinc-500/20' :
                              'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="py-4.5 px-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {u.permissions.isAdmin && (
                                <span className="bg-red-500/10 text-red-400 px-1.5 py-0.2 rounded text-[11px] border border-red-500/20 font-bold uppercase tracking-wide">Admin</span>
                              )}
                              {u.permissions.viewMarketingDashboard && (
                                <span className="bg-blue-500/10 text-blue-400 px-1.5 py-0.2 rounded text-[11px] border border-blue-500/20 font-bold uppercase tracking-wide">Marketing</span>
                              )}
                              {u.permissions.viewProjectVision && (
                                <span className="bg-orange-500/10 text-orange-400 px-1.5 py-0.2 rounded text-[11px] border border-orange-500/20 font-bold uppercase tracking-wide">Project</span>
                              )}
                              {u.permissions.viewPeopleVision && (
                                <span className="bg-emerald-500/10 text-emerald-400 px-1.5 py-0.2 rounded text-[11px] border border-emerald-500/20 font-bold uppercase tracking-wide">People</span>
                              )}
                              {u.permissions.viewQualityVision && (
                                <span className="bg-teal-500/10 text-teal-400 px-1.5 py-0.2 rounded text-[11px] border border-teal-500/20 font-bold uppercase tracking-wide">Quality</span>
                              )}
                              <span className="text-[11px] text-zinc-500">({permissionsCount} ativas)</span>
                            </div>
                          </td>
                          <td className="py-4.5 px-2 text-right">
                            <div className="flex items-center justify-end gap-2.5">
                              <button
                                onClick={() => handleEditClick(u)}
                                className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-all cursor-pointer"
                                title="Editar usuário e permissões"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(u.id, u.name)}
                                disabled={u.role === 'Desenvolvedor' || u.id === 'usr-dev'}
                                className={`p-2 rounded-xl transition-all ${
                                  u.role === 'Desenvolvedor' || u.id === 'usr-dev'
                                    ? 'text-zinc-700 cursor-not-allowed'
                                    : 'text-zinc-500 hover:text-red-400 hover:bg-red-500/5 cursor-pointer'
                                }`}
                                title="Excluir usuário"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Coluna 3: Formulário de Cadastro / Edição */}
        <section className="space-y-4">
          <div className="bg-[#121214]/60 border border-[#1e1e22] rounded-xl p-5 space-y-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <UserPlus size={16} />
              {editingUserId ? 'Editar Usuário' : 'Novo Usuário'}
            </h3>

            {error && (
              <div className="p-3 bg-red-500/5 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold flex items-start gap-2.5">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <p className="leading-relaxed">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs" autoComplete="off">
              <input type="text" name="username" autoComplete="username" className="hidden" tabIndex={-1} aria-hidden="true" />
              <input type="password" name="password" autoComplete="current-password" className="hidden" tabIndex={-1} aria-hidden="true" />
              
              {/* Campo Nome */}
              <div className="space-y-1.5">
                <label className="text-zinc-400 font-bold block">Nome completo</label>
                <input
                  type="text"
                  name="new-user-name"
                  autoComplete="off"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do usuário"
                  className="w-full bg-[#1b1b1f] border border-[#2e2e34] rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 transition-all duration-200"
                />
              </div>

              {/* Campo E-mail */}
              <div className="space-y-1.5">
                <label className="text-zinc-400 font-bold block">E-mail corporativo</label>
                <input
                  type="email"
                  name="new-user-email"
                  autoComplete="off"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@longview.com.br"
                  className="w-full bg-[#1b1b1f] border border-[#2e2e34] rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 transition-all duration-200"
                />
              </div>

              {/* Campo Senha */}
              <div className="space-y-1.5">
                <label className="text-zinc-400 font-bold block">
                  Senha {editingUserId && <span className="text-[11px] text-zinc-500 font-normal">(deixe em branco se não quiser alterar)</span>}
                </label>
                <PasswordInput
                  name="new-user-password"
                  autoComplete="new-password"
                  required={!editingUserId}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editingUserId ? '••••••••' : 'Defina a senha'}
                  inputClassName="w-full bg-[#1b1b1f] border border-[#2e2e34] rounded-xl px-4 py-2.5 pr-10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 transition-all duration-200"
                />
              </div>

              {/* Perfil Base */}
              <div className="space-y-1.5">
                <label className="text-zinc-400 font-bold block">Perfil Base</label>
                <select
                  value={role}
                  onChange={(e) => handleRoleChange(e.target.value as 'Desenvolvedor' | 'Diretoria' | 'Operador' | 'Gestor' | 'Parceiro' | 'Corretor' | 'Visualizador')}
                  className="w-full bg-[#1b1b1f] border border-[#2e2e34] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-zinc-400 transition-all duration-200 cursor-pointer"
                >
                  <option value="Desenvolvedor">Desenvolvedor (Acesso Total)</option>
                  <option value="Diretoria">Diretoria</option>
                  <option value="Operador">Operador (Criar/Excluir Project Vision)</option>
                  <option value="Gestor">Gestor</option>
                  <option value="Parceiro">Parceiro</option>
                  <option value="Corretor">Corretor</option>
                  <option value="Visualizador">Visualizador (Somente Leitura)</option>
                </select>
              </div>

              {/* Matriz de Permissões (Checkboxes) */}
              <div className="space-y-2.5 pt-2 border-t border-[#1e1e22]">
                <label className="text-zinc-300 font-extrabold uppercase tracking-wide block">Configuração de Permissões</label>
                
                {/* Marketing Vision */}
                <div className="space-y-2">
                  <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider block">Marketing Vision</span>
                  <div className="space-y-1.5 pl-1">
                    <label className="flex items-center gap-2 text-zinc-400 hover:text-white cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={permissions.viewMarketingDashboard}
                        onChange={() => handleCheckboxChange('viewMarketingDashboard')}
                        className="rounded bg-[#1b1b1f] border-[#2e2e34] text-white focus:ring-0 w-3.5 h-3.5"
                      />
                      <span>Visualizar Dashboard Comercial</span>
                    </label>
                    <label className="flex items-center gap-2 text-zinc-400 hover:text-white cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={permissions.viewMarketingLeads}
                        onChange={() => handleCheckboxChange('viewMarketingLeads')}
                        className="rounded bg-[#1b1b1f] border-[#2e2e34] text-white focus:ring-0 w-3.5 h-3.5"
                      />
                      <span>Visualizar Lista de Leads (CRM)</span>
                    </label>
                    <label className="flex items-center gap-2 text-zinc-400 hover:text-white cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={permissions.viewMarketingOportunidades}
                        onChange={() => handleCheckboxChange('viewMarketingOportunidades')}
                        className="rounded bg-[#1b1b1f] border-[#2e2e34] text-white focus:ring-0 w-3.5 h-3.5"
                      />
                      <span>Visualizar Oportunidades & Perdas</span>
                    </label>
                    <label className="flex items-center gap-2 text-zinc-400 hover:text-white cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={permissions.viewMarketingEstoque}
                        onChange={() => handleCheckboxChange('viewMarketingEstoque')}
                        className="rounded bg-[#1b1b1f] border-[#2e2e34] text-white focus:ring-0 w-3.5 h-3.5"
                      />
                      <span>Visualizar Controle de Estoque</span>
                    </label>
                    <label className="flex items-center gap-2 text-zinc-400 hover:text-white cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={permissions.viewMarketingAds}
                        onChange={() => handleCheckboxChange('viewMarketingAds')}
                        className="rounded bg-[#1b1b1f] border-[#2e2e34] text-white focus:ring-0 w-3.5 h-3.5"
                      />
                      <span>Visualizar Campanhas Meta Ads</span>
                    </label>
                  </div>
                </div>

                {/* Project Vision */}
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider block">Project Vision</span>
                  <div className="space-y-1.5 pl-1">
                    <label className="flex items-center gap-2 text-zinc-400 hover:text-white cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={permissions.viewProjectVision}
                        onChange={() => handleCheckboxChange('viewProjectVision')}
                        className="rounded bg-[#1b1b1f] border-[#2e2e34] text-white focus:ring-0 w-3.5 h-3.5"
                      />
                      <span>Visualizar Painel de Projetos</span>
                    </label>
                    <label className="flex items-center gap-2 text-zinc-400 hover:text-white cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={permissions.manageProjects}
                        onChange={() => handleCheckboxChange('manageProjects')}
                        className="rounded bg-[#1b1b1f] border-[#2e2e34] text-white focus:ring-0 w-3.5 h-3.5"
                      />
                      <span>Criar/Editar Tarefas e Projetos</span>
                    </label>
                    <label className="flex items-center gap-2 text-zinc-400 hover:text-white cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={permissions.manageCommentsDocs}
                        onChange={() => handleCheckboxChange('manageCommentsDocs')}
                        className="rounded bg-[#1b1b1f] border-[#2e2e34] text-white focus:ring-0 w-3.5 h-3.5"
                      />
                      <span>Comentar e Anexar Documentos</span>
                    </label>
                    <label className="flex items-center gap-2 text-zinc-400 hover:text-white cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={permissions.deleteTasks}
                        onChange={() => handleCheckboxChange('deleteTasks')}
                        className="rounded bg-[#1b1b1f] border-[#2e2e34] text-white focus:ring-0 w-3.5 h-3.5"
                      />
                      <span>Excluir Tarefas</span>
                    </label>
                  </div>
                </div>

                {/* People Vision */}
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider block">People Vision</span>
                  <div className="space-y-1.5 pl-1">
                    <label className="flex items-center gap-2 text-zinc-400 hover:text-white cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={permissions.viewPeopleVision}
                        onChange={() => handleCheckboxChange('viewPeopleVision')}
                        className="rounded bg-[#1b1b1f] border-[#2e2e34] text-white focus:ring-0 w-3.5 h-3.5"
                      />
                      <span>Visualizar People Vision</span>
                    </label>
                  </div>
                </div>

                {/* Quality Vision */}
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider block">Quality Vision</span>
                  <div className="space-y-1.5 pl-1">
                    <label className="flex items-center gap-2 text-zinc-400 hover:text-white cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={permissions.viewQualityVision}
                        onChange={() => handleCheckboxChange('viewQualityVision')}
                        className="rounded bg-[#1b1b1f] border-[#2e2e34] text-white focus:ring-0 w-3.5 h-3.5"
                      />
                      <span>Visualizar Quality Vision</span>
                    </label>
                  </div>
                </div>

                {/* Painel Administrativo */}
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider block">Administração Geral</span>
                  <div className="pl-1">
                    <label className="flex items-center gap-2 text-zinc-400 hover:text-white cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={permissions.isAdmin}
                        onChange={() => handleCheckboxChange('isAdmin')}
                        className="rounded bg-[#1b1b1f] border-[#2e2e34] text-white focus:ring-0 w-3.5 h-3.5"
                      />
                      <span className="text-red-400 font-bold">Administrador (Permite cadastrar/gerenciar usuários)</span>
                    </label>
                  </div>
                </div>

              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-4 border-t border-[#1e1e22]">
                {editingUserId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-2.5 px-3 rounded-xl transition-all duration-200 cursor-pointer text-center"
                  >
                    Cancelar
                  </button>
                )}
                
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="flex-1 bg-white hover:bg-zinc-200 text-black font-bold py-2.5 px-3 rounded-xl transition-all duration-200 cursor-pointer text-center flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {submitLoading ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <span>{editingUserId ? 'Salvar Alterações' : 'Cadastrar Usuário'}</span>
                  )}
                </button>
              </div>

            </form>
          </div>
        </section>

      </div>
      </div>
    </main>
  );
}
