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
  Lock,
  ArrowRight,
  LogOut
} from 'lucide-react';
import SelectAppHeaderStatus from './SelectAppHeaderStatus';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-longview-key';

interface SelectAppJwtPayload {
  name: string;
  role: string;
  permissions?: {
    viewProjectVision?: boolean;
    viewMarketingDashboard?: boolean;
    viewPeopleVision?: boolean;
    viewQualityVision?: boolean;
    isAdmin?: boolean;
  };
}

export default async function SelectAppPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    redirect('/login');
  }

  let user: SelectAppJwtPayload | null = null;
  try {
    user = jwt.verify(token, JWT_SECRET) as SelectAppJwtPayload;
  } catch {
    redirect('/login');
  }

  const { role, permissions, name } = user;

  // Verificar permissões
  const isDeveloper = role === 'Desenvolvedor';
  const hasProjectAccess   = isDeveloper || permissions?.viewProjectVision === true;
  const hasMarketingAccess = isDeveloper || permissions?.viewMarketingDashboard === true;
  const hasPeopleAccess        = isDeveloper || permissions?.viewPeopleVision === true;
  const hasQualityAccess   = isDeveloper || permissions?.viewQualityVision === true;

  return (
    <main
      className="min-h-screen bg-[#09090b] flex flex-col justify-between px-5 pb-8 relative overflow-hidden"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}
    >
      {/* Background Glows */}
      <div className="absolute top-[-30%] left-[-20%] w-[800px] h-[800px] rounded-full bg-orange-500/5 blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-30%] right-[-20%] w-[800px] h-[800px] rounded-full bg-blue-500/5 blur-[160px] pointer-events-none" />

      {/* Header */}
      <header className="h-16 w-full relative z-10 shrink-0">
        <div className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2">
          <SelectAppHeaderStatus />
        </div>

        <div className="absolute left-1/2 top-1/2 h-[54px] w-[194px] -translate-x-1/2 -translate-y-1/2">
          <Image
            src="/logolongview.png"
            alt="LongView"
            fill
            className="object-contain"
            priority
            sizes="194px"
          />
        </div>

        <div className="absolute right-0 top-1/2 -translate-y-1/2">
          <a
            href="/api/auth/logout"
            className="flex items-center gap-1.5 text-xs font-bold text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/20 hover:border-red-400/30 rounded-xl px-4 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl transition-all duration-200"
          >
            <LogOut size={14} />
            <span>Sair</span>
          </a>
        </div>
      </header>

      {/* Corpo Central */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-[1400px] w-full mx-auto relative z-10 my-8">
        <div className="text-center mb-10 max-w-4xl -mt-10 flex flex-col items-center">
          <div className="flex min-h-[104px] -translate-y-14 flex-col items-center justify-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Olá, {name}
            </h2>
            <p className="text-sm text-zinc-400 mt-1.5 lg:whitespace-nowrap">
              Selecione qual aplicativo deseja acessar no momento de acordo com suas liberações:
            </p>
          </div>
          <span className="inline-flex mt-8 text-[11px] uppercase font-bold tracking-wider px-2.5 py-1 rounded bg-white/5 border border-white/10 text-zinc-400">
            Ambiente Integrado
          </span>
        </div>

        {/* Grid dos Cards de Aplicativos */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 w-full max-w-[1400px] justify-center">
          
          {/* Card: Project Vision */}
          <div className={`
            bg-white/[0.035] border border-blue-400/15 rounded-2xl p-6.5 flex flex-col justify-between min-h-[260px] relative transition-all duration-300 group shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl
            ${hasProjectAccess 
              ? 'hover:border-blue-300/30 hover:bg-blue-500/[0.045]' 
              : 'opacity-50'
            }
          `}>
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/12 border border-blue-400/20 text-blue-300 flex items-center justify-center mb-5">
                <Building2 size={24} />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-blue-300 transition-colors">
                Project Vision
              </h3>
              <p className="text-[11px] text-blue-300/80 font-bold uppercase tracking-wider mt-1">Gestão & Cronograma</p>
              <p className="text-xs leading-relaxed text-zinc-400 mt-2">
                Acompanhamento e gestão de projetos, rotas operacionais, status de contratações, cronograma de obras, Kanbans e andamentos das tarefas LongView.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between">
              {hasProjectAccess ? (
                <Link
                  href="/project-vision"
                  className="flex items-center gap-1.5 text-xs font-bold bg-blue-500/90 hover:bg-blue-400 text-white px-4.5 py-2.5 rounded-xl transition-all duration-200 cursor-pointer shadow-[0_12px_28px_rgba(59,130,246,0.18)]"
                >
                  <span>Entrar no App</span>
                  <ArrowRight size={14} />
                </Link>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-semibold bg-white/5 border border-white/5 px-4.5 py-2.5 rounded-xl">
                  <Lock size={14} />
                  <span>Acesso Restrito</span>
                </div>
              )}
            </div>
          </div>

          {/* Card: Marketing Vision */}
          <div className={`
            bg-white/[0.035] border border-orange-400/15 rounded-2xl p-6.5 flex flex-col justify-between min-h-[260px] relative transition-all duration-300 group shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl
            ${hasMarketingAccess 
              ? 'hover:border-orange-300/30 hover:bg-orange-500/[0.045]' 
              : 'opacity-50'
            }
          `}>
            <div>
              <div className="w-12 h-12 rounded-xl bg-orange-500/12 border border-orange-400/20 text-orange-300 flex items-center justify-center mb-5">
                <TrendingUp size={24} />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-orange-300 transition-colors">
                Marketing Vision
              </h3>
              <p className="text-[11px] text-orange-300/80 font-bold uppercase tracking-wider mt-1">Vendas & Ads</p>
              <p className="text-xs leading-relaxed text-zinc-400 mt-2">
                Métricas e análise comercial do CRM CV, controle completo de leads, oportunidades e perdas, auditoria de campanhas Meta Ads e controle de estoque de unidades.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between">
              {hasMarketingAccess ? (
                <Link
                  href="/marketing-vision"
                  className="flex items-center gap-1.5 text-xs font-bold bg-orange-500/90 hover:bg-orange-400 text-white px-4.5 py-2.5 rounded-xl transition-all duration-200 cursor-pointer shadow-[0_12px_28px_rgba(249,115,22,0.18)]"
                >
                  <span>Entrar no App</span>
                  <ArrowRight size={14} />
                </Link>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-semibold bg-white/5 border border-white/5 px-4.5 py-2.5 rounded-xl">
                  <Lock size={14} />
                  <span>Acesso Restrito</span>
                </div>
              )}
            </div>
          </div>

          {/* Card: People Vision */}
          <div className={`
            bg-white/[0.035] border border-emerald-400/15 rounded-2xl p-6.5 flex flex-col justify-between min-h-[260px] relative transition-all duration-300 group shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl
            ${hasPeopleAccess
              ? 'hover:border-emerald-300/30 hover:bg-emerald-500/[0.045]'
              : 'opacity-50'
            }
          `}>
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-5">
                <Users size={24} />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                People Vision
              </h3>
              <p className="text-[11px] text-emerald-300/80 font-bold uppercase tracking-wider mt-1">Pessoas & Acesso</p>
              <p className="text-xs leading-relaxed text-zinc-400 mt-2">
                Gestão de colaboradores, perfis completos, cadastro via convite com fluxo de aprovação, notificações push e controle de acesso ao sistema.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between">
              {hasPeopleAccess ? (
                <Link
                  href="/people-vision"
                  className="flex items-center gap-1.5 text-xs font-bold bg-emerald-500/90 hover:bg-emerald-400 text-white px-4.5 py-2.5 rounded-xl transition-all duration-200 cursor-pointer shadow-[0_12px_28px_rgba(16,185,129,0.18)]"
                >
                  <span>Entrar no App</span>
                  <ArrowRight size={14} />
                </Link>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-semibold bg-white/5 border border-white/5 px-4.5 py-2.5 rounded-xl">
                  <Lock size={14} />
                  <span>Acesso Restrito</span>
                </div>
              )}
            </div>
          </div>

          {/* Card: Quality Vision */}
          <div className={`
            bg-white/[0.035] border border-violet-400/15 rounded-2xl p-6.5 flex flex-col justify-between min-h-[260px] relative transition-all duration-300 group shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl
            ${hasQualityAccess
              ? 'hover:border-violet-300/30 hover:bg-violet-500/[0.045]'
              : 'opacity-50'
            }
          `}>
            <div>
              <div className="w-12 h-12 rounded-xl bg-violet-500/12 border border-violet-400/20 text-violet-300 flex items-center justify-center mb-5">
                <ClipboardCheck size={24} />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-violet-300 transition-colors">
                Quality Vision
              </h3>
              <p className="text-[11px] text-violet-300/80 font-bold uppercase tracking-wider mt-1">Quality & Obras</p>
              <p className="text-xs leading-relaxed text-zinc-400 mt-2">
                Painel de inspeções e verificações integrado ao Construpoint. Acompanhe fichas FVS, FVM, CHK, SEG, MA e EDU com série histórica, taxas de aprovação e relatórios por obra.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between">
              {hasQualityAccess ? (
                <Link
                  href="/quality-vision"
                  className="flex items-center gap-1.5 text-xs font-bold bg-violet-500/90 hover:bg-violet-400 text-white px-4.5 py-2.5 rounded-xl transition-all duration-200 cursor-pointer shadow-[0_12px_28px_rgba(139,92,246,0.18)]"
                >
                  <span>Entrar no App</span>
                  <ArrowRight size={14} />
                </Link>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-semibold bg-white/5 border border-white/5 px-4.5 py-2.5 rounded-xl">
                  <Lock size={14} />
                  <span>Acesso Restrito</span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer className="text-center relative z-10">
        <p className="text-[11px] text-zinc-600 tracking-wider uppercase font-semibold lg:whitespace-nowrap">
          LongView Empreendimentos • Hauzi Tecnologia • Desenvolvido por Carlos Guru em 06/2026 V.1.
        </p>
      </footer>
    </main>
  );
}
