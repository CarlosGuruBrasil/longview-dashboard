'use client';
import React, { useState } from 'react';
import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Users,
  GitMerge,
  Menu,
  X,
} from 'lucide-react';
import { useSalesView, SalesActiveView } from './SalesVisionApp';

const NAV_ITEMS: { key: SalesActiveView; label: string; icon: React.ReactNode }[] = [
  { key: 'visao-geral',               label: 'Visão Geral',             icon: <LayoutDashboard size={18} /> },
  { key: 'reservas-contratos',        label: 'Reservas & Contratos',    icon: <FileText size={18} /> },
  { key: 'performance-empreendimento', label: 'Performance por Empreend.', icon: <BarChart3 size={18} /> },
  { key: 'corretores',                label: 'Corretores & Imobiliárias', icon: <Users size={18} /> },
  { key: 'funil-comercial',           label: 'Funil Comercial',         icon: <GitMerge size={18} /> },
];

export default function SalesAppShell({ children }: { children: React.ReactNode }) {
  const { activeView, setActiveView } = useSalesView();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#09090b]">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-white/[0.06] bg-[#0c0c0f]">
        <div className="h-16 flex items-center px-5 border-b border-white/[0.06]">
          <span className="text-sm font-bold text-white tracking-tight">Sales Vision</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveView(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                activeView === item.key
                  ? 'bg-sky-500/10 text-sky-300 border border-sky-500/20'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Drawer Mobile */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-[#0c0c0f] border-r border-white/[0.06] p-4 animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm font-bold text-white">Sales Vision</span>
              <button onClick={() => setDrawerOpen(false)} className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors">
                <X size={18} />
              </button>
            </div>
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => { setActiveView(item.key); setDrawerOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                    activeView === item.key
                      ? 'bg-sky-500/10 text-sky-300 border border-sky-500/20'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Mobile */}
        <header className="lg:hidden h-14 flex items-center justify-between px-4 border-b border-white/[0.06] bg-[#0c0c0f]">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-bold text-white">Sales Vision</span>
          <div className="w-9" />
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
