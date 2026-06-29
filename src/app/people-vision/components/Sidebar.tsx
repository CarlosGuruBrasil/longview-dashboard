'use client';

import { Bell, LayoutDashboard, UserPlus, Users } from 'lucide-react';
import ModuleSidebar from '@/components/app/ModuleSidebar';

const TITLE_MAP = {
  '/people-vision/colaboradores': 'Colaboradores',
  '/people-vision/cadastro': 'Cadastro',
  '/people-vision/notificacoes': 'Notificações',
  '/people-vision': 'Dashboard',
};

const ITEMS = [
  { name: 'Dashboard',     href: '/people-vision',               icon: LayoutDashboard },
  { name: 'Colaboradores', href: '/people-vision/colaboradores', icon: Users },
  { name: 'Cadastro',      href: '/people-vision/cadastro',      icon: UserPlus },
  { name: 'Notificações',  href: '/people-vision/notificacoes',  icon: Bell },
];

export default function PeopleSidebar() {
  return (
    <ModuleSidebar
      module="people"
      moduleLabel="People Vision"
      accent="emerald"
      items={ITEMS}
      bottomItems={ITEMS}
      rootHref="/people-vision"
      titleMap={TITLE_MAP}
    />
  );
}
