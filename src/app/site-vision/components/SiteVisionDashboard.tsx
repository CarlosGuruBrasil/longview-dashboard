'use client';

import Link from 'next/link';
import { ArrowRight, BarChart3, Building2, RadioTower, RefreshCw, Users } from 'lucide-react';
import { useOverview, useProjects, useInventory, useAnalytics } from './useSiteVisionData';

function formatSync(value: string | null) {
  if (!value) return 'Sem registro';
  return new Date(value).toLocaleString('pt-BR');
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,27,0.94),rgba(11,14,16,0.96))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</p>
          <p className="mt-2 text-sm text-zinc-400">{helper}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-teal-400/20 bg-teal-500/10 text-teal-300">
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="rounded-[26px] border border-dashed border-white/12 bg-white/[0.025] p-8 text-sm text-zinc-500">{text}</div>;
}

function LoadingSpinner() {
  return <div className="p-6 text-sm text-zinc-400">Carregando Site Vision...</div>;
}

export function SiteVisionDashboard() {
  const overview = useOverview();
  const projects = useProjects();
  const inventory = useInventory();
  const analytics = useAnalytics();

  const isLoading = overview.loading || projects.loading || inventory.loading || analytics.loading;
  const hasError = overview.error || projects.error || inventory.error || analytics.error;

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (hasError || !overview.data || !projects.data || !inventory.data || !analytics.data) {
    return (
      <div className="p-6">
        <div className="max-w-md rounded-[28px] border border-red-500/20 bg-red-500/10 p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <p className="text-base font-semibold text-red-200">Falha ao carregar o módulo</p>
          <p className="mt-2 text-sm leading-relaxed text-red-100/80">{String(hasError) || 'Sem dados disponíveis.'}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-2 text-sm font-medium text-red-100 transition-colors hover:bg-red-400/15"
          >
            <RefreshCw size={14} />
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const siteProjectsCount = projects.data.siteProjects.length;
  const publishedCount = projects.data.siteProjects.filter((p) => p.status === 'published').length;
  const draftCount = projects.data.siteProjects.filter((p) => p.status === 'draft').length;

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6 lg:px-6 lg:py-4">
      <section className="overflow-hidden rounded-[34px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.18),transparent_36%),linear-gradient(180deg,rgba(10,14,15,0.96),rgba(9,9,11,0.98))] p-6 shadow-[0_28px_120px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.04)] md:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full border border-teal-400/15 bg-teal-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-teal-300">
              Site Vision
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-[2.1rem]">
              Controle do site, dos empreendimentos publicados e da equipe visível.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400 md:text-[15px]">
              O Site Vision funciona como cockpit do portal: o empreendimento é o centro, a equipe vem do People Vision e os leads ficam como leitura geral.
            </p>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 self-start rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-2.5 text-sm font-medium text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors hover:bg-white/[0.075]"
          >
            <RefreshCw size={15} />
            Atualizar leitura
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          <MetricCard
            label="Empreendimentos no site"
            value={siteProjectsCount}
            helper={`${publishedCount} publicados • ${draftCount} em preparo`}
            icon={Building2}
          />
          <MetricCard
            label="Leads captados (leitura)"
            value={overview.data.overview.leads}
            helper="Operação comercial no CV CRM e Marketing Vision"
            icon={RadioTower}
          />
          <MetricCard
            label="Eventos rastreados"
            value={analytics.data.analytics.pageViews}
            helper={`${analytics.data.analytics.whatsappClicks} cliques em WhatsApp`}
            icon={BarChart3}
          />
          <MetricCard
            label="Usuários do sistema"
            value={overview.data.overview.users.total}
            helper={`${overview.data.overview.users.corretores} corretores • ${overview.data.overview.users.admins} admins`}
            icon={Users}
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Link
          href="/site-vision/empreendimentos"
          className="group rounded-[28px] border border-white/8 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_48px_rgba(0,0,0,0.22)] transition-colors hover:border-teal-300/20 hover:bg-teal-500/[0.045]"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-base font-semibold text-white">Operar empreendimentos</p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Gerenciar publicação, unidades, materiais e revenda. Cada empreendimento é o centro da operação.
              </p>
            </div>
            <ArrowRight size={18} className="text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-teal-300" />
          </div>
        </Link>

        <Link
          href="/site-vision/equipe"
          className="group rounded-[28px] border border-white/8 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_48px_rgba(0,0,0,0.22)] transition-colors hover:border-teal-300/20 hover:bg-teal-500/[0.045]"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-base font-semibold text-white">Controlar equipe visível</p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Ligar e desligar quais corretores aparecem no site. Dados reutilizados do People Vision.
              </p>
            </div>
            <ArrowRight size={18} className="text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-teal-300" />
          </div>
        </Link>
      </section>

      <section className="grid gap-6 2xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-white">Páginas mais visitadas</p>
            <p className="text-xs text-zinc-500">Comportamento e interesse no portal.</p>
          </div>
          {analytics.data.topPages.length === 0 ? (
            <EmptyPanel text="Aguardando dados de navegação..." />
          ) : (
            <div className="space-y-3">
              {analytics.data.topPages.slice(0, 6).map((page) => (
                <div key={`${page.pageType}-${page.pageKey}`} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{page.pagePath || page.pageKey}</p>
                      <p className="mt-1 text-xs text-zinc-500">{page.pageType} • {page.views} views</p>
                    </div>
                    <p className="text-right text-xs font-medium text-teal-300">{page.uniqueSessions} sessions</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-white">CTAs mais clicadas</p>
            <p className="text-xs text-zinc-500">Engajamento do site.</p>
          </div>
          {analytics.data.topCtas.length === 0 ? (
            <EmptyPanel text="Sem dados ainda..." />
          ) : (
            <div className="space-y-3">
              {analytics.data.topCtas.slice(0, 6).map((cta) => (
                <div key={cta.buttonName} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-white">{cta.buttonName}</p>
                    <p className="text-sm font-semibold text-teal-300">{cta.total}</p>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">últimamente em {formatSync(cta.latest)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
