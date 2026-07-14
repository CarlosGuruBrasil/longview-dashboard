import type { ActiveView } from '../types';
import {
  LayoutDashboard, Radio, MapPin, Megaphone, GitMerge, Cpu, Globe, Zap,
  Users, BarChart3, DollarSign, Lightbulb, Antenna,
} from 'lucide-react';

export interface NavItem {
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  label: string;
  view: ActiveView;
}

/** Itens do nav lateral primário (atalhos rápidos no topo) */
export const MARKETING_PRIMARY_NAV: NavItem[] = [
  { icon: Radio,          label: 'Comando',  view: 'comando' },
  { icon: MapPin,         label: 'Jornada',  view: 'jornada' },
  { icon: Megaphone,      label: 'Ads',      view: 'ads' },
  { icon: GitMerge,       label: 'Funil',    view: 'funil' },
  { icon: Cpu,            label: 'IA',       view: 'assistente' },
];

/** Lista completa de itens de navegação do Marketing Vision */
export const MARKETING_NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard',           view: 'dashboard' },
  { icon: Radio,           label: 'Central de Comando',  view: 'comando' },
  { icon: MapPin,          label: 'Jornada do Lead',     view: 'jornada' },
  { icon: Megaphone,       label: 'Gestão de Ads',       view: 'ads' },
  { icon: BarChart3,       label: 'Marketing Ads (Gastos)', view: 'marketing' },
  { icon: Cpu,             label: 'Assistente de IA',    view: 'assistente' },
  { icon: Globe,           label: 'Central Social',      view: 'social' },
  { icon: GitMerge,        label: 'Funil Inteligente',   view: 'funil' },
  { icon: DollarSign,      label: 'Vendas e Projetos',   view: 'vendas' },
  { icon: Users,           label: 'Leads',               view: 'leads' },
  { icon: Antenna,         label: 'Fontes de Leads',     view: 'fontes' },
  { icon: BarChart3,       label: 'Métricas',            view: 'metrics' },
  { icon: Lightbulb,       label: 'Inteligência',        view: 'intelligence' },
  { icon: Zap,             label: 'Hub de Integrações',  view: 'integracoes' },
];

/** Títulos das views para o AppHeader */
export const MARKETING_VIEW_TITLES: Record<ActiveView, string> = {
  dashboard:    'Dashboard',
  leads:        'Leads',
  oportunidades:'Oportunidades',
  empreendimentos: 'Empreendimentos',
  vendas:       'Vendas e Projetos',
  funil:        'Funil Inteligente',
  marketing:    'Marketing Ads (Gastos)',
  publicar:     'Publicar',
  audiences:    'Audiências',
  links:        'Links Rápidos',
  score:        'Score de Campanhas',
  trafego:      'Tráfego',
  metrics:      'Métricas',
  insights:     'Insights',
  intelligence: 'Inteligência',
  comando:      'Central de Comando',
  jornada:      'Jornada do Lead',
  ads:          'Gestão de Ads',
  assistente:   'Assistente de IA',
  social:       'Central Social',
  integracoes:  'Hub de Integrações',
  fontes:       'Fontes de Leads',
};
