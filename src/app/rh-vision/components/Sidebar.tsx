'use client';

import { Bell, LayoutDashboard, UserPlus, Users } from 'lucide-react';
import ModuleSidebar from '@/components/app/ModuleSidebar';

const TITLE_MAP = {
  '/rh-vision/colaboradores': 'Colaboradores',
  '/rh-vision/cadastro': 'Cadastro',
  '/rh-vision/notificacoes': 'Notificações',
  '/rh-vision': 'Dashboard',
};

const ITEMS = [
  { name: 'Dashboard',     href: '/rh-vision',               icon: LayoutDashboard },
  { name: 'Colaboradores', href: '/rh-vision/colaboradores', icon: Users },
  { name: 'Cadastro',      href: '/rh-vision/cadastro',      icon: UserPlus },
  { name: 'Notificações',  href: '/rh-vision/notificacoes',  icon: Bell },
];

export default function RHSidebar() {
  return (
    <ModuleSidebar
      module="people"
      moduleLabel="People Vision"
      accent="emerald"
      items={ITEMS}
      bottomItems={ITEMS}
      rootHref="/rh-vision"
      titleMap={TITLE_MAP}
    />
  );
}
