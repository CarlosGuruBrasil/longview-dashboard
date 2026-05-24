'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { 
  LayoutDashboard, 
  Building2, 
  ListTodo, 
  Kanban, 
  CalendarRange, 
  Users, 
  FolderArchive, 
  BarChart3, 
  Settings,
  ChevronDown,
  Menu,
  X,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { useUser } from '@/context/UserContext';

export default function Sidebar() {
  const pathname = usePathname();
  const { currentUser, setCurrentUser, availableUsers } = useUser();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Empreendimentos', href: '/projects', icon: Building2 },
    { name: 'Tarefas', href: '/tasks', icon: ListTodo },
    { name: 'Kanban', href: '/kanban', icon: Kanban },
    { name: 'Timeline', href: '/timeline', icon: CalendarRange },
    { name: 'Responsáveis', href: '/responsibles', icon: Users },
    { name: 'Documentos', href: '/documents', icon: FolderArchive },
    { name: 'Relatórios', href: '/reports', icon: BarChart3 },
  ];

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Diretoria': return 'bg-red-500/10 text-red-400 border border-red-500/30';
      case 'Equipe Interna': return 'bg-blue-500/10 text-blue-400 border border-blue-500/30';
      case 'Parceiro': return 'bg-amber-500/10 text-amber-400 border border-amber-500/30';
      default: return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/30';
    }
  };

  return (
    <>
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 bg-[#121214] border border-[#2B2B30] text-white rounded-lg backdrop-blur-md bg-opacity-80"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside className={`
        fixed top-0 bottom-0 left-0 z-45 w-64 bg-[#09090B] border-r border-[#1C1C1E] flex flex-col justify-between transition-transform duration-300
        lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:flex'}
      `}>
        
        <div>
          <div className="pt-8 pb-6 flex flex-col items-center justify-center border-b border-[#1C1C1E]/50">
            <div className="relative w-44 h-14">
              <Image 
                src="/logo longview.png" 
                alt="LONGVIEW Logo" 
                fill
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
          </div>

          <nav className="p-4 space-y-1.5">
            {menuItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200 group
                    ${isActive 
                      ? 'bg-white/5 text-white font-medium shadow-[0_0_15px_rgba(255,255,255,0.02)] border border-white/10' 
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.02] border border-transparent'
                    }
                  `}
                >
                  <Icon size={18} className={`transition-transform duration-200 group-hover:scale-105 ${isActive ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-[#1C1C1E] relative">
          <button 
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="w-full flex items-center justify-between p-2.5 rounded-lg bg-[#121214] border border-[#1E1E22] hover:bg-[#18181B] transition-all duration-200 text-left group"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 text-white font-medium text-xs shrink-0">
                {currentUser.name.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs text-white font-medium truncate group-hover:text-white/90">{currentUser.name}</p>
                <span className={`inline-block mt-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${getRoleColor(currentUser.role)}`}>
                  {currentUser.role}
                </span>
              </div>
            </div>
            <ChevronDown size={14} className={`text-zinc-500 transition-transform duration-200 shrink-0 ${userDropdownOpen ? 'rotate-180 text-white' : ''}`} />
          </button>

          {userDropdownOpen && (
            <div className="absolute bottom-16 left-4 right-4 z-50 rounded-xl bg-[#0F0F11]/95 backdrop-blur-xl border border-[#2B2B30] shadow-2xl p-2.5 space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="px-2.5 py-1.5 border-b border-[#1C1C1E] mb-1.5 flex items-center gap-1.5">
                <ShieldCheck size={12} className="text-zinc-500" />
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Simular Acesso</span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5 pr-0.5 scrollbar-thin">
                {availableUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      setCurrentUser(user);
                      setUserDropdownOpen(false);
                    }}
                    className={`
                      w-full flex items-center justify-between p-2 rounded-lg text-left transition-all duration-150 text-xs
                      ${currentUser.id === user.id 
                        ? 'bg-white/5 text-white font-medium border border-white/10' 
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.02] border border-transparent'
                      }
                    `}
                  >
                    <div className="overflow-hidden">
                      <p className="truncate font-medium">{user.name}</p>
                      <p className="text-[9px] text-zinc-500 truncate">{user.email}</p>
                    </div>
                    {currentUser.id === user.id && <UserCheck size={12} className="text-white shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

      </aside>
    </>
  );
}
