import { cookies } from 'next/headers';
import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import jwt from 'jsonwebtoken';
import {
  Building2,
  TrendingUp,
  Users,
  ClipboardCheck,
  ShoppingBag,
  ArrowRight,
  LogOut
} from 'lucide-react';
import SelectAppHeaderStatus from './SelectAppHeaderStatus';

const JWT_SECRET = process.env.JWT_SECRET ?? (() => { throw new Error('[LongView] JWT_SECRET nao configurado. Defina no .env.local') })();

interface SelectAppJwtPayload {
  name: string;
  role: string;
  permissions?: {
    viewProjectVision?: boolean;
    viewMarketingDashboard?: boolean;
    viewPeopleVision?: boolean;
    viewQualityVision?: boolean;
    viewSalesVision?: boolean;
    isAdmin?: boolean;
  };
}

const APPS = [
  {
    key: 'project',
    href: '/project-vision',
    label: 'Project Vision',
    tag: 'Gestão & Cronograma',
    description: 'Projetos, rotas operacionais, cronograma de obras, Kanbans e andamentos das tarefas LongView.',
    icon: Building2,
    color: 'blue',
    accent: 'bg-blue-500/12 border-blue-400/20 text-blue-300',
    cardHover: 'hover:border-blue-300/30 hover:bg-blue-500/[0.045]',
    cardBorder: 'border-blue-400/15',
    tagColor: 'text-blue-300/80',
    btnClass: 'bg-blue-500/90 hover:bg-blue-400 shadow-[0_12px_28px_rgba(59,130,246,0.18)]',
    permKey: 'hasProjectAccess',
  },
  {
    key: 'marketing',
    href: '/marketing-vision',
    label: 'Marketing Vision',
    tag: 'Vendas & Ads',
    description: 'Métricas do CRM CV, controle de leads, oportunidades, auditoria de campanhas Meta Ads e estoque de unidades.',
    icon: TrendingUp,
    color: 'orange',
    accent: 'bg-orange-500/12 border-orange-400/20 text-orange-300',
    cardHover: 'hover:border-orange-300/30 hover:bg-orange-500/[0.045]',
    cardBorder: 'border-orange-400/15',
    tagColor: 'text-orange-300/80',
    btnClass: 'bg-orange-500/90 hover:bg-orange-400 shadow-[0_12px_28px_rgba(249,115,22,0.18)]',
    permKey: 'hasMarketingAccess',
  },
  {
    key: 'people',
    href: '/people-vision',
    label: 'People Vision',
    tag: 'Pessoas & Acesso',
    description: 'Gestão de colaboradores, cadastro via convite com fluxo de aprovação, notificações push e controle de acesso.',
    icon: Users,
    color: 'emerald',
    accent: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    cardHover: 'hover:border-emerald-300/30 hover:bg-emerald-500/[0.045]',
    cardBorder: 'border-emerald-400/15',
    tagColor: 'text-emerald-300/80',
    btnClass: 'bg-emerald-500/90 hover:bg-emerald-400 shadow-[0_12px_28px_rgba(16,185,129,0.18)]',
    permKey: 'hasPeopleAccess',
  },
  {
    key: 'quality',
    href: '/quality-vision',
    label: 'Quality Vision',
    tag: 'Quality & Obras',
    description: 'Inspeções e verificações integradas ao Construpoint. Fichas FVS, FVM, CHK, SEG, MA e EDU com série histórica.',
    icon: ClipboardCheck,
    color: 'violet',
    accent: 'bg-violet-500/12 border-violet-400/20 text-violet-300',
    cardHover: 'hover:border-violet-300/30 hover:bg-violet-500/[0.045]',
    cardBorder: 'border-violet-400/15',
    tagColor: 'text-violet-300/80',
    btnClass: 'bg-violet-500/90 hover:bg-violet-400 shadow-[0_12px_28px_rgba(139,92,246,0.18)]',
    permKey: 'hasQualityAccess',
  },
  {
    key: 'sales',
    href: '/sales-vision',
    label: 'Sales Vision',
    tag: 'VGV & Performance',
    description: 'VGV por empreendimento, ticket médio, ciclo de venda, performance de corretores, reservas e contratos.',
    icon: ShoppingBag,
    color: 'sky',
    accent: 'bg-sky-500/12 border-sky-400/20 text-sky-300',
    cardHover: 'hover:border-sky-300/30 hover:bg-sky-500/[0.045]',
    cardBorder: 'border-sky-400/15',
    tagColor: 'text-sky-300/80',
    btnClass: 'bg-sky-500/90 hover:bg-sky-400 shadow-[0_12px_28px_rgba(14,165,233,0.18)]',
    permKey: 'hasSalesAccess',
  },
] as const;

