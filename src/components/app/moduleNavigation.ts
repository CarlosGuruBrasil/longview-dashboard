import {
  ArrowRightLeft,
  BarChart3,
  Building2,
  ClipboardCheck,
  Grid3X3,
  MonitorSmartphone,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import type { User } from '@/context/UserContext';

export type ModuleKey = 'project' | 'site' | 'marketing' | 'people' | 'quality';

export interface ModuleNavItem {
  key: ModuleKey;
  name: string;
  shortName: string;
  href: string;
  icon: LucideIcon;
  colorClass: string;
  bgClass: string;
  activeBgClass: string;
  borderClass: string;
  iconBgClass: string;
  buttonClass: string;
  permission: keyof NonNullable<User['permissions']>;
}

export const MODULES: ModuleNavItem[] = [
  {
    key: 'project',
    name: 'Project Vision',
    shortName: 'Project',
    href: '/project-vision',
    icon: Building2,
    colorClass: 'text-blue-400',
    bgClass: 'bg-blue-500/10 hover:bg-blue-500/16',
    activeBgClass: 'bg-blue-500/10',
    borderClass: 'border-blue-400/20',
    iconBgClass: 'bg-blue-500/12 border-blue-400/20 text-blue-300',
    buttonClass: 'bg-blue-500/90 hover:bg-blue-400 text-white',
    permission: 'viewProjectVision',
  },
  {
    key: 'site',
    name: 'Site Vision',
    shortName: 'Site',
    href: '/site-vision',
    icon: MonitorSmartphone,
    colorClass: 'text-teal-400',
    bgClass: 'bg-teal-500/10 hover:bg-teal-500/16',
    activeBgClass: 'bg-teal-500/10',
    borderClass: 'border-teal-400/20',
    iconBgClass: 'bg-teal-500/12 border-teal-400/20 text-teal-300',
    buttonClass: 'bg-teal-500/90 hover:bg-teal-400 text-white',
    permission: 'viewSiteVision',
  },
  {
    key: 'marketing',
    name: 'Marketing Vision',
    shortName: 'Marketing',
    href: '/marketing-vision',
    icon: BarChart3,
    colorClass: 'text-orange-400',
    bgClass: 'bg-orange-500/10 hover:bg-orange-500/16',
    activeBgClass: 'bg-orange-500/10',
    borderClass: 'border-orange-400/20',
    iconBgClass: 'bg-orange-500/12 border-orange-400/20 text-orange-300',
    buttonClass: 'bg-orange-500/90 hover:bg-orange-400 text-white',
    permission: 'viewMarketingDashboard',
  },
  {
    key: 'people',
    name: 'People Vision',
    shortName: 'People',
    href: '/people-vision',
    icon: UsersRound,
    colorClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/10 hover:bg-emerald-500/16',
    activeBgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-400/20',
    iconBgClass: 'bg-emerald-500/12 border-emerald-400/20 text-emerald-300',
    buttonClass: 'bg-emerald-500/90 hover:bg-emerald-400 text-white',
    permission: 'viewPeopleVision',
  },
  {
    key: 'quality',
    name: 'Quality Vision',
    shortName: 'Quality',
    href: '/quality-vision',
    icon: ClipboardCheck,
    colorClass: 'text-violet-400',
    bgClass: 'bg-violet-500/10 hover:bg-violet-500/16',
    activeBgClass: 'bg-violet-500/10',
    borderClass: 'border-violet-400/20',
    iconBgClass: 'bg-violet-500/12 border-violet-400/20 text-violet-300',
    buttonClass: 'bg-violet-500/90 hover:bg-violet-400 text-white',
    permission: 'viewQualityVision',
  },
];

export const appsItem = {
  name: 'Painel de Aplicativos',
  shortName: 'Apps',
  href: '/select-app',
  icon: Grid3X3,
};

export const switchIcon = ArrowRightLeft;

export function isDeveloper(user?: User | null) {
  return user?.role === 'Desenvolvedor';
}

export function isAdminUser(user?: User | null) {
  return isDeveloper(user) || user?.permissions?.isAdmin === true;
}

export function canAccessModule(user: User | null | undefined, module: ModuleNavItem) {
  if (isDeveloper(user)) return true;
  return user?.permissions?.[module.permission] === true;
}

export function getAllowedModules(user: User | null | undefined, currentModule?: ModuleKey) {
  return MODULES.filter(module => module.key !== currentModule && canAccessModule(user, module));
}
