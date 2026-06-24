'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Building2,
  DollarSign,
  BarChart3,
  Megaphone,
  Send,
  UsersRound,
  Link as LinkIcon,
  AppWindow,
  ExternalLink,
  LogIn,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import type { ActiveView } from '../types';

interface NavItem {
  icon: React.ElementType;
  label: string;
  view: ActiveView;
}

const NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard',       view: 'dashboard'      },
  { icon: Users,           label: 'Leads',           view: 'leads'          },
  { icon: TrendingUp,      label: 'Oportunidades',   view: 'oportunidades'  },
  { icon: Building2,       label: 'Empreendimentos', view: 'empreendimentos'},
  { icon: DollarSign,      label: 'Vendas',          view: 'vendas'         },
  { icon: BarChart3,       label: 'Métricas',        view: 'metrics'        },
  { icon: Megaphone,       label: 'Marketing ADS',   view: 'marketing'      },
  { icon: Send,            label: 'Publicar',        view: 'publicar'       },
  { icon: UsersRound,      label: 'Audiências CRM',  view: 'audiences'      },
  { icon: LinkIcon,        label: 'Links & QR',      view: 'links'          },
];

interface CurrentUser {
  name?: string;
  email?: string;
  role?: string;
}

export default function Sidebar() {
  const { activeView, setActiveView } = useData();
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setUser(data); })
      .catch(() => {});
  }, []);

  return (
    <aside className="hidden md:flex flex-col h-screen w-[220px] shrink-0 bg-zinc-900 border-r border-zinc-800 overflow-y-auto">
      {/* Logo */}
      <div className="flex flex-col items-center gap-1 px-4 py-6 border-b border-zinc-800">
        <div className="relative w-[120px] h-[40px]">
          <Image
            src="/logolongview.png"
            alt="Longview"
            fill
            className="object-contain"
            priority
          />
        </div>
        <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: '#0ea5e9' }}>
          MARKETING VISION
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ icon: Icon, label, view }) => {
          const isActive = activeView === view;
          return (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              className={[
                'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left',
                isActive
                  ? 'bg-sky-500/15 text-sky-400'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
              ].join(' ')}
            >
              <Icon
                size={17}
                className={isActive ? 'text-sky-400' : 'text-zinc-500'}
              />
              <span>{label}</span>
              {isActive && (
                <span className="ml-auto w-1 h-4 rounded-full bg-sky-400" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom links */}
      <div className="px-2 pb-3 space-y-1 border-t border-zinc-800 pt-3">
        <Link
          href="/select-app"
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
        >
          <AppWindow size={15} className="text-zinc-500" />
          Painel de Aplicativos
        </Link>
        <Link
          href="/project-vision"
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
        >
          <ExternalLink size={15} className="text-zinc-500" />
          Ir para Project Vision
        </Link>
      </div>

      {/* User chip */}
      <div className="px-3 pb-4">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50">
          <div className="w-7 h-7 rounded-full bg-sky-500/20 border border-sky-500/40 flex items-center justify-center shrink-0">
            <LogIn size={13} className="text-sky-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-zinc-200 truncate leading-tight">
              {user?.name ?? 'Usuário'}
            </p>
            <p className="text-[11px] text-zinc-500 truncate leading-tight">
              {user?.role ?? 'Conectado'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
