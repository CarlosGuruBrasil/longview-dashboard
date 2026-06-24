'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import {
  LayoutDashboard, Users, UserPlus, Bell, Settings,
  ArrowRightLeft, Grid3X3, LogOut, X, ChevronRight,
} from 'lucide-react';
import { useUser } from '@/context/UserContext';

const ALL_ITEMS = [
  { name: 'Dashboard',      href: '/rh-vision',                  icon: LayoutDashboard },
  { name: 'Colaboradores',  href: '/rh-vision/colaboradores',    icon: Users },
  { name: 'Cadastro',       href: '/rh-vision/cadastro',         icon: UserPlus },
  { name: 'Notificações',   href: '/rh-vision/notificacoes',     icon: Bell },
];

const BOTTOM_NAV = [
  { name: 'Dashboard',     href: '/rh-vision',               icon: LayoutDashboard },
  { name: 'Colaboradores', href: '/rh-vision/colaboradores', icon: Users },
  { name: 'Cadastro',      href: '/rh-vision/cadastro',      icon: UserPlus },
  { name: 'Notificações',  href: '/rh-vision/notificacoes',  icon: Bell },
];

function getRoleColor(role: string) {
  switch (role) {
    case 'Desenvolvedor': return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
    case 'Diretoria':     return 'bg-red-500/10 text-red-400 border border-red-500/20';
    case 'Gestor':        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    default:              return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20';
  }
}

function pageTitle(pathname: string): string {
  const map: Record<string, string> = {
    '/rh-vision':                  'Dashboard',
    '/rh-vision/colaboradores':    'Colaboradores',
    '/rh-vision/cadastro':         'Cadastro',
    '/rh-vision/notificacoes':     'Notificações',
  };
  for (const [key, val] of Object.entries(map)) {
    if (pathname === key || (key !== '/rh-vision' && pathname.startsWith(key))) return val;
  }
  return 'RH Vision';
}

function isActive(href: string, pathname: string) {
  return pathname === href || (href !== '/rh-vision' && pathname.startsWith(href));
}

