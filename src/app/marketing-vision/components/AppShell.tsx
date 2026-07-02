'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import {
  LayoutDashboard, Users, DollarSign, BarChart3, Megaphone, X,
  ChevronRight, RefreshCw,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import type { ActiveView } from '../types';
import Sidebar from './Sidebar';
import DateFilter from './DateFilter';
import FilterBar from './ui/FilterBar';
import NotificationBanner from '@/components/NotificationBanner';
import AppHeader from '@/components/app/AppHeader';
import SidebarFooter from '@/components/app/SidebarFooter';
import PWAInstallBanner from '@/components/app/PWAInstallBanner';

function usePullToRefresh(onRefresh: () => Promise<void>) {
  const scrollRef = useRef<HTMLElement>(null);
  const [pullY, setPullY] = useState(0);
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
  dashboard:       'Smart Dashboard',
  leads:           'Leads & Pipeline',
  oportunidades:   'Oportunidades',
  empreendimentos: 'Empreendimentos',
  vendas:          'Vendas & Projetos',
  insights:        'BI Insights',
  metrics:         'Métricas',
  trafego:         'Tráfego',
  marketing:       'Marketing',
  publicar:        'Publicar',
  audiences:       'Audiências CRM',
  links:           'Links & QR',
  score:           'Score',
};

const PRIMARY_NAV = [
  { icon: LayoutDashboard, label: 'Dashboard', view: 'dashboard' as ActiveView },
  { icon: Users,           label: 'Leads',     view: 'leads'     as ActiveView },
  { icon: DollarSign,      label: 'Vendas',    view: 'vendas'    as ActiveView },
  { icon: BarChart3,       label: 'Métricas',  view: 'metrics'   as ActiveView },
  { icon: Megaphone,       label: 'Marketing', view: 'marketing' as ActiveView },
] as const;

const DRAWER_NAV = [
  { icon: LayoutDashboard, label: 'Smart Dashboard',  view: 'dashboard' as ActiveView },
  { icon: Users,           label: 'Leads & Pipeline',  view: 'leads'     as ActiveView },
  { icon: DollarSign,      label: 'Vendas & Projetos', view: 'vendas'    as ActiveView },
  { icon: BarChart3,       label: 'Métricas',         view: 'metrics'   as ActiveView },
  { icon: Megaphone,       label: 'Marketing',        view: 'marketing' as ActiveView },
] as const;

function useCurrentUser() {
  const [user, setUser] = useState<{ name?: string; role?: string } | null>(null);
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => d && setUser(d)).catch(() => {});
  }, []);
  return user;
}

