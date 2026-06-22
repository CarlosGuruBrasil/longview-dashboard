'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import {
  LayoutDashboard,
  Building2,
  ListTodo,
  Kanban,
  CalendarRange,
  Users,
  FolderArchive,
  BarChart3,
  ArrowRightLeft,
  Grid3X3,
  LogOut,
  Settings,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { useUser } from '@/context/UserContext';

const ALL_ITEMS = [
  { name: 'Dashboard',       href: '/project-vision',               icon: LayoutDashboard },
  { name: 'Empreendimentos', href: '/project-vision/projects',      icon: Building2 },
  { name: 'Tarefas',         href: '/project-vision/tasks',         icon: ListTodo },
  { name: 'Kanban',          href: '/project-vision/kanban',        icon: Kanban },
  { name: 'Timeline',        href: '/project-vision/timeline',      icon: CalendarRange },
  { name: 'Responsáveis',    href: '/project-vision/responsibles',  icon: Users },
  { name: 'Documentos',      href: '/project-vision/documents',     icon: FolderArchive },
  { name: 'Relatórios',      href: '/project-vision/reports',       icon: BarChart3 },
];

// Bottom nav: 4 mais usados + Menu
const BOTTOM_NAV = [
  { name: 'Dashboard', href: '/project-vision',          icon: LayoutDashboard },
  { name: 'Tarefas',   href: '/project-vision/tasks',    icon: ListTodo },
  { name: 'Kanban',    href: '/project-vision/kanban',   icon: Kanban },
  { name: 'Projetos',  href: '/project-vision/projects', icon: Building2 },
];

function getRoleColor(role: string) {
  switch (role) {
    case 'Desenvolvedor': return 'bg-purple-500/10 text-purple-400 border border-purple-500/30';
    case 'Diretoria':     return 'bg-red-500/10 text-red-400 border border-red-500/30';
    case 'Gestor':        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
    case 'Parceiro':      return 'bg-amber-500/10 text-amber-400 border border-amber-500/30';
    case 'Corretor':      return 'bg-blue-500/10 text-blue-400 border border-blue-500/30';
    default:              return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/30';
  }
}

function pageTitle(pathname: string): string {
  const map: Record<string, string> = {
    '/project-vision':              'Dashboard',
    '/project-vision/projects':     'Empreendimentos',
    '/project-vision/tasks':        'Tarefas',
    '/project-vision/kanban':       'Kanban',
    '/project-vision/timeline':     'Timeline',
    '/project-vision/responsibles': 'Responsáveis',
    '/project-vision/documents':    'Documentos',
    '/project-vision/reports':      'Relatórios',
    '/admin/users':                 'Usuários',
  };
  for (const [key, val] of Object.entries(map)) {
    if (pathname === key || (key !== '/project-vision' && pathname.startsWith(key))) return val;
  }
  return 'Project Vision';
}

