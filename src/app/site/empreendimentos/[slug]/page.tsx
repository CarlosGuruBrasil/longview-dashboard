import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublishedProjectBySlug } from '@/lib/site-public';
import { PublicLeadForm } from '../../components/PublicLeadForm';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const project = await getPublishedProjectBySlug(slug);
  if (!project) {
    return { title: 'Empreendimento não encontrado' };
  }
  return {
    title: `${project.displayName} | LongView`,
    description: project.shortDescription || project.headline || project.resumo || `Detalhes públicos do empreendimento ${project.displayName}.`,
  };
}

export default async function PublicProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await getPublishedProjectBySlug(slug);

  if (!project) notFound();

  return (
    <main className="min-h-screen bg-[#071013] text-white">
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
          <Link href="/site" className="text-sm font-semibold text-teal-300">
            Voltar para o site
          </Link>
          <div className="mt-6 grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-300">Empreendimento publicado</p>
              {project.logoUrl ? (
                <div className="relative mt-4 h-14 w-48">
                  <Image src={project.logoUrl} alt={project.displayName} fill className="object-contain object-left" unoptimized />
                </div>
              ) : null}
              <h1 className="mt-3 text-4xl font-semibold tracking-tight">{project.displayName}</h1>
              <p className="mt-2 text-sm text-zinc-400">{project.locationLabel || project.addressLine}</p>
              <p className="mt-3 text-base text-zinc-300">{project.shortDescription || project.headline || project.resumo}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Disponíveis</p>
                  <p className="mt-2 text-2xl font-semibold">{project.stats.availableUnits}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Reservadas</p>
                  <p className="mt-2 text-2xl font-semibold">{project.stats.reservedUnits}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Vendidas</p>
                  <p className="mt-2 text-2xl font-semibold">{project.stats.soldUnits}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Estágio</p>
                  <p className="mt-2 text-lg font-semibold">{project.stageLabel || 'Em atualização'}</p>
                </div>
              </div>
            </div>

            <PublicLeadForm empreendimentoId={project.id} empreendimentoNome={project.nome} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
        <div className="relative h-[340px] overflow-hidden rounded-[30px] border border-white/10 bg-zinc-900">
          {project.detailHeroImageUrl ? (
            <Image src={project.detailHeroImageUrl} alt={project.displayName} fill className="object-cover" unoptimized />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">Sem imagem hero configurada</div>
          )}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 pb-16 lg:grid-cols-[1fr_0.8fr] lg:px-10">
        <div className="space-y-8">
          <article className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-2xl font-semibold">Visão geral</h2>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-400">
              {project.deliveryLabel ? <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">{project.deliveryLabel}</span> : null}
              {project.stageLabel ? <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">{project.stageLabel}</span> : null}
              {project.addressLine ? <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">{project.addressLine}</span> : null}
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-zinc-300">{project.descricao || project.resumo || 'Conteúdo institucional em preparação.'}</p>
          </article>

          <article className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-2xl font-semibold">Ficha rápida</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {project.specs.length > 0 ? project.specs.map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{item.label}</p>
                  <p className="mt-2 text-sm font-semibold text-white">{item.value}</p>
                </div>
              )) : <p className="text-sm text-zinc-500">A ficha editorial ainda não foi consolidada no Site Vision.</p>}
            </div>
          </article>

          <article className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-2xl font-semibold">Diferenciais</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {project.highlights.length > 0 ? project.highlights.map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
                  {item}
                </div>
              )) : <p className="text-sm text-zinc-500">Os diferenciais ainda não foram detalhados no Site Vision.</p>}
            </div>
          </article>

          <article className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-2xl font-semibold">Galeria</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {project.mediaAssets.length > 0 ? project.mediaAssets.map((asset) => (
                <div key={asset.id} className="overflow-hidden rounded-[24px] border border-white/10 bg-[#0b1416]">
                  <div className="relative h-56">
                    {asset.publicUrl ? (
                      <Image src={asset.publicUrl} alt={asset.altText || asset.title || project.nome} fill className="object-cover" unoptimized />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-zinc-500">Sem URL de mídia</div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-semibold text-white">{asset.title || 'Mídia do empreendimento'}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-zinc-500">{asset.kind}</p>
                  </div>
                </div>
              )) : <p className="text-sm text-zinc-500">A galeria pública ainda não recebeu mídias publicadas.</p>}
            </div>
          </article>

          <article className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-2xl font-semibold">Unidades visíveis no site</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {project.visibleUnits.length > 0 ? project.visibleUnits.map((unit) => (
                <div key={unit.id} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{unit.tipologia || 'Unidade'} {unit.numero ? `• ${unit.numero}` : ''}</p>
                      <p className="mt-1 text-xs text-zinc-500">{[unit.bloco ? `Bloco ${unit.bloco}` : '', unit.areaPrivativa ? `${unit.areaPrivativa} m²` : '', unit.parkingSpaces ? `${unit.parkingSpaces} vaga(s)` : ''].filter(Boolean).join(' • ')}</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-zinc-300">{unit.statusLabel}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-400">
                    {unit.bedrooms ? <span>{unit.bedrooms} dorms.</span> : null}
                    {unit.suites ? <span>{unit.suites} suítes</span> : null}
                  </div>
                  <p className="mt-4 text-sm font-semibold text-teal-300">{unit.priceLabel}</p>
                </div>
              )) : <p className="text-sm text-zinc-500">Nenhuma unidade visível foi preparada para exibição pública.</p>}
            </div>
          </article>
        </div>

        <div className="space-y-8">
          <article className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-2xl font-semibold">Materiais capturados</h2>
            <div className="mt-5 space-y-3">
              {project.gatedAssets.length > 0 ? project.gatedAssets.map((asset) => (
                <a key={asset.id} href={asset.publicUrl} target="_blank" rel="noreferrer" className="block rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <p className="text-sm font-semibold text-white">{asset.title}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-zinc-500">{asset.type}</p>
                </a>
              )) : <p className="text-sm text-zinc-500">Nenhum material gated ativo para este empreendimento.</p>}
            </div>
          </article>

          <article className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-2xl font-semibold">Revendas publicadas</h2>
            <div className="mt-5 space-y-3">
              {project.resales.length > 0 ? project.resales.map((resale) => (
                <div key={resale.id} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <p className="text-sm font-semibold text-white">{resale.title}</p>
                  <p className="mt-1 text-sm text-zinc-400">{resale.brokerName || 'Corretor em definição'}</p>
                  <p className="mt-2 text-sm text-teal-300">
                    {resale.price != null
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(resale.price)
                      : 'Preço sob consulta'}
                  </p>
                </div>
              )) : <p className="text-sm text-zinc-500">Nenhuma revenda publicada para este empreendimento.</p>}
            </div>
          </article>

          <article className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-2xl font-semibold">Canais do empreendimento</h2>
            <div className="mt-5 space-y-3">
              {project.clientPortalUrl ? (
                <a href={project.clientPortalUrl} target="_blank" rel="noreferrer" className="block rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white">
                  Portal do cliente
                </a>
              ) : null}
              {project.technicalAssistUrl ? (
                <a href={project.technicalAssistUrl} target="_blank" rel="noreferrer" className="block rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white">
                  Assistência técnica
                </a>
              ) : null}
              {!project.clientPortalUrl && !project.technicalAssistUrl ? (
                <p className="text-sm text-zinc-500">Os canais complementares ainda não foram configurados neste empreendimento.</p>
              ) : null}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