function MarketingHeaderMetrics() {
  const { filteredLeads, crmTotal } = useData();

  return (
    <div className="flex items-center gap-2 rounded-xl border border-orange-400/15 bg-orange-500/[0.055] px-4 py-2 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl">
      <span className="font-bold text-zinc-100">{filteredLeads.length.toLocaleString('pt-BR')}</span>
      <span className="text-zinc-400">leads</span>
      <span className="text-zinc-600">·</span>
      <span className="text-zinc-400">de</span>
      <span className="font-semibold text-zinc-200">{crmTotal.toLocaleString('pt-BR')}</span>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { activeView, setActiveView, refresh, dataError, loading } = useData();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const user = useCurrentUser();

  const title = VIEW_TITLES[activeView] ?? 'Dashboard';

  const { scrollRef, pullY, refreshing, THRESHOLD } = usePullToRefresh(
    useCallback(() => refresh(true), [refresh])
  );

  return (
    <div className="flex bg-[#09090b] overflow-hidden" style={{ height: '100dvh' }}>

      {dataError && !loading && (
        <div className="fixed top-0 inset-x-0 z-[100] bg-red-900/90 border-b border-red-700/50 px-4 py-2 flex items-center justify-between text-xs text-red-100 backdrop-blur-sm">
          <span>⚠️ Erro ao carregar dados: {dataError}</span>
          <button onClick={() => refresh(true)} className="ml-3 px-2 py-0.5 rounded bg-red-700/60 hover:bg-red-600/60 text-white text-[11px] font-semibold">
            Tentar novamente
          </button>
        </div>
      )}

      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <div
        className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-200 ${drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
        onClick={() => setDrawerOpen(false)}
      />

      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-[280px] flex flex-col bg-[#0d0d0f] transition-transform duration-[240ms] ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center justify-between px-5 pt-safe pb-3 border-b border-white/[0.06]" style={{ paddingTop: 'max(env(safe-area-inset-top), 52px)' }}>
          <div>
            <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-orange-400">Marketing Vision</p>
            {user && <p className="text-xs text-zinc-500 mt-0.5">{user.name}</p>}
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="no-tap w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-zinc-400 active:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {DRAWER_NAV.map(({ icon: Icon, label, view }) => {
            const active = activeView === view;
            return (
              <button
                key={view}
                onClick={() => { setActiveView(view); setDrawerOpen(false); }}
                className={`no-tap w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.98] text-left ${
                  active
                    ? 'bg-orange-500/12 text-orange-400'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]'
                }`}
              >
                <Icon size={18} className={active ? 'text-orange-400' : 'text-zinc-600'} />
                <span className="flex-1">{label}</span>
                {active && <ChevronRight size={14} className="text-orange-500/60" />}
              </button>
            );
          })}
        </nav>

        <div className="px-4 pb-safe border-t border-white/[0.06] pt-4" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
          <SidebarFooter currentModule="marketing" mobile onNavigate={() => setDrawerOpen(false)} />
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <header
          className="lg:hidden shrink-0 flex items-center gap-3 px-4 bg-[#09090b]/95"
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

          <div className="flex items-center gap-1 text-zinc-600 shrink-0">
            <ChevronRight size={12} />
          </div>

          <span className="text-sm font-semibold text-zinc-100 flex-1 truncate">{title}</span>

          <button
            onClick={() => setDrawerOpen(true)}
            className="no-tap w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 text-xs font-bold shrink-0 active:scale-95 transition-transform"
          >
            {user?.name?.charAt(0) ?? 'U'}
          </button>
        </header>

        <AppHeader
          module="marketing"
          fallbackTitle={title}
          accent="orange"
          centerContent={<MarketingHeaderMetrics />}
          actions={
            <div className="flex items-center gap-2">
              <FilterBar />
              <DateFilter />
            </div>
          }
        />

        <main
          ref={scrollRef as React.RefObject<HTMLElement>}
          className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
        >
          <div
            className="lg:hidden flex items-center justify-center transition-all duration-150 overflow-hidden"
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

          <div className="lg:hidden sticky top-0 z-20 px-4 pt-2.5 pb-2 bg-[#09090b]/96 backdrop-blur-md border-b border-white/[0.05] space-y-2">
            <DateFilter />
            <FilterBar />
          </div>
          <div
            className="px-4 pt-3 pb-3 lg:px-6 lg:py-4 min-w-0"
            style={{ paddingBottom: 'calc(max(env(safe-area-inset-bottom), 16px) + 76px)' }}
          >
            {children}
          </div>
        </main>
      </div>

      <NotificationBanner />
      <PWAInstallBanner />

      <nav
        className="lg:hidden fixed inset-x-0 bottom-0 z-30 no-tap"
        style={{
          background: 'rgba(8,8,10,0.97)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 -12px 40px rgba(0,0,0,0.5)',
          paddingBottom: 'max(var(--safe-bottom), 8px)',
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
                <Icon
                  size={active ? 24 : 22}
                  strokeWidth={active ? 2.2 : 1.5}
                  className={`relative z-10 transition-all duration-200 ${active ? 'text-orange-400' : 'text-zinc-600'}`}
                />
                <span className={`relative z-10 text-[11px] leading-none font-semibold transition-all duration-200 ${active ? 'text-orange-400' : 'text-zinc-600'}`}>
                  {label}
                </span>
              </button>
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
    </div>
  );
}
