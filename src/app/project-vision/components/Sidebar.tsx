'use client';

import React from 'react';
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
  ArrowRightLeft,
  Grid3X3,
  LogOut,
  Settings
} from 'lucide-react';
import { useUser } from '@/context/UserContext';

export default function Sidebar() {
  const pathname = usePathname();
  const { currentUser } = useUser();

  const isAdmin = currentUser?.role === 'Desenvolvedor' || currentUser?.permissions?.isAdmin === true;

  const menuItems = [
    { name: 'Dashboard', href: '/project-vision', icon: LayoutDashboard },
    { name: 'Empreendimentos', href: '/project-vision/projects', icon: Building2 },
    { name: 'Tarefas', href: '/project-vision/tasks', icon: ListTodo },
    { name: 'Kanban', href: '/project-vision/kanban', icon: Kanban },
    { name: 'Timeline', href: '/project-vision/timeline', icon: CalendarRange },
    { name: 'Responsáveis', href: '/project-vision/responsibles', icon: Users },
    { name: 'Documentos', href: '/project-vision/documents', icon: FolderArchive },
    { name: 'Relatórios', href: '/project-vision/reports', icon: BarChart3 },
  ];

  if (isAdmin) {
    menuItems.push({ name: 'Gerenciar Usuários', href: '/admin/users', icon: Settings });
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Desenvolvedor': return 'bg-purple-500/10 text-purple-400 border border-purple-500/30';
      case 'Diretoria': return 'bg-red-500/10 text-red-400 border border-red-500/30';
      case 'Gestor': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
      case 'Parceiro': return 'bg-amber-500/10 text-amber-400 border border-amber-500/30';
      case 'Corretor': return 'bg-blue-500/10 text-blue-400 border border-blue-500/30';
      default: return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/30';
    }
  };

  return (
    <aside className="fixed top-0 bottom-0 left-0 z-40 w-64 bg-[#09090B] border-r border-[#1C1C1E] flex flex-col justify-between hidden lg:flex">
      <div>
        {/* Logo */}
        <div className="pt-8 pb-6 flex flex-col items-center justify-center border-b border-[#1C1C1E]/50">
          <div className="relative w-44 h-14">
            <Image 
              src="/logolongview.png" 
              alt="LONGVIEW Logo" 
              fill
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
          <span className="text-[9px] uppercase font-bold tracking-widest text-orange-400/80 mt-1">
            Project Vision
          </span>
        </div>

        {/* Menu de Navegação */}
        <nav className="p-4 space-y-1.5">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/project-vision' && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
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

      {/* Footer da Sidebar */}
      <div className="p-4 border-t border-[#1C1C1E] space-y-3">
        
        {/* Acesso Rápido - Trocar de App */}
        <div className="space-y-1.5">
          <Link
            href="/select-app"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-300 hover:text-white transition-all duration-200"
          >
            <Grid3X3 size={14} />
            <span>Painel de Aplicativos</span>
          </Link>

          <Link
            href="/marketing-vision"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 transition-all duration-200"
          >
            <ArrowRightLeft size={14} />
            <span>Ir para Marketing Vision</span>
          </Link>
        </div>

        {/* Perfil do Usuário Logado */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#121214] border border-[#1E1E22] text-left">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 text-white font-medium text-xs shrink-0">
              {currentUser?.name?.charAt(0) || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs text-white font-medium truncate">{currentUser?.name || 'Usuário'}</p>
              <span className={`inline-block mt-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${getRoleColor(currentUser?.role || '')}`}>
                {currentUser?.role || 'Acesso'}
              </span>
            </div>
          </div>
          
          <a 
            href="/api/auth/logout"
            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-all"
            title="Fazer Logout"
          >
            <LogOut size={14} />
          </a>
        </div>

      </div>
    </aside>
  );
}
