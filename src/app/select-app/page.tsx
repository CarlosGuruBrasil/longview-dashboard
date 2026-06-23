import { cookies } from 'next/headers';
import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import jwt from 'jsonwebtoken';
import { 
  Building2, 
  TrendingUp, 
  Settings, 
  Lock, 
  ArrowRight,
  LogOut
} from 'lucide-react';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-longview-key';

export default async function SelectAppPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    redirect('/login');
  }

  let user: any = null;
  try {
    user = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    redirect('/login');
  }

  const { role, permissions, name } = user;

  // Verificar permissões
  const isDeveloper = role === 'Desenvolvedor';
  const hasProjectAccess = isDeveloper || permissions?.viewProjectVision === true;
  const hasMarketingAccess = isDeveloper || permissions?.viewMarketingDashboard === true;
  const isAdmin = isDeveloper || permissions?.isAdmin === true;

  return (
    <main
      className="min-h-screen bg-[#09090b] flex flex-col justify-between px-5 pb-8 relative overflow-hidden"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}
    >
      {/* Background Glows */}
      <div className="absolute top-[-30%] left-[-20%] w-[800px] h-[800px] rounded-full bg-orange-500/5 blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-30%] right-[-20%] w-[800px] h-[800px] rounded-full bg-blue-500/5 blur-[160px] pointer-events-none" />

      {/* Header */}
      <header className="flex justify-between items-center max-w-5xl w-full mx-auto relative z-10">
        <div className="relative w-36 h-10 flex items-center">
          <Image
            src="/logolongview.png"
            alt="LongView"
            fill
            className="object-contain object-left"
          />
        </div>
        
        <div className="flex items-center gap-4">
          {isAdmin && (
            <Link
              href="/admin/users"
              className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white bg-white/5 border border-white/10 hover:border-white/20 rounded-xl px-4 py-2 transition-all duration-200"
            >
              <Settings size={14} />
              <span>Painel Admin</span>
            </Link>
          )}
          
          <a
            href="/api/auth/logout"
            className="flex items-center gap-1.5 text-xs font-bold text-red-400 hover:text-red-300 bg-red-500/5 border border-red-500/10 hover:border-red-500/20 rounded-xl px-4 py-2 transition-all duration-200"
          >
            <LogOut size={14} />
            <span>Sair</span>
          </a>
        </div>
      </header>

      {/* Corpo Central */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-5xl w-full mx-auto relative z-10 my-8">
        <div className="text-center mb-10 max-w-lg">
          <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded bg-white/5 border border-white/10 text-zinc-400">
            Ambiente Integrado
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-3">
            Olá, {name}
          </h2>
          <p className="text-sm text-zinc-400 mt-1.5">
            Selecione qual aplicativo deseja acessar no momento de acordo com suas liberações:
          </p>
        </div>

        {/* Grid dos Cards de Aplicativos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-[840px]">
          
          {/* Card: Project Vision */}
          <div className={`
            bg-[#121214]/40 border border-[#1e1e22] rounded-2xl p-6.5 flex flex-col justify-between min-h-[260px] relative transition-all duration-300 group
            ${hasProjectAccess 
              ? 'hover:border-zinc-500 hover:shadow-[0_4px_24px_rgba(255,255,255,0.02)]' 
              : 'opacity-50'
            }
          `}>
            <div>
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mb-5">
                <Building2 size={24} />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-orange-400 transition-colors">
                Project Vision
              </h3>
              <p className="text-xs leading-relaxed text-zinc-400 mt-2">
                Acompanhamento e gestão de projetos, rotas operacionais, status de contratações, cronograma de obras, Kanbans e andamentos das tarefas LongView.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between">
              {hasProjectAccess ? (
                <Link
                  href="/project-vision"
                  className="flex items-center gap-1.5 text-xs font-bold bg-white text-black hover:bg-zinc-200 px-4.5 py-2.5 rounded-xl transition-all duration-200 cursor-pointer"
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
              <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
                Gestão & Cronograma
              </span>
            </div>
          </div>

          {/* Card: Marketing Vision */}
          <div className={`
            bg-[#121214]/40 border border-[#1e1e22] rounded-2xl p-6.5 flex flex-col justify-between min-h-[260px] relative transition-all duration-300 group
            ${hasMarketingAccess 
              ? 'hover:border-zinc-500 hover:shadow-[0_4px_24px_rgba(255,255,255,0.02)]' 
              : 'opacity-50'
            }
          `}>
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-5">
                <TrendingUp size={24} />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                Marketing Vision
              </h3>
              <p className="text-xs leading-relaxed text-zinc-400 mt-2">
                Métricas e análise comercial do CRM CV, controle completo de leads, oportunidades e perdas, auditoria de campanhas Meta Ads e controle de estoque de unidades.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between">
              {hasMarketingAccess ? (
                <Link
                  href="/marketing-vision"
                  className="flex items-center gap-1.5 text-xs font-bold bg-white text-black hover:bg-zinc-200 px-4.5 py-2.5 rounded-xl transition-all duration-200 cursor-pointer"
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
              <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
                Vendas & Ads
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer className="text-center relative z-10">
        <p className="text-[10px] text-zinc-600 tracking-wider uppercase font-semibold">
          LongView Empreendimentos • Hauzi Tecnologia
        </p>
      </footer>
    </main>
  );
}
