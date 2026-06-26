'use client';

import {
  BarChart3,
  Building2,
  CalendarRange,
  FolderArchive,
  Kanban,
  LayoutDashboard,
  ListTodo,
  Settings,
  Users,
} from 'lucide-react';
import ModuleSidebar from '@/components/app/ModuleSidebar';

const TITLE_MAP = {
  '/project-vision/projects': 'Empreendimentos',
  '/project-vision/tasks': 'Tarefas',
  '/project-vision/kanban': 'Kanban',
  '/project-vision/timeline': 'Timeline',
  '/project-vision/responsibles': 'Responsáveis',
  '/project-vision/documents': 'Documentos',
  '/project-vision/reports': 'Relatórios',
  '/project-vision/settings': 'Configurações',
  '/project-vision': 'Dashboard',
};

const ITEMS = [
  { name: 'Dashboard',       href: '/project-vision',               icon: LayoutDashboard },
  { name: 'Empreendimentos', href: '/project-vision/projects',      icon: Building2 },
  { name: 'Tarefas',         href: '/project-vision/tasks',         icon: ListTodo },
  { name: 'Kanban',          href: '/project-vision/kanban',        icon: Kanban },
  { name: 'Timeline',        href: '/project-vision/timeline',      icon: CalendarRange },
  { name: 'Responsáveis',    href: '/project-vision/responsibles',  icon: Users },
  { name: 'Documentos',      href: '/project-vision/documents',     icon: FolderArchive },
  { name: 'Relatórios',      href: '/project-vision/reports',       icon: BarChart3 },
  { name: 'Configurações',   href: '/project-vision/settings',      icon: Settings },
];

const BOTTOM_ITEMS = [
  { name: 'Dashboard', href: '/project-vision',          icon: LayoutDashboard },
  { name: 'Tarefas',   href: '/project-vision/tasks',    icon: ListTodo },
  { name: 'Kanban',    href: '/project-vision/kanban',   icon: Kanban },
  { name: 'Projetos',  href: '/project-vision/projects', icon: Building2 },
];

export default function Sidebar() {
  return (
    <ModuleSidebar
      module="project"
      moduleLabel="Project Vision"
      accent="blue"
      items={ITEMS}
      bottomItems={BOTTOM_ITEMS}
      rootHref="/project-vision"
      titleMap={TITLE_MAP}
    />
  );
}
