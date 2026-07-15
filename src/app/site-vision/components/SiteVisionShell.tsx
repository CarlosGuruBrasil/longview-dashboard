'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  Database,
  Image as ImageIcon,
  LayoutTemplate,
  Link2,
  RadioTower,
  RefreshCw,
  ShieldCheck,
  Siren,
  Users2,
  Workflow,
} from 'lucide-react';
import { useSiteVision, type SiteVisionPayload } from './useSiteVision';

function formatSync(value: string | null) {
  if (!value) return 'Sem registro';
  return new Date(value).toLocaleString('pt-BR');
}

function publicationTone(status: 'draft' | 'published' | 'archived') {
  if (status === 'published') return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300';
  if (status === 'archived') return 'border-zinc-400/20 bg-zinc-500/10 text-zinc-300';
  return 'border-amber-400/20 bg-amber-500/10 text-amber-200';
}

function publicationLabel(status: 'draft' | 'published' | 'archived') {
  if (status === 'published') return 'Publicado';
  if (status === 'archived') return 'Arquivado';
  return 'Rascunho';
}

function runTone(status: 'success' | 'warning' | 'error' | 'running') {
  if (status === 'success') return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300';
  if (status === 'running') return 'border-sky-400/20 bg-sky-500/10 text-sky-300';
  if (status === 'warning') return 'border-amber-400/20 bg-amber-500/10 text-amber-200';
  return 'border-red-400/20 bg-red-500/10 text-red-300';
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

function IntegrationBadge({ status }: { status: string }) {
  const tone =
    status === 'online'
      ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300'
      : status === 'warning'
        ? 'border-amber-400/20 bg-amber-500/10 text-amber-200'
        : 'border-red-400/20 bg-red-500/10 text-red-300';

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${tone}`}>
      {status === 'online' ? 'Online' : status === 'warning' ? 'Atencao' : 'Offline'}
    </span>
  );
}

function IntegrationGrid({ data }: { data: SiteVisionPayload }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {data.integrations.map((item) => (
        <div
          key={item.key}
          className="rounded-[26px] border border-white/8 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_48px_rgba(0,0,0,0.22)]"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">{item.label}</p>
            <IntegrationBadge status={item.status} />
          </div>
          <p className="mt-4 text-lg font-semibold text-zinc-100">{item.value}</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.description}</p>
        </div>
      ))}
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="rounded-[26px] border border-dashed border-white/12 bg-white/[0.025] p-8 text-sm text-zinc-500">
      {text}
    </div>
  );
}

function SitePortfolioCards({ items }: { items: SiteVisionPayload['sitePortfolio'] }) {
  if (items.length === 0) {
    return <EmptyPanel text="Nenhum empreendimento do site foi cadastrado ainda nas tabelas dedicadas do namespace site_public." />;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {items.map((project) => (
        <div key={project.id} className="rounded-[26px] border border-white/8 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_48px_rgba(0,0,0,0.22)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-white">{project.nome}</p>
                {project.destaque ? (
                  <span className="rounded-full border border-teal-400/15 bg-teal-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-teal-300">
                    Destaque
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-zinc-400">
                /{project.slug}
                {project.bairro || project.cidade ? ` • ${[project.bairro, project.cidade].filter(Boolean).join(' / ')}` : ''}
              </p>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${publicationTone(project.status)}`}>
              {publicationLabel(project.status)}
            </span>
          </div>

          <div className="mt-5 grid gap-3 text-sm text-zinc-300 md:grid-cols-2">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Midias</p>
              <p className="mt-2 text-lg font-semibold text-white">{project.mediaCount}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">CRM</p>
              <p className="mt-2 text-sm font-semibold text-white">{project.crmNome || 'Sem vinculo'}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
            <span>{project.heroImageUrl ? 'Hero definida' : 'Sem hero image'}</span>
            <span>Atualizado em {formatSync(project.updatedAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function CrmPortfolioCards({ items }: { items: SiteVisionPayload['crmPortfolio'] }) {
  if (items.length === 0) {
    return <EmptyPanel text="Nenhum empreendimento sincronizado do CV CRM apareceu nesta leitura." />;
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {items.map((item) => (
        <div key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{item.nome}</p>
              <p className="mt-1 text-xs text-zinc-500">{item.tipo || 'Tipo nao informado'}</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-300">
              {item.situacao || 'Sem situacao'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function WarningGrid({ items }: { items: SiteVisionPayload['contentWarnings'] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {items.map((item) => (
        <div key={item.key} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">{item.label}</p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.description}</p>
            </div>
            <div className="flex h-12 min-w-12 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3 text-lg font-semibold text-amber-200">
              {item.total}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LeadStatusList({ items }: { items: Array<{ status: string; total: number }> }) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">Sem leitura disponivel nesta base.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.status} className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
          <span className="text-sm text-zinc-300">{item.status}</span>
          <span className="text-sm font-semibold text-white">{item.total}</span>
        </div>
      ))}
    </div>
  );
}

function SyncRuns({ items }: { items: SiteVisionPayload['syncRuns'] }) {
  if (items.length === 0) {
    return <EmptyPanel text="Nenhuma sincronizacao do site foi registrada ainda." />;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">{item.integration}</p>
              <p className="mt-1 text-xs text-zinc-500">{item.scope || 'Escopo geral'}</p>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${runTone(item.status)}`}>
              {item.status}
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">{item.summary || 'Sem resumo informado.'}</p>
          <p className="mt-3 text-xs text-zinc-500">{formatSync(item.createdAt)}</p>
        </div>
      ))}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-5 py-4 text-sm text-zinc-400">
        Carregando Site Vision...
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="max-w-md rounded-[28px] border border-red-500/20 bg-red-500/10 p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <p className="text-base font-semibold text-red-200">Falha ao carregar o modulo</p>
        <p className="mt-2 text-sm leading-relaxed text-red-100/80">{message}</p>
        <button
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-2 text-sm font-medium text-red-100 transition-colors hover:bg-red-400/15"
        >
          <RefreshCw size={14} />
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

function QuickActions() {
  const items = [
    {
      href: '/site-vision/empreendimentos',
      label: 'Portifolio publicado',
      description: 'Ver rascunhos, paginas publicadas, midias e vinculos com o CV CRM.',
      icon: LayoutTemplate,
    },
    {
      href: '/site-vision/leads',
      label: 'Leads do site',
      description: 'Acompanhar captação, fila de envio e saude do repasse comercial.',
      icon: RadioTower,
    },
    {
      href: '/site-vision/integracoes',
      label: 'Integracoes',
      description: 'Validar a camada dedicada do site, CRM, Meta e sincronizacoes operacionais.',
      icon: Workflow,
    },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-[26px] border border-white/8 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_48px_rgba(0,0,0,0.22)] transition-colors hover:border-teal-300/20 hover:bg-teal-500/[0.045]"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-teal-400/20 bg-teal-500/10 text-teal-300">
                <Icon size={19} />
              </div>
              <ArrowRight size={15} className="text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-teal-300" />
            </div>
            <p className="mt-5 text-base font-semibold text-white">{item.label}</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.description}</p>
          </Link>
        );
      })}
    </div>
  );
}

function SiteVisionFrame({
  loading,
  error,
  reload,
  data,
  children,
}: {
  loading: boolean;
  error: string;
  reload: () => void;
  data: SiteVisionPayload | null;
  children: (data: SiteVisionPayload) => React.ReactNode;
}) {
  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error || 'Sem dados disponiveis.'} onRetry={reload} />;
  return <>{children(data)}</>;
}

export function SiteVisionOverview() {
  const { data, loading, error, reload } = useSiteVision();

  return (
    <SiteVisionFrame loading={loading} error={error} reload={reload} data={data}>
      {(site) => (
        <div className="flex-1 space-y-6 p-4 md:p-6 lg:px-6 lg:py-4">
          <section className="overflow-hidden rounded-[34px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.18),transparent_36%),linear-gradient(180deg,rgba(10,14,15,0.96),rgba(9,9,11,0.98))] p-6 shadow-[0_28px_120px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.04)] md:p-7">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <span className="inline-flex rounded-full border border-teal-400/15 bg-teal-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-teal-300">
                  Site Vision
                </span>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-[2.1rem]">
                  O site agora tem um nucleo proprio dentro do dashboard e do mesmo Postgres.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400 md:text-[15px]">
                  Este modulo centraliza conteudo publicado, midias, leads do portal, vinculo com CRM e a saude das integracoes que sustentam a operacao comercial da LongView.
                </p>
              </div>

              <button
                onClick={reload}
                className="inline-flex items-center gap-2 self-start rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-2.5 text-sm font-medium text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors hover:bg-white/[0.075]"
              >
                <RefreshCw size={15} />
                Atualizar leitura
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
              <MetricCard label="Paginas no site" value={site.overview.siteProjects} helper={`${site.overview.publishedProjects} publicadas • ${site.overview.draftProjects} rascunhos`} icon={LayoutTemplate} />
              <MetricCard label="Midias cadastradas" value={site.overview.mediaAssets} helper="Galerias, materiais e ativos ligados ao portal" icon={ImageIcon} />
              <MetricCard label="Leads do site" value={site.overview.siteLeads} helper={`${site.overview.pendingSiteLeads} aguardando operacao`} icon={RadioTower} />
              <MetricCard label="Camada do site" value={site.schema.siteTables} helper={site.schema.siteReady ? 'Estrutura pronta no Postgres' : 'Estrutura criada e aguardando populacao'} icon={Database} />
            </div>
          </section>

          <QuickActions />

          <section className="grid gap-6 2xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-white">Portifolio do site</p>
                <p className="text-xs text-zinc-500">Leitura real das tabelas dedicadas do site para as paginas publicadas e seus rascunhos.</p>
              </div>
              <SitePortfolioCards items={site.sitePortfolio} />
            </div>

            <div className="space-y-4">
              <div className="rounded-[26px] border border-white/8 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_48px_rgba(0,0,0,0.22)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Ultimas leituras</p>
                    <p className="text-xs text-zinc-500">Ritmo de atualizacao do site e do espelho comercial.</p>
                  </div>
                  <Workflow size={16} className="text-teal-300" />
                </div>
                <div className="mt-4 space-y-3 text-sm text-zinc-400">
                  <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                    <span>Conteudo do site</span>
                    <span className="text-right text-zinc-200">{formatSync(site.timestamps.siteContentSyncAt)}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                    <span>Leads do portal</span>
                    <span className="text-right text-zinc-200">{formatSync(site.timestamps.latestSiteLeadAt)}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                    <span>Despacho para CV CRM</span>
                    <span className="text-right text-zinc-200">{formatSync(site.timestamps.latestLeadDispatchAt)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-[26px] border border-white/8 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_48px_rgba(0,0,0,0.22)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Fila de leads do site</p>
                    <p className="text-xs text-zinc-500">Status persistido do fluxo de captacao do portal.</p>
                  </div>
                  <RadioTower size={16} className="text-teal-300" />
                </div>
                <div className="mt-4">
                  <LeadStatusList items={site.siteLeadStatus} />
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-4">
              <p className="text-sm font-semibold text-white">Pontos de atencao</p>
              <p className="text-xs text-zinc-500">O que falta para o site ficar consistente, rapido e pronto para producao.</p>
            </div>
            <WarningGrid items={site.contentWarnings} />
          </section>
        </div>
      )}
    </SiteVisionFrame>
  );
}

export function SiteVisionEmpreendimentos() {
  const { data, loading, error, reload } = useSiteVision();

  return (
    <SiteVisionFrame loading={loading} error={error} reload={reload} data={data}>
      {(site) => (
        <div className="flex-1 space-y-6 p-4 md:p-6 lg:px-6 lg:py-4">
          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            <MetricCard label="Empreendimentos do site" value={site.overview.siteProjects} helper="Base editorial do portal" icon={LayoutTemplate} />
            <MetricCard label="Publicados" value={site.overview.publishedProjects} helper="Ja visiveis para o publico" icon={Building2} />
            <MetricCard label="Vinculados ao CRM" value={site.overview.linkedCrmProjects} helper="Com relacao direta com o CV CRM" icon={Link2} />
            <MetricCard label="Midias" value={site.overview.mediaAssets} helper="Ativos de imagem, video e material" icon={ImageIcon} />
          </section>

          <section className="rounded-[30px] border border-white/8 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_48px_rgba(0,0,0,0.22)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">Portfolio publicado e rascunhos</p>
                <p className="text-xs text-zinc-500">Cada card abaixo vem da camada dedicada do site e mostra a prontidao do portal.</p>
              </div>
              <span className="rounded-full border border-teal-400/15 bg-teal-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-teal-300">
                {site.schema.siteReady ? 'Estrutura ativa' : 'Em configuracao'}
              </span>
            </div>
            <div className="mt-5">
              <SitePortfolioCards items={site.sitePortfolio} />
            </div>
          </section>

          <section className="rounded-[30px] border border-white/8 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_48px_rgba(0,0,0,0.22)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">Pendencias editoriais</p>
                <p className="text-xs text-zinc-500">O que ainda impede uma apresentacao premium e consistente do portal.</p>
              </div>
              <Siren size={16} className="text-amber-200" />
            </div>
            <div className="mt-5">
              <WarningGrid items={site.contentWarnings} />
            </div>
          </section>

          <section className="rounded-[30px] border border-white/8 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_48px_rgba(0,0,0,0.22)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">Espelho CV CRM</p>
                <p className="text-xs text-zinc-500">Referencia de portifolio que pode alimentar o conteudo comercial do site.</p>
              </div>
              <Link href="/marketing-vision" className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-300 hover:text-teal-200">
                Abrir Marketing Vision
              </Link>
            </div>
            <div className="mt-5">
              <CrmPortfolioCards items={site.crmPortfolio} />
            </div>
          </section>
        </div>
      )}
    </SiteVisionFrame>
  );
}

export function SiteVisionLeads() {
  const { data, loading, error, reload } = useSiteVision();

  return (
    <SiteVisionFrame loading={loading} error={error} reload={reload} data={data}>
      {(site) => (
        <div className="flex-1 space-y-6 p-4 md:p-6 lg:px-6 lg:py-4">
          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            <MetricCard label="Leads do site" value={site.overview.siteLeads} helper="Captacao persistida na camada dedicada do portal" icon={RadioTower} />
            <MetricCard label="Pendentes" value={site.overview.pendingSiteLeads} helper="Ainda aguardando tratamento ou envio" icon={Workflow} />
            <MetricCard label="Entregues ao CRM" value={site.overview.deliveredSiteLeads} helper="Ja roteados comercialmente" icon={Link2} />
            <MetricCard label="Falhas" value={site.overview.failedSiteLeads} helper="Demandam revisao do fluxo ou da integracao" icon={Siren} />
          </section>

          <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[30px] border border-white/8 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_48px_rgba(0,0,0,0.22)]">
              <p className="text-sm font-semibold text-white">Fila do site</p>
              <p className="mt-1 text-xs text-zinc-500">Status atual das submissões captadas pelo portal.</p>
              <div className="mt-5">
                <LeadStatusList items={site.siteLeadStatus} />
              </div>
            </div>

            <div className="rounded-[30px] border border-white/8 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_48px_rgba(0,0,0,0.22)]">
              <p className="text-sm font-semibold text-white">Contexto comercial amplo</p>
              <p className="mt-1 text-xs text-zinc-500">Leitura do funil geral do dashboard para cruzar a captacao do site com a operacao interna.</p>
              <div className="mt-5">
                <LeadStatusList items={site.leadStatus} />
              </div>
            </div>
          </section>

          <section className="rounded-[30px] border border-white/8 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_48px_rgba(0,0,0,0.22)]">
            <p className="text-sm font-semibold text-white">Fluxo operacional recomendado</p>
            <div className="mt-5 space-y-3">
              {[
                `Lead entra no site e vai para a tabela site_public_lead_submissions.`,
                `Backend valida origem, payload e entrega ao CV CRM.`,
                `Marketing Vision e a base principal continuam sendo a camada de acompanhamento da conversao.`,
                `People Vision governa quem pode operar o modulo e revisar a fila comercial.`,
              ].map((text, index) => (
                <div key={text} className="flex gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-500/12 text-xs font-bold text-teal-300">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-relaxed text-zinc-300">{text}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              {[
                `Ultimo lead recebido: ${formatSync(site.timestamps.latestSiteLeadAt)}`,
                `Ultimo despacho ao CRM: ${formatSync(site.timestamps.latestLeadDispatchAt)}`,
                `Ultima sincronizacao geral de leads: ${formatSync(site.timestamps.leadsSyncAt)}`,
              ].map((text) => (
                <div key={text} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
                  {text}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </SiteVisionFrame>
  );
}

export function SiteVisionIntegracoes() {
  const { data, loading, error, reload } = useSiteVision();

  return (
    <SiteVisionFrame loading={loading} error={error} reload={reload} data={data}>
      {(site) => (
        <div className="flex-1 space-y-6 p-4 md:p-6 lg:px-6 lg:py-4">
          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            <MetricCard label="Tabelas do site" value={site.schema.siteTables} helper="Estrutura isolada do portal no mesmo banco" icon={Database} />
            <MetricCard label="Empreendimentos com CRM" value={site.overview.linkedCrmProjects} helper="Paginas que ja se conectam ao espelho comercial" icon={Link2} />
            <MetricCard label="Leads pendentes" value={site.overview.pendingSiteLeads} helper="Backlog atual da captacao do site" icon={RadioTower} />
            <MetricCard label="Admins com acesso" value={site.userBreakdown.admins} helper="Pessoas aptas a operar o modulo" icon={ShieldCheck} />
          </section>

          <section>
            <div className="mb-4">
              <p className="text-sm font-semibold text-white">Matriz de integracoes</p>
              <p className="text-xs text-zinc-500">Cada conector abaixo afeta a consistencia do site, do CRM e da captacao.</p>
            </div>
            <IntegrationGrid data={site} />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-[30px] border border-white/8 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_48px_rgba(0,0,0,0.22)]">
              <p className="text-sm font-semibold text-white">Sincronizacoes registradas</p>
              <p className="mt-1 text-xs text-zinc-500">Historico tecnico para validar operacao e investigacao de falhas.</p>
              <div className="mt-5">
                <SyncRuns items={site.syncRuns} />
              </div>
            </div>

            <div className="rounded-[30px] border border-white/8 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_48px_rgba(0,0,0,0.22)]">
              <p className="text-sm font-semibold text-white">Pontos de controle</p>
              <div className="mt-5 grid gap-3">
                {[
                  `Conteudo do site atualizado em: ${formatSync(site.timestamps.siteContentSyncAt)}`,
                  `Leads do portal sincronizados em: ${formatSync(site.timestamps.latestLeadDispatchAt)}`,
                  `Estoque espelhado do CRM atualizado em: ${formatSync(site.timestamps.estoqueSyncAt)}`,
                  `Schema pronto para operar: ${site.schema.siteReady ? 'sim' : 'nao'}`,
                ].map((text) => (
                  <div key={text} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
                    {text}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </SiteVisionFrame>
  );
}

export function SiteVisionAccess() {
  const { data, loading, error, reload } = useSiteVision();

  return (
    <SiteVisionFrame loading={loading} error={error} reload={reload} data={data}>
      {(site) => (
        <div className="flex-1 space-y-6 p-4 md:p-6 lg:px-6 lg:py-4">
          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            <MetricCard label="Usuarios totais" value={site.userBreakdown.total} helper="Pessoas ligadas ao ecossistema LongView" icon={Users2} />
            <MetricCard label="Admins" value={site.userBreakdown.admins} helper="Perfis com poder ampliado no modulo" icon={ShieldCheck} />
            <MetricCard label="Corretores" value={site.userBreakdown.corretores} helper="Operacao comercial vinculada ao funil" icon={RadioTower} />
            <MetricCard label="Parceiros" value={site.userBreakdown.parceiros} helper="Rede indireta ligada ao atendimento" icon={Link2} />
          </section>

          <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[30px] border border-white/8 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_48px_rgba(0,0,0,0.22)]">
              <p className="text-sm font-semibold text-white">Governanca do modulo</p>
              <div className="mt-5 space-y-3 text-sm leading-relaxed text-zinc-300">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  Site Vision tem permissao propria para separar o admin do site da operacao dos outros modulos.
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  O conteudo do portal vive em tabelas dedicadas no mesmo Postgres, evitando outro banco paralelo e diminuindo risco operacional.
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  O cadastro de usuarios continua centralizado no People Vision, enquanto o Site Vision assume a coordenacao da camada publica.
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-white/8 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_48px_rgba(0,0,0,0.22)]">
              <p className="text-sm font-semibold text-white">Acoes rapidas</p>
              <div className="mt-5 grid gap-3">
                {[
                  {
                    href: '/people-vision',
                    title: 'Gerenciar colaboradores e parceiros',
                    text: 'Abrir o modulo de pessoas para convite, edicao e revisao de permissoes.',
                  },
                  {
                    href: '/site-vision/integracoes',
                    title: 'Revisar saude das integracoes',
                    text: 'Conferir a camada do site, CRM, Meta e historico das sincronizacoes.',
                  },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 transition-colors hover:border-teal-300/20 hover:bg-teal-500/[0.045]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-white">{item.title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-zinc-400">{item.text}</p>
                      </div>
                      <ArrowRight size={15} className="mt-0.5 text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-teal-300" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </SiteVisionFrame>
  );
}
