'use client';

import { Bell, BriefcaseBusiness, LayoutDashboard, UserPlus, Users } from 'lucide-react';
import ModuleSidebar from '@/components/app/ModuleSidebar';
import { useUser } from '@/context/UserContext';
import { canAccessHrMetrics } from '@/lib/user-access';

const TITLE_MAP = {
  '/people-vision/colaboradores': 'Colaboradores',
  '/people-vision/fornecedores': 'Fornecedores',
  '/people-vision/rh': 'Inteligência RH',
  '/people-vision/cadastro': 'Cadastro',
  '/people-vision/notificacoes': 'Notificações',
  '/people-vision': 'Dashboard',
};

export default function PeopleSidebar() {
  const { currentUser } = useUser();
  const items = [
    { name: 'Dashboard', href: '/people-vision', icon: LayoutDashboard },
    { name: 'Colaboradores', href: '/people-vision/colaboradores', icon: Users },
    { name: 'Fornecedores', href: '/people-vision/fornecedores', icon: BriefcaseBusiness },
    ...(canAccessHrMetrics(currentUser) ? [{ name: 'Inteligência RH', href: '/people-vision/rh', icon: Bell }] : []),
    { name: 'Cadastro', href: '/people-vision/cadastro', icon: UserPlus },
    { name: 'Notificações', href: '/people-vision/notificacoes', icon: Bell },
  ];

  return (
    <ModuleSidebar
      module="people"
      moduleLabel="People Vision"
      accent="emerald"
      items={items}
      bottomItems={items}
      rootHref="/people-vision"
      titleMap={TITLE_MAP}
    />
  );
}
