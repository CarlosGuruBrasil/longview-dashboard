'use client';

import React from 'react';
import Image from 'next/image';
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Building2,
  DollarSign,
  BarChart3,
  Megaphone,
  Gauge,
  Send,
  UsersRound,
  Link as LinkIcon,
  BrainCircuit,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import type { ActiveView } from '../types';
import SidebarFooter from '@/components/app/SidebarFooter';

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
  { icon: BrainCircuit,    label: 'BI Insights',     view: 'insights'       },
  { icon: BarChart3,       label: 'Métricas',        view: 'metrics'        },
  { icon: Gauge,           label: 'Tráfego',         view: 'trafego'        },
  { icon: Megaphone,       label: 'Marketing ADS',   view: 'marketing'      },
  { icon: Send,            label: 'Publicar',        view: 'publicar'       },
  { icon: UsersRound,      label: 'Audiências CRM',  view: 'audiences'      },
  { icon: LinkIcon,        label: 'Links & QR',      view: 'links'          },
];

export default function Sidebar() {
  const { activeView, setActiveView } = useData();

  return (
    <aside className="hidden lg:flex flex-col h-screen w-[220px] shrink-0 bg-zinc-900 border-r border-zinc-800 overflow-y-auto">
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
        <span className="text-[11px] font-semibold tracking-widest uppercase text-orange-400">
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
                  ? 'bg-orange-500/15 text-orange-400'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
              ].join(' ')}
            >
              <Icon
                size={17}
                className={isActive ? 'text-orange-400' : 'text-zinc-500'}
              />
              <span>{label}</span>
              {isActive && (
                <span className="ml-auto w-1 h-4 rounded-full bg-orange-400" />
              )}
            </button>
          );
        })}
      </nav>

      <SidebarFooter currentModule="marketing" />
    </aside>
  );
}
