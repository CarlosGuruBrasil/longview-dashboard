'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  LayoutDashboard, Users, TrendingUp, Building2, DollarSign,
  Megaphone, Send, UsersRound, Link as LinkIcon, X,
  BarChart2, Target, ChevronRight,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import type { ActiveView } from '../types';
import Sidebar from './Sidebar';
import DateFilter from './DateFilter';

const VIEW_TITLES: Record<ActiveView, string> = {
  dashboard:       'Dashboard',
  leads:           'Leads',
  oportunidades:   'Oportunidades',
  empreendimentos: 'Empreendimentos',
  vendas:          'Vendas',
  marketing:       'Marketing ADS',
  publicar:        'Publicar',
  audiences:       'Audiências CRM',
  links:           'Links & QR',
  score:           'Score',
};

// 5 primary tabs + drawer for rest
const PRIMARY_NAV = [
  { icon: LayoutDashboard, label: 'Dashboard',    view: 'dashboard'     as ActiveView },
  { icon: Users,           label: 'Leads',        view: 'leads'         as ActiveView },
  { icon: TrendingUp,      label: 'Opor.',        view: 'oportunidades' as ActiveView },
  { icon: Megaphone,       label: 'Ads',          view: 'marketing'     as ActiveView },
  { icon: DollarSign,      label: 'Vendas',       view: 'vendas'        as ActiveView },
] as const;

const DRAWER_NAV = [
  { icon: LayoutDashboard, label: 'Dashboard',       view: 'dashboard'       as ActiveView },
  { icon: Users,           label: 'Leads',           view: 'leads'           as ActiveView },
  { icon: TrendingUp,      label: 'Oportunidades',   view: 'oportunidades'   as ActiveView },
  { icon: Building2,       label: 'Empreendimentos', view: 'empreendimentos' as ActiveView },
  { icon: DollarSign,      label: 'Vendas',          view: 'vendas'          as ActiveView },
  { icon: Megaphone,       label: 'Marketing ADS',   view: 'marketing'       as ActiveView },
  { icon: BarChart2,       label: 'Score de Leads',  view: 'score'           as ActiveView },
  { icon: Send,            label: 'Publicar',        view: 'publicar'        as ActiveView },
  { icon: UsersRound,      label: 'Audiências CRM',  view: 'audiences'       as ActiveView },
  { icon: LinkIcon,        label: 'Links & QR',      view: 'links'           as ActiveView },
] as const;

