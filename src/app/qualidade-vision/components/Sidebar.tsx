'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ClipboardCheck, LayoutDashboard, BarChart3, Menu, X, Home,
} from 'lucide-react'

const NAV = [
  { href: '/qualidade-vision',          label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/qualidade-vision/inspecoes', label: 'Inspeções',   icon: ClipboardCheck  },
  { href: '/qualidade-vision/relatorios',label: 'Relatórios',  icon: BarChart3       },
]

export default function QualidadeSidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between
        px-4 h-[52px] border-b border-white/10 bg-[#09090b]/95 backdrop-blur">
        <span className="text-sm font-semibold text-zinc-100">Quality Vision</span>
        <button onClick={() => setMobileOpen(v => !v)} className="p-2 text-zinc-400">
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 bottom-0 z-50 flex flex-col w-64
        bg-[#0d0d10] border-r border-white/[0.07]
        transition-transform duration-200
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/[0.07]">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <ClipboardCheck size={16} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-zinc-100 leading-tight">Quality Vision</p>
            <p className="text-[11px] text-zinc-500">Construpoint</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(item => {
            const active = pathname === item.href || (item.href !== '/qualidade-vision' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors
                  ${active
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'}
                `}
              >
                <item.icon size={16} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Back to home */}
        <div className="px-3 pb-4">
          <Link href="/select-app"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors">
            <Home size={16} />
            Voltar ao início
          </Link>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch
        border-t border-white/10 bg-[#09090b]/95 backdrop-blur">
        {NAV.map(item => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-medium transition-colors
                ${active ? 'text-emerald-400' : 'text-zinc-500'}`}>
              <item.icon size={18} />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
