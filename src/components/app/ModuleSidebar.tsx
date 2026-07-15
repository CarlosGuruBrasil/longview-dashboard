'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, X, type LucideIcon } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import SidebarFooter from './SidebarFooter';
import PWAInstallBanner from './PWAInstallBanner';
import type { ModuleKey } from './moduleNavigation';

type Accent = 'blue' | 'emerald' | 'violet' | 'teal';

export interface SidebarItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

interface ModuleSidebarProps {
  module: ModuleKey;
  moduleLabel: string;
  accent: Accent;
  items: SidebarItem[];
  bottomItems: SidebarItem[];
  rootHref: string;
  titleMap: Record<string, string>;
}

const ACCENT: Record<Accent, { text: string; bg: string; border: string; avatar: string }> = {
  blue: {
    text: 'text-blue-400',
    bg: 'bg-blue-500/15',
    border: 'border-blue-500/30',
    avatar: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
  },
  emerald: {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/30',
    avatar: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
  },
  teal: {
    text: 'text-teal-400',
    bg: 'bg-teal-500/15',
    border: 'border-teal-500/30',
    avatar: 'bg-teal-500/20 border-teal-500/30 text-teal-400',
  },
  violet: {
    text: 'text-violet-400',
    bg: 'bg-violet-500/15',
    border: 'border-violet-500/30',
    avatar: 'bg-violet-500/20 border-violet-500/30 text-violet-400',
  },
};

function isActive(href: string, pathname: string, rootHref: string) {
  return pathname === href || (href !== rootHref && pathname.startsWith(href));
}

function pageTitle(pathname: string, titleMap: Record<string, string>, fallback: string) {
  for (const [href, title] of Object.entries(titleMap)) {
    if (pathname === href || (href !== '/' && pathname.startsWith(href))) return title;
  }
  return fallback;
}

export default function ModuleSidebar({
  module,
  moduleLabel,
  accent,
  items,
  bottomItems,
  rootHref,
  titleMap,
}: ModuleSidebarProps) {
  const pathname = usePathname();
  const { currentUser } = useUser();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const tone = ACCENT[accent];
  const title = pageTitle(pathname, titleMap, moduleLabel);

  const renderLink = (item: SidebarItem, mobile = false) => {
    const active = isActive(item.href, pathname, rootHref);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={mobile ? () => setDrawerOpen(false) : undefined}
        className={[
          mobile
            ? 'no-tap flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.98]'
            : 'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left',
          active
            ? `${tone.bg} ${tone.text}`
            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
        ].join(' ')}
      >
        <Icon size={mobile ? 18 : 17} className={active ? tone.text : 'text-zinc-500'} />
        <span className="flex-1">{item.name}</span>
        {active && (mobile ? <ChevronRight size={14} className={tone.text} /> : <span className={`ml-auto h-4 w-1 rounded-full ${tone.bg} ${tone.border} border`} />)}
      </Link>
    );
  };

  return (
    <>
      <aside className="fixed bottom-0 left-0 top-0 z-40 hidden w-[220px] shrink-0 flex-col overflow-y-auto border-r border-zinc-800 bg-zinc-900 lg:flex">
        <div className="flex flex-col items-center gap-1 border-b border-zinc-800 px-4 py-6">
          <div className="relative h-[40px] w-[120px]">
            <Image src="/logolongview.png" alt="LongView" fill className="object-contain" priority sizes="120px" />
          </div>
          <span className={`text-[11px] font-semibold tracking-widest uppercase ${tone.text}`}>
            {moduleLabel}
          </span>
        </div>

        <nav className="flex-1 space-y-0.5 px-2 py-4">
          {items.map(item => renderLink(item))}
        </nav>

        <SidebarFooter currentModule={module} />
      </aside>

      <header className="lg:hidden fixed inset-x-0 top-0 z-40 flex items-center gap-3 px-4 bg-[#09090b]/95 border-b border-white/[0.06] backdrop-blur-xl" style={{ paddingTop: 'max(env(safe-area-inset-top), 10px)', paddingBottom: '10px' }}>
        <div className="relative h-7 w-24 shrink-0">
          <Image src="/logolongview.png" alt="LongView" fill className="object-contain object-left" priority sizes="96px" />
        </div>
        <ChevronRight size={12} className="shrink-0 text-zinc-700" />
        <span className="flex-1 truncate text-sm font-semibold text-zinc-100">{title}</span>
        <button
          onClick={() => setDrawerOpen(true)}
          className={`no-tap flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-transform active:scale-95 ${tone.avatar}`}
        >
          {currentUser?.name?.charAt(0) ?? 'U'}
        </button>
      </header>

      <div
        className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-200 ${drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
        onClick={() => setDrawerOpen(false)}
      />

      <aside className={`lg:hidden fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-[#0d0d0f] transition-transform duration-[240ms] ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`} style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5" style={{ paddingTop: 'max(env(safe-area-inset-top), 52px)', paddingBottom: '16px' }}>
          <div>
            <p className={`text-[11px] font-bold tracking-[0.15em] uppercase ${tone.text}`}>{moduleLabel}</p>
            <p className="mt-0.5 text-xs text-zinc-500">{currentUser?.role ?? 'Conectado'}</p>
          </div>
          <button onClick={() => setDrawerOpen(false)} className="no-tap flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-zinc-400 active:bg-white/10">
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto space-y-0.5 px-3 py-3">
          {items.map(item => renderLink(item, true))}
        </nav>

        <div className="border-t border-white/[0.06] px-4 pt-4" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
          <SidebarFooter currentModule={module} mobile onNavigate={() => setDrawerOpen(false)} />
        </div>
      </aside>

      <PWAInstallBanner />

      <nav className="lg:hidden fixed inset-x-0 bottom-0 z-30 no-tap border-t border-white/[0.06] bg-[#08080a]/[0.97] backdrop-blur-2xl" style={{ paddingBottom: 'max(var(--safe-bottom), 8px)' }}>
        <div className="flex h-[60px] items-end px-1">
          {bottomItems.map(item => {
            const active = isActive(item.href, pathname, rootHref);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="no-tap relative flex flex-1 flex-col items-center justify-center gap-1 pb-2 transition-transform active:scale-90" style={{ paddingTop: '6px' }}>
                {active && <span className={`absolute inset-x-2 rounded-xl border ${tone.bg} ${tone.border}`} style={{ top: '4px', bottom: '18px' }} />}
                <Icon size={active ? 24 : 22} strokeWidth={active ? 2.2 : 1.5} className={`relative z-10 transition-colors ${active ? tone.text : 'text-zinc-600'}`} />
                <span className={`relative z-10 text-[11px] font-semibold leading-none transition-colors ${active ? tone.text : 'text-zinc-600'}`}>{item.name}</span>
              </Link>
            );
          })}
          <button onClick={() => setDrawerOpen(true)} className="no-tap flex flex-1 flex-col items-center justify-center gap-1 pb-2 transition-transform active:scale-90" style={{ paddingTop: '6px' }}>
            <div className="relative z-10 flex flex-col items-center gap-[3.5px]">
              <span className="block h-[1.5px] w-[18px] rounded-full bg-zinc-600" />
              <span className="block h-[1.5px] w-[13px] rounded-full bg-zinc-600" />
              <span className="block h-[1.5px] w-[15px] rounded-full bg-zinc-600" />
            </div>
            <span className="text-[11px] font-semibold leading-none text-zinc-600">Mais</span>
          </button>
        </div>
      </nav>
    </>
  );
}
