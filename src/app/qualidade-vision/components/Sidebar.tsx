'use client';

import { BarChart3, ClipboardCheck, LayoutDashboard } from 'lucide-react';
import ModuleSidebar from '@/components/app/ModuleSidebar';

const TITLE_MAP = {
  '/qualidade-vision/inspecoes': 'Inspeções',
  '/qualidade-vision/relatorios': 'Relatórios',
  '/qualidade-vision': 'Dashboard',
};

const ITEMS = [
  { name: 'Dashboard',  href: '/qualidade-vision',            icon: LayoutDashboard },
  { name: 'Inspeções',  href: '/qualidade-vision/inspecoes',  icon: ClipboardCheck },
  { name: 'Relatórios', href: '/qualidade-vision/relatorios', icon: BarChart3 },
];

export default function QualidadeSidebar() {
  return (
    <ModuleSidebar
      module="quality"
      moduleLabel="Quality Vision"
      accent="violet"
      items={ITEMS}
      bottomItems={ITEMS}
      rootHref="/qualidade-vision"
      titleMap={TITLE_MAP}
    />
  );
}