function useCurrentUser() {
  const [user, setUser] = useState<{ name?: string; role?: string } | null>(null);
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => d && setUser(d)).catch(() => {});
  }, []);
  return user;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { activeView, setActiveView } = useData();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const user = useCurrentUser();

  const title = VIEW_TITLES[activeView] ?? 'Dashboard';

  return (
    <div className="app-shell bg-[#09090b]">
      {/* ── Desktop sidebar (unchanged) ─────────────────────── */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* ── Mobile drawer overlay ────────────────────────────── */}
      <div
        className={`md:hidden fixed inset-0 z-50 transition-opacity duration-200 ${drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
        onClick={() => setDrawerOpen(false)}
      />

      {/* ── Mobile drawer panel ──────────────────────────────── */}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-[280px] flex flex-col bg-[#0d0d0f] transition-transform duration-[240ms] ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 pt-safe pb-3 border-b border-white/[0.06]" style={{ paddingTop: 'max(env(safe-area-inset-top), 52px)' }}>
          <div>
            <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-sky-400">Marketing Vision</p>
            {user && <p className="text-xs text-zinc-500 mt-0.5">{user.name}</p>}
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="no-tap w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-zinc-400 active:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>

        {/* Drawer nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {DRAWER_NAV.map(({ icon: Icon, label, view }) => {
            const active = activeView === view;
            return (
              <button
                key={view}
                onClick={() => { setActiveView(view); setDrawerOpen(false); }}
                className={`no-tap w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.98] text-left ${
                  active
                    ? 'bg-sky-500/12 text-sky-400'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]'
                }`}
              >
                <Icon size={18} className={active ? 'text-sky-400' : 'text-zinc-600'} />
                <span className="flex-1">{label}</span>
                {active && <ChevronRight size={14} className="text-sky-500/60" />}
              </button>
            );
          })}
        </nav>

        {/* Drawer footer */}
        <div className="px-4 pb-safe border-t border-white/[0.06] pt-4" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
          <a
            href="/select-app"
            className="no-tap flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04] transition-all"
          >
            <Target size={16} className="text-zinc-600" />
            Trocar de aplicativo
          </a>
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden md:pl-[220px]">

        {/* Mobile top bar */}
        <header
          className="md:hidden shrink-0 flex items-center gap-3 px-4 bg-[#09090b]/95"
          style={{
            paddingTop: 'max(env(safe-area-inset-top), 10px)',
            paddingBottom: '10px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          {/* Logo */}
          <div className="relative w-24 h-7 shrink-0">
            <Image src="/logolongview.png" alt="LongView" fill style={{ objectFit: 'contain', objectPosition: 'left' }} priority />
          </div>

          <div className="flex items-center gap-1 text-zinc-600 shrink-0">
            <ChevronRight size={12} />
          </div>

          <span className="text-sm font-semibold text-zinc-100 flex-1 truncate">{title}</span>

          {/* User avatar — opens drawer */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="no-tap w-8 h-8 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 text-xs font-bold shrink-0 active:scale-95 transition-transform"
          >
            {user?.name?.charAt(0) ?? 'U'}
          </button>
        </header>

        {/* Desktop top bar */}
        <header className="hidden md:flex shrink-0 items-center gap-3 px-6 py-3 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
          <div className="shrink-0">
            <h1 className="text-base font-semibold text-zinc-100">{title}</h1>
            <p className="text-xs text-zinc-500">Análise de clientes e negociações</p>
          </div>
          <div className="ml-auto">
            <DateFilter />
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto overscroll-contain">
          {/* Mobile DateFilter — inside content, compact */}
          <div className="md:hidden px-4 pt-3 pb-1">
            <DateFilter />
          </div>
          <div className="px-4 py-3 md:px-6 md:py-4 pb-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}>
            {children}
          </div>
        </main>
      </div>

      {/* ── Mobile bottom tab bar ─────────────────────────────── */}
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-30 no-tap"
        style={{
          background: 'rgba(9,9,11,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          paddingBottom: 'var(--safe-bottom)',
        }}
      >
        <div className="flex items-stretch h-14">
          {PRIMARY_NAV.map(({ icon: Icon, label, view }) => {
            const active = activeView === view;
            return (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                className="no-tap flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-all active:scale-90"
              >
                {/* Active indicator pill */}
                {active && (
                  <span className="absolute top-1.5 w-5 h-0.5 rounded-full bg-sky-400" />
                )}
                <Icon
                  size={22}
                  strokeWidth={active ? 2.2 : 1.6}
                  className={`transition-all ${active ? 'text-sky-400' : 'text-zinc-500'}`}
                />
                <span className={`text-[10px] font-medium leading-none transition-all ${active ? 'text-sky-400' : 'text-zinc-600'}`}>
                  {label}
                </span>
              </button>
            );
          })}

          {/* "Mais" opens drawer */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="no-tap flex-1 flex flex-col items-center justify-center gap-0.5 active:scale-90 transition-all"
          >
            <div className="w-5 h-5 flex flex-col justify-center gap-[3px]">
              <span className="block h-[2px] w-5 rounded-full bg-zinc-500" />
              <span className="block h-[2px] w-3.5 rounded-full bg-zinc-500" />
              <span className="block h-[2px] w-4 rounded-full bg-zinc-500" />
            </div>
            <span className="text-[10px] font-medium leading-none text-zinc-600 mt-0.5">Mais</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
