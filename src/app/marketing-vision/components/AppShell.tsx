'use client';

import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Building2,
  DollarSign,
  Megaphone,
  Send,
  UsersRound,
  Link as LinkIcon,
  Menu,
  X,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import type { ActiveView } from '../types';
import Sidebar from './Sidebar';
import DateFilter from './DateFilter';

interface CurrentUser {
  name: string;
  role: string;
}

interface AppShellProps {
  children: React.ReactNode;
  currentUser?: CurrentUser;
}

// ── Title mapping ────────────────────────────────────────────────────────────

const VIEW_TITLES: Record<ActiveView, string> = {
  dashboard:      'Dashboard Geral',
  leads:          'Gestão de Leads',
  oportunidades:  'Oportunidades',
  empreendimentos:'Empreendimentos',
  vendas:         'Vendas',
  marketing:      'Marketing ADS',
  publicar:       'Publicar',
  audiences:      'Audiências CRM',
  links:          'Links & QR',
  score:          'Score de Leads',
};

// ── Mobile bottom nav (5 most-used items) ───────────────────────────────────

interface MobileNavItem {
  icon: React.ElementType;
  label: string;
  view: ActiveView;
}

const MOBILE_NAV: MobileNavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', view: 'dashboard'  },
  { icon: Users,           label: 'Leads',     view: 'leads'      },
  { icon: TrendingUp,      label: 'Opor.',     view: 'oportunidades'},
  { icon: Megaphone,       label: 'Ads',       view: 'marketing'  },
  { icon: DollarSign,      label: 'Vendas',    view: 'vendas'     },
];

// ── All nav items for drawer ─────────────────────────────────────────────────

interface DrawerNavItem {
  icon: React.ElementType;
  label: string;
  view: ActiveView;
}

const ALL_NAV: DrawerNavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard',       view: 'dashboard'      },
  { icon: Users,           label: 'Leads',           view: 'leads'          },
  { icon: TrendingUp,      label: 'Oportunidades',   view: 'oportunidades'  },
  { icon: Building2,       label: 'Empreendimentos', view: 'empreendimentos'},
  { icon: DollarSign,      label: 'Vendas',          view: 'vendas'         },
  { icon: Megaphone,       label: 'Marketing ADS',   view: 'marketing'      },
  { icon: Send,            label: 'Publicar',        view: 'publicar'       },
  { icon: UsersRound,      label: 'Audiências CRM',  view: 'audiences'      },
  { icon: LinkIcon,        label: 'Links & QR',      view: 'links'          },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function AppShell({ children }: AppShellProps) {
  const { activeView, setActiveView } = useData();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const title = VIEW_TITLES[activeView] ?? 'Dashboard Geral';

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={[
          'fixed top-0 left-0 z-50 h-full w-64 bg-zinc-900 border-r border-zinc-800',
          'transform transition-transform duration-200 ease-in-out md:hidden',
          drawerOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-800">
          <span className="text-sm font-semibold text-sky-400 tracking-widest uppercase">
            Marketing Vision
          </span>
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="px-2 py-4 space-y-0.5 overflow-y-auto">
          {ALL_NAV.map(({ icon: Icon, label, view }) => {
            const isActive = activeView === view;
            return (
              <button
                key={view}
                onClick={() => { setActiveView(view); setDrawerOpen(false); }}
                className={[
                  'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left',
                  isActive
                    ? 'bg-sky-500/15 text-sky-400'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
                ].join(' ')}
              >
                <Icon size={17} className={isActive ? 'text-sky-400' : 'text-zinc-500'} />
                {label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="shrink-0 flex items-start sm:items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
          {/* Mobile hamburger */}
          <button
            className="md:hidden p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 mt-0.5"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu size={20} />
          </button>

          {/* Page title */}
          <div className="shrink-0">
            <h1 className="text-base font-semibold text-zinc-100 leading-tight">{title}</h1>
            <p className="text-xs text-zinc-500 leading-tight mt-0.5">
              Análise de clientes e negociações
            </p>
          </div>

          {/* Date filter pushed to right */}
          <div className="ml-auto w-full sm:w-auto">
            <DateFilter />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-4 py-4">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-zinc-900 border-t border-zinc-800">
        <div className="flex items-stretch">
          {MOBILE_NAV.map(({ icon: Icon, label, view }) => {
            const isActive = activeView === view;
            return (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                className={[
                  'flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-colors',
                  isActive ? 'text-sky-400' : 'text-zinc-500 hover:text-zinc-300',
                ].join(' ')}
              >
                <Icon size={20} />
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </button>
            );
          })}
          {/* Hamburger slot for remaining nav items */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <Menu size={20} />
            <span className="text-[10px] font-medium leading-none">Mais</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
