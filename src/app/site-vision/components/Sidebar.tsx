'use client';

import { LayoutDashboard, Building2, Users, Home } from 'lucide-react';
import ModuleSidebar from '@/components/app/ModuleSidebar';

const TITLE_MAP = {
  '/site-vision/empreendimentos': 'Empreendimentos',
  '/site-vision/revendas': 'Revendas',
  '/site-vision/equipe': 'Equipe do Site',
  '/site-vision': 'Dashboard',
};

const ITEMS = [
  { name: 'Dashboard', href: '/site-vision', icon: LayoutDashboard },
  { name: 'Empreendimentos', href: '/site-vision/empreendimentos', icon: Building2 },
  { name: 'Revendas', href: '/site-vision/revendas', icon: Home },
  { name: 'Equipe', href: '/site-vision/equipe', icon: Users },
];

export default function SiteSidebar() {
  return (
    <ModuleSidebar
      module="site"
      moduleLabel="Site Vision"
      accent="teal"
      items={ITEMS}
      bottomItems={ITEMS}
      rootHref="/site-vision"
      titleMap={TITLE_MAP}
    />
  );
}
