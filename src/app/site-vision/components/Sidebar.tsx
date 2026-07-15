'use client';

import { LayoutDashboard, Building2, PlugZap, ShieldCheck, RadioTower } from 'lucide-react';
import ModuleSidebar from '@/components/app/ModuleSidebar';

const TITLE_MAP = {
  '/site-vision/empreendimentos': 'Empreendimentos',
  '/site-vision/leads': 'Leads & Captação',
  '/site-vision/integracoes': 'Integrações',
  '/site-vision/acesso': 'Acesso & Operação',
  '/site-vision': 'Dashboard',
};

const ITEMS = [
  { name: 'Dashboard', href: '/site-vision', icon: LayoutDashboard },
  { name: 'Empreendimentos', href: '/site-vision/empreendimentos', icon: Building2 },
  { name: 'Leads', href: '/site-vision/leads', icon: RadioTower },
  { name: 'Integrações', href: '/site-vision/integracoes', icon: PlugZap },
  { name: 'Acesso', href: '/site-vision/acesso', icon: ShieldCheck },
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
