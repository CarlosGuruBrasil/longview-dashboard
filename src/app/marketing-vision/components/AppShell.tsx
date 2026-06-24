'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import {
  LayoutDashboard, Users, TrendingUp, Building2, DollarSign,
  Megaphone, Send, UsersRound, Link as LinkIcon, X,
  BarChart2, Target, ChevronRight, RefreshCw,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import type { ActiveView } from '../types';
import Sidebar from './Sidebar';
import DateFilter from './DateFilter';
import NotificationBanner from '@/components/NotificationBanner';

// ── Pull-to-refresh hook (HIG: padrão obrigatório para conteúdo atualizável) ─
function usePullToRefresh(onRefresh: () => Promise<void>) {
  const scrollRef = useRef<HTMLElement>(null);
  const [pullY, setPullY] = useState(0);        // 0-80px
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const THRESHOLD = 64;

  const doRefresh = useCallback(async () => {
    setRefreshing(true);
    setPullY(0);
    try { await onRefresh(); } finally { setRefreshing(false); }
  }, [onRefresh]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      if (el.scrollTop > 2) return;
      startY.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (el.scrollTop > 2) { setPullY(0); return; }
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0) setPullY(Math.min(dy * 0.45, THRESHOLD + 8));
    };
    const onEnd = () => {
      if (pullY >= THRESHOLD) doRefresh();
      else setPullY(0);
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove',  onMove,  { passive: true });
    el.addEventListener('touchend',   onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove',  onMove);
      el.removeEventListener('touchend',   onEnd);
    };
  }, [pullY, doRefresh]);

  return { scrollRef, pullY, refreshing, THRESHOLD };
}

const VIEW_TITLES: Record<ActiveView, string> = {
  dashboard:       'Dashboard',
  leads:           'Leads',
  oportunidades:   'Oportunidades',
  empreendimentos: 'Empreendimentos',
  vendas:          'Vendas',
  metrics:         'Métricas',
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
  const { activeView, setActiveView, refresh } = useData();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const user = useCurrentUser();

  const title = VIEW_TITLES[activeView] ?? 'Dashboard';

  // HIG: pull-to-refresh para conteúdo atualizável
  const { scrollRef, pullY, refreshing, THRESHOLD } = usePullToRefresh(
    useCallback(() => refresh(true), [refresh])
  );

  return (
    <div className="flex bg-[#09090b] overflow-hidden" style={{ height: '100dvh' }}>
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
        <div className="px-4 pb-safe border-t border-white/[0.06] pt-4 space-y-1" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
          <a
            href="/project-vision"
            className="no-tap flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-orange-400 hover:bg-orange-500/10 transition-all"
          >
            <BarChart2 size={15} className="text-orange-400" />
            Project Vision
          </a>
          <a
            href="/rh-vision"
            className="no-tap flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-emerald-400 hover:bg-emerald-500/10 transition-all"
          >
            <UsersRound size={15} className="text-emerald-400" />
            RH Vision
          </a>
          <a
            href="/select-app"
            className="no-tap flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04] transition-all"
          >
            <Target size={16} className="text-zinc-600" />
            Trocar de aplicativo
          </a>
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────────────── */}
      {/* md:pl-[220px] removido: sidebar é static no flex, já ocupa os 220px */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">

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
        <main
          ref={scrollRef as React.RefObject<HTMLElement>}
          className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
        >
          {/* Pull-to-refresh indicator (HIG: aparece ao puxar, gira quando ativo) */}
          <div
            className="md:hidden flex items-center justify-center transition-all duration-150 overflow-hidden"
            style={{
              height: `${pullY}px`,
              opacity: pullY > 16 ? Math.min(pullY / THRESHOLD, 1) : 0,
            }}
          >
            <RefreshCw
              size={20}
              className={`text-zinc-400 transition-transform ${refreshing ? 'animate-spin' : ''}`}
              style={{ transform: `rotate(${(pullY / THRESHOLD) * 360}deg)` }}
            />
          </div>

          {/* Mobile DateFilter — sticky abaixo do header, compacto */}
          <div className="md:hidden sticky top-0 z-20 px-4 pt-2.5 pb-2 bg-[#09090b]/96 backdrop-blur-md border-b border-white/[0.05]">
            <DateFilter />
          </div>
          <div
            className="px-4 pt-3 pb-3 md:px-6 md:py-4 min-w-0"
            style={{ paddingBottom: 'calc(max(env(safe-area-inset-bottom), 16px) + 76px)' }}
          >
            {children}
          </div>
        </main>
      </div>

      {/* ── Banner de permissão de notificação (FCM) ──────────── */}
      <NotificationBanner />

      {/* ── Mobile bottom tab bar ─────────────────────────────── */}
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-30 no-tap"
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
          {PRIMARY_NAV.map(({ icon: Icon, label, view }) => {
            const active = activeView === view;
            return (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                className="no-tap flex-1 flex flex-col items-center justify-center pb-2 gap-1 relative transition-transform active:scale-90"
                style={{ paddingTop: '6px' }}
              >
                {/* Active background capsule */}
                {active && (
                  <span
                    className="absolute inset-x-2"
                    style={{
                      top: '4px', bottom: '18px',
                      borderRadius: '12px',
                      background: 'rgba(14,165,233,0.12)',
                      border: '1px solid rgba(14,165,233,0.18)',
                    }}
                  />
                )}
                {/* HIG: tab bar icons 25pt ≈ 24px; labels Caption 2 = 11px mínimo */}
                <Icon
                  size={active ? 24 : 22}
                  strokeWidth={active ? 2.2 : 1.5}
                  className={`relative z-10 transition-all duration-200 ${active ? 'text-sky-400' : 'text-zinc-600'}`}
                />
                <span className={`relative z-10 text-[11px] leading-none font-semibold transition-all duration-200 ${active ? 'text-sky-400' : 'text-zinc-600'}`}>
                  {label}
                </span>
              </button>
            );
          })}

          {/* Mais */}
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
    </div>
  );
}
