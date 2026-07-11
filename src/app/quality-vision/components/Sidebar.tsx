'use client';

import { BarChart3, ClipboardCheck, LayoutDashboard, Lightbulb, Tags } from 'lucide-react';
import ModuleSidebar from '@/components/app/ModuleSidebar';

const TITLE_MAP = {
  '/quality-vision/inteligencia': 'Inteligência',
  '/quality-vision/inspecoes': 'Inspeções',
  '/quality-vision/relatorios': 'Relatórios',
  '/quality-vision/classificacao': 'Classificação',
  '/quality-vision': 'Dashboard',
};

const ITEMS = [
  { name: 'Dashboard',    href: '/quality-vision',              icon: LayoutDashboard },
  { name: 'Inteligência', href: '/quality-vision/inteligencia', icon: Lightbulb },
  { name: 'Inspeções',    href: '/quality-vision/inspecoes',    icon: ClipboardCheck },
  { name: 'Relatórios',   href: '/quality-vision/relatorios',   icon: BarChart3 },
  { name: 'Classificação', href: '/quality-vision/classificacao', icon: Tags },
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