export default function RHSidebar() {
  const pathname          = usePathname();
  const { currentUser }   = useUser();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isAdmin = currentUser?.role === 'Desenvolvedor' || currentUser?.permissions?.isAdmin === true;
  const items   = isAdmin
    ? [...ALL_ITEMS, { name: 'Configurações', href: '/admin/users', icon: Settings }]
    : ALL_ITEMS;
  const title = pageTitle(pathname);

  return (
    <>
      {/* ══ DESKTOP SIDEBAR ══════════════════════════════════════════════ */}
      <aside className="fixed top-0 bottom-0 left-0 z-40 w-64 bg-[#09090b] border-r border-white/[0.06] flex-col justify-between hidden lg:flex">
        <div>
          <div className="pt-8 pb-5 flex flex-col items-center border-b border-white/[0.06]">
            <div className="relative w-40 h-12">
              <Image src="/logolongview.png" alt="LongView" fill style={{ objectFit: 'contain' }} priority />
            </div>
            <span className="text-[9px] uppercase font-bold tracking-[0.2em] text-emerald-400/70 mt-1.5">
              RH Vision
            </span>
          </div>

          <nav className="p-3 space-y-0.5">
            {items.map(({ name, href, icon: Icon }) => {
              const active = isActive(href, pathname);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all duration-150 group ${
                    active
                      ? 'bg-white/[0.06] text-white font-medium'
                      : 'text-zinc-500 hover:text-zinc-100 hover:bg-white/[0.03]'
                  }`}
                >
                  <Icon size={17} className={active ? 'text-emerald-400' : 'text-zinc-600 group-hover:text-zinc-400'} />
                  {name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-3 border-t border-white/[0.06] space-y-2">
          <Link href="/select-app" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 hover:text-white transition-all">
            <Grid3X3 size={14} className="text-zinc-600" />
            Painel de Aplicativos
          </Link>
          <Link href="/project-vision" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium bg-orange-500/8 hover:bg-orange-500/14 text-orange-400 transition-all">
            <ArrowRightLeft size={14} />
            Project Vision
          </Link>

          {/* User card */}
          <Link href="/rh-vision/colaboradores/me" className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors group">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-emerald-800/40 border border-emerald-700/30 flex items-center justify-center text-xs font-bold text-emerald-300 shrink-0">
                {currentUser?.name?.charAt(0) ?? 'U'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs text-white font-medium truncate leading-tight">{currentUser?.name ?? 'Usuário'}</p>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${getRoleColor(currentUser?.role ?? '')}`}>
                  {currentUser?.role ?? '—'}
                </span>
              </div>
            </div>
            <a href="/api/auth/logout" onClick={e => e.stopPropagation()} className="p-1.5 text-zinc-600 hover:text-red-400 rounded-lg transition-colors" title="Logout">
              <LogOut size={14} />
            </a>
          </Link>
        </div>
      </aside>

      {/* ══ MOBILE TOP BAR ═══════════════════════════════════════════════ */}
      <header
        className="lg:hidden fixed inset-x-0 top-0 z-40 flex items-center gap-3 px-4 bg-[#09090b]/95"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 10px)',
          paddingBottom: '10px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <div className="relative w-24 h-7 shrink-0">
          <Image src="/logolongview.png" alt="LongView" fill style={{ objectFit: 'contain', objectPosition: 'left' }} priority />
        </div>
        <ChevronRight size={12} className="text-zinc-700 shrink-0" />
        <span className="text-sm font-semibold text-zinc-100 flex-1 truncate">{title}</span>
        <button
          onClick={() => setDrawerOpen(true)}
          className="no-tap w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xs font-bold shrink-0 active:scale-95 transition-transform"
        >
          {currentUser?.name?.charAt(0) ?? 'U'}
        </button>
      </header>

      {/* ══ MOBILE DRAWER OVERLAY ════════════════════════════════════════ */}
      <div
        className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-200 ${drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
        onClick={() => setDrawerOpen(false)}
      />

      {/* ══ MOBILE DRAWER PANEL ══════════════════════════════════════════ */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-[280px] flex flex-col bg-[#0d0d0f] transition-transform duration-[240ms] ease-[cubic-bezier(0.32,0,0.67,0)] ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div
          className="flex items-center justify-between px-5 border-b border-white/[0.06]"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 52px)', paddingBottom: '16px' }}
        >
          <div>
            <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-emerald-400">RH Vision</p>
            <p className="text-xs text-zinc-500 mt-0.5">{currentUser?.name ?? 'Usuário'}</p>
          </div>
          <button onClick={() => setDrawerOpen(false)} className="no-tap w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-zinc-400 active:bg-white/10">
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {items.map(({ name, href, icon: Icon }) => {
            const active = isActive(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setDrawerOpen(false)}
                className={`no-tap flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.98] ${
                  active ? 'bg-emerald-500/10 text-emerald-300' : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]'
                }`}
              >
                <Icon size={18} className={active ? 'text-emerald-400' : 'text-zinc-600'} />
                <span className="flex-1">{name}</span>
                {active && <ChevronRight size={14} className="text-emerald-500/50" />}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 border-t border-white/[0.06] pt-4 space-y-2" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${getRoleColor(currentUser?.role ?? '')}`}>
            {currentUser?.role ?? '—'}
          </div>
          <div className="flex gap-2">
            <Link href="/select-app" onClick={() => setDrawerOpen(false)} className="no-tap flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium bg-white/[0.04] text-zinc-400 active:bg-white/[0.08] transition-all">
              <Grid3X3 size={13} />
              Apps
            </Link>
            <Link href="/project-vision" onClick={() => setDrawerOpen(false)} className="no-tap flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium bg-orange-500/8 text-orange-400 active:bg-orange-500/15 transition-all">
              <ArrowRightLeft size={13} />
              Projects
            </Link>
            <a href="/api/auth/logout" className="no-tap w-10 flex items-center justify-center rounded-xl bg-white/[0.04] text-zinc-500 hover:text-red-400 active:bg-red-500/10 transition-all">
              <LogOut size={15} />
            </a>
          </div>
        </div>
      </aside>

      {/* ══ MOBILE BOTTOM TAB BAR ════════════════════════════════════════ */}
      <nav
        className="lg:hidden fixed inset-x-0 bottom-0 z-30 no-tap"
        style={{
          background: 'rgba(8,8,10,0.97)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 -12px 40px rgba(0,0,0,0.5)',
          paddingBottom: 'var(--safe-bottom)',
        }}
      >
        <div className="flex items-end h-[60px] px-1">
          {BOTTOM_NAV.map(({ name, href, icon: Icon }) => {
            const active = isActive(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                className="no-tap flex-1 flex flex-col items-center justify-center pb-2 gap-1 relative active:scale-90 transition-transform"
                style={{ paddingTop: '6px' }}
              >
                {active && (
                  <span
                    className="absolute inset-x-2"
                    style={{
                      top: '4px', bottom: '18px',
                      borderRadius: '12px',
                      background: 'rgba(52,211,153,0.12)',
                      border: '1px solid rgba(52,211,153,0.18)',
                    }}
                  />
                )}
                <Icon size={active ? 24 : 22} strokeWidth={active ? 2.2 : 1.5} className={`relative z-10 transition-all duration-200 ${active ? 'text-emerald-400' : 'text-zinc-600'}`} />
                <span className={`relative z-10 text-[11px] leading-none font-semibold transition-all duration-200 ${active ? 'text-emerald-400' : 'text-zinc-600'}`}>
                  {name}
                </span>
              </Link>
            );
          })}

          <button
            onClick={() => setDrawerOpen(true)}
            className="no-tap flex-1 flex flex-col items-center justify-center pb-2 gap-1 active:scale-90 transition-transform"
            style={{ paddingTop: '6px' }}
          >
            <div className="relative z-10 flex flex-col items-center gap-[3.5px]">
              <span className="block h-[1.5px] w-[18px] rounded-full bg-zinc-600" />
              <span className="block h-[1.5px] w-[13px] rounded-full bg-zinc-600" />
              <span className="block h-[1.5px] w-[15px] rounded-full bg-zinc-600" />
            </div>
            <span className="text-[11px] leading-none font-semibold text-zinc-600">Mais</span>
          </button>
        </div>
      </nav>
    </>
  );
}