export default function Sidebar() {
  const pathname = usePathname();
  const { currentUser } = useUser();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isAdmin = currentUser?.role === 'Desenvolvedor' || currentUser?.permissions?.isAdmin === true;
  const items = isAdmin
    ? [...ALL_ITEMS, { name: 'Gerenciar Usuários', href: '/admin/users', icon: Settings }]
    : ALL_ITEMS;

  const title = pageTitle(pathname);

  return (
    <>
      {/* ── Desktop sidebar ───────────────────────────────────────────── */}
      <aside className="fixed top-0 bottom-0 left-0 z-40 w-64 bg-[#09090B] border-r border-[#1C1C1E] flex-col justify-between hidden lg:flex">
        <div>
          <div className="pt-8 pb-6 flex flex-col items-center justify-center border-b border-[#1C1C1E]/50">
            <div className="relative w-44 h-14">
              <Image src="/logolongview.png" alt="LONGVIEW" fill style={{ objectFit: 'contain' }} priority />
            </div>
            <span className="text-[9px] uppercase font-bold tracking-widest text-orange-400/80 mt-1">
              Project Vision
            </span>
          </div>

          <nav className="p-4 space-y-1.5">
            {items.map(({ name, href, icon: Icon }) => {
              const active = pathname === href || (href !== '/project-vision' && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200 group
                    ${active
                      ? 'bg-white/5 text-white font-medium border border-white/10'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.02] border border-transparent'}`}
                >
                  <Icon size={18} className={`transition-transform group-hover:scale-105 ${active ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'}`} />
                  {name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-[#1C1C1E] space-y-3">
          <div className="space-y-1.5">
            <Link href="/select-app" className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-300 hover:text-white transition-all">
              <Grid3X3 size={14} />
              <span>Painel de Aplicativos</span>
            </Link>
            <Link href="/marketing-vision" className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 transition-all">
              <ArrowRightLeft size={14} />
              <span>Ir para Marketing Vision</span>
            </Link>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#121214] border border-[#1E1E22]">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 text-white font-medium text-xs shrink-0">
                {currentUser?.name?.charAt(0) || 'U'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs text-white font-medium truncate">{currentUser?.name || 'Usuário'}</p>
                <span className={`inline-block mt-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${getRoleColor(currentUser?.role || '')}`}>
                  {currentUser?.role || 'Acesso'}
                </span>
              </div>
            </div>
            <a href="/api/auth/logout" className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-all" title="Logout">
              <LogOut size={14} />
            </a>
          </div>
        </div>
      </aside>

      {/* ── Mobile: top header ────────────────────────────────────────── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 h-14 bg-[#09090B]/95 backdrop-blur-sm border-b border-[#1C1C1E]">
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
          aria-label="Abrir menu"
        >
          <Menu size={20} />
        </button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative w-24 h-7 shrink-0">
            <Image src="/logolongview.png" alt="LONGVIEW" fill style={{ objectFit: 'contain', objectPosition: 'left' }} />
          </div>
          <ChevronRight size={12} className="text-zinc-600 shrink-0" />
          <span className="text-sm font-semibold text-zinc-100 truncate">{title}</span>
        </div>

        <a href="/api/auth/logout" className="p-2 text-zinc-500 hover:text-red-400 rounded-lg transition-all shrink-0" title="Logout">
          <LogOut size={16} />
        </a>
      </header>

      {/* ── Mobile: drawer overlay ────────────────────────────────────── */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Mobile: drawer ───────────────────────────────────────────── */}
      <aside className={`lg:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-[#09090B] border-r border-[#1C1C1E] flex flex-col transform transition-transform duration-250 ease-in-out ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-4 h-14 border-b border-[#1C1C1E]">
          <span className="text-xs font-bold tracking-widest text-orange-400/80 uppercase">Project Vision</span>
          <button onClick={() => setDrawerOpen(false)} className="p-2 text-zinc-400 hover:text-white rounded-lg transition-all">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {items.map(({ name, href, icon: Icon }) => {
            const active = pathname === href || (href !== '/project-vision' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setDrawerOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                  ${active
                    ? 'bg-white/8 text-white border border-white/10'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'}`}
              >
                <Icon size={18} className={active ? 'text-white' : 'text-zinc-500'} />
                {name}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[#1C1C1E] space-y-2">
          <Link href="/select-app" onClick={() => setDrawerOpen(false)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-zinc-300 hover:text-white transition-all">
            <Grid3X3 size={14} />
            Painel de Aplicativos
          </Link>
          <Link href="/marketing-vision" onClick={() => setDrawerOpen(false)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-500/10 border border-blue-500/20 text-blue-400 transition-all">
            <ArrowRightLeft size={14} />
            Marketing Vision
          </Link>

          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#121214] border border-[#1E1E22]">
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 text-white font-medium text-xs shrink-0">
              {currentUser?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs text-white font-medium truncate">{currentUser?.name || 'Usuário'}</p>
              <span className={`inline-block mt-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${getRoleColor(currentUser?.role || '')}`}>
                {currentUser?.role || 'Acesso'}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Mobile: bottom nav ───────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#09090B]/95 backdrop-blur-sm border-t border-[#1C1C1E] flex items-stretch safe-area-pb">
        {BOTTOM_NAV.map(({ name, href, icon: Icon }) => {
          const active = pathname === href || (href !== '/project-vision' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors ${active ? 'text-orange-400' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium leading-none">{name}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <Menu size={20} />
          <span className="text-[10px] font-medium leading-none">Mais</span>
        </button>
      </nav>
    </>
  );
}