export default async function SelectAppPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) redirect('/login');

  let user: SelectAppJwtPayload | null = null;
  try {
    user = jwt.verify(token, JWT_SECRET) as SelectAppJwtPayload;
  } catch {
    redirect('/login');
  }

  const { role, permissions, name } = user;
  const isDeveloper = role === 'Desenvolvedor';

  const access: Record<string, boolean> = {
    hasProjectAccess:   isDeveloper || permissions?.viewProjectVision === true,
    hasMarketingAccess: isDeveloper || permissions?.viewMarketingDashboard === true,
    hasPeopleAccess:    isDeveloper || permissions?.viewPeopleVision === true,
    hasQualityAccess:   isDeveloper || permissions?.viewQualityVision === true,
    hasSalesAccess:     isDeveloper || permissions?.viewSalesVision === true,
  };

  const visibleApps = APPS.filter((app) => access[app.permKey]);

  return (
    <main
      className="min-h-screen bg-[#09090b] flex flex-col px-5 pb-8 relative overflow-hidden"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}
    >
      {/* Background Glows */}
      <div className="absolute top-[-30%] left-[-20%] w-[800px] h-[800px] rounded-full bg-orange-500/5 blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-30%] right-[-20%] w-[800px] h-[800px] rounded-full bg-blue-500/5 blur-[160px] pointer-events-none" />

      {/* Header */}
      <header className="h-16 w-full relative z-10 shrink-0 flex items-center justify-between">
        <div className="flex-1 flex justify-start">
          <SelectAppHeaderStatus />
        </div>

        <div className="relative h-[54px] w-[194px] shrink-0">
          <Image
            src="/logolongview.png"
            alt="LongView"
            fill
            className="object-contain"
            priority
            sizes="194px"
          />
        </div>

        <div className="flex-1 flex justify-end">
          <a
            href="/api/auth/logout"
            className="flex items-center gap-1.5 text-xs font-bold text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/20 hover:border-red-400/30 rounded-xl px-4 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl transition-all duration-200"
          >
            <LogOut size={14} />
            <span>Sair</span>
          </a>
        </div>
      </header>

      {/* Greeting */}
      <div className="relative z-10 text-center mt-6 mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
          Olá, {name}
        </h2>
        <p className="text-sm text-zinc-500 mt-1.5">
          Selecione o módulo que deseja acessar
        </p>
        <span className="inline-flex mt-4 text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-500">
          Ambiente Integrado
        </span>
      </div>

      {/* Grid de Apps */}
      <div className="relative z-10 flex-1 w-full max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {visibleApps.map((app) => {
            const Icon = app.icon;
            return (
              <div
                key={app.key}
                className={`
                  bg-white/[0.035] border ${app.cardBorder} rounded-2xl p-5 flex flex-col gap-4
                  shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl
                  transition-all duration-300 group
                  ${app.cardHover} cursor-default
                `}
              >
                {/* Icon + label */}
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${app.accent}`}>
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-white leading-tight">{app.label}</h3>
                    <p className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${app.tagColor}`}>{app.tag}</p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs leading-relaxed text-zinc-400 flex-1">
                  {app.description}
                </p>

                {/* Action */}
                <Link
                  href={app.href}
                  className={`flex items-center justify-center gap-1.5 text-xs font-bold text-white px-4 py-2.5 rounded-xl transition-all duration-200 ${app.btnClass}`}
                >
                  <span>Entrar no App</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center relative z-10 mt-8">
        <p className="text-[10px] text-zinc-700 tracking-wider uppercase font-semibold">
          LongView Empreendimentos • Hauzi Tecnologia • V.1 2026
        </p>
      </footer>
    </main>
  );
}
