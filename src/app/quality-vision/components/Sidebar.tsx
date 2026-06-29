'use client';

import { BarChart3, ClipboardCheck, LayoutDashboard } from 'lucide-react';
import ModuleSidebar from '@/components/app/ModuleSidebar';

const TITLE_MAP = {
  '/quality-vision/inspecoes': 'Inspeções',
  '/quality-vision/relatorios': 'Relatórios',
  '/quality-vision': 'Dashboard',
};

const ITEMS = [
  { name: 'Dashboard',  href: '/quality-vision',            icon: LayoutDashboard },
  { name: 'Inspeções',  href: '/quality-vision/inspecoes',  icon: ClipboardCheck },
  { name: 'Relatórios', href: '/quality-vision/relatorios', icon: BarChart3 },
];

export default function QualitySidebar() {
  return (
    <ModuleSidebar
      module="quality"
      moduleLabel="Quality Vision"
      accent="violet"
      items={ITEMS}
      bottomItems={ITEMS}
      rootHref="/quality-vision"
      titleMap={TITLE_MAP}
    />
  );
}
