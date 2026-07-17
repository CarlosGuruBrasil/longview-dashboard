import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { listPublicTeamMembers, listPublishedProjects } from '@/lib/site-public';
import { PublicLeadForm } from './components/PublicLeadForm';

export const metadata: Metadata = {
  title: 'LongView Site',
  description: 'Empreendimentos publicados, equipe e captação comercial do ecossistema LongView.',
};

export default async function PublicSiteHomePage() {
  const [projects, team] = await Promise.all([listPublishedProjects(), listPublicTeamMembers()]);
  const featured = projects.filter((item) => item.destaque).slice(0, 3);
  const visibleProjects = (featured.length > 0 ? featured : projects.filter((item) => item.exibirNaHome)).slice(0, 6);

  return (
    <main className="min-h-screen bg-[#071013] text-white">
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.22),transparent_34%),linear-gradient(180deg,#0b1619_0%,#071013_100%)]">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-300">Site Vision conectado</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
                Um site público real, abastecido pela operação do Site Vision.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-300">
                Essa vitrine agora consome a camada publicada do ecossistema LongView, sem depender do raw do CRM.
                Empreendimentos, equipe e captação comercial passam a conversar pela mesma estrutura.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="#empreendimentos" className="rounded-full bg-teal-400 px-5 py-3 text-sm font-semibold text-zinc-950">
                  Ver empreendimentos
                </Link>
                <Link href="/site/equipe" className="rounded-full border border-white/12 px-5 py-3 text-sm font-semibold text-white">
                  Conhecer equipe
                </Link>
              </div>
            </div>
            <PublicLeadForm />
          </div>
        </div>
      </section>

      <section id="empreendimentos" className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Portfólio publicado</p>
            <h2 className="mt-2 text-3xl font-semibold">Empreendimentos disponíveis no site</h2>
          </div>
          <p className="text-sm text-zinc-400">{projects.length} páginas publicadas via Site Vision</p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {visibleProjects.map((project) => (
            <article key={project.id} className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03]">
              <div className="relative h-56 bg-zinc-900">
                {project.cardHeroImageUrl ? (
                  <Image src={project.cardHeroImageUrl} alt={project.displayName} fill className="object-cover" unoptimized />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-zinc-500">Sem imagem principal</div>
                )}
              </div>
              <div className="space-y-4 p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-3">
                      {project.logoUrl ? (
                        <div className="relative h-10 w-20">
                          <Image src={project.logoUrl} alt={project.displayName} fill className="object-contain object-left" unoptimized />
                        </div>
                      ) : null}
                      <h3 className="text-xl font-semibold text-white">{project.displayName}</h3>
                    </div>
                    <p className="mt-1 text-sm text-zinc-400">{project.locationLabel || 'Localização em definição'}</p>
                  </div>
                  {project.destaque ? (
                    <span className="rounded-full border border-teal-400/20 bg-teal-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-teal-300">
                      Destaque
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
                  {project.stageLabel ? <span>{project.stageLabel}</span> : null}
                  {project.deliveryLabel ? <span>{project.deliveryLabel}</span> : null}
                </div>
                <p className="text-sm leading-relaxed text-zinc-300">{project.shortDescription || project.headline || project.resumo || 'Conteúdo em preparação.'}</p>
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>{project.mediaCount} mídia(s)</span>
                  <span>{project.publishedAt ? new Date(project.publishedAt).toLocaleDateString('pt-BR') : 'Publicado'}</span>
                </div>
                <Link href={`/site/empreendimentos/${project.slug}`} className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-950">
                  {project.ctaLabel || 'Ver detalhes'}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Equipe visível</p>
              <h2 className="mt-2 text-3xl font-semibold">Corretores e consultores publicados</h2>
            </div>
            <Link href="/site/equipe" className="text-sm font-semibold text-teal-300">
              Ver equipe completa
            </Link>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {team.slice(0, 6).map((member) => (
              <article key={member.id} className="rounded-[24px] border border-white/10 bg-[#0b1416] p-5">
                <div className="flex items-center gap-4">
                  {member.avatarUrl ? (
                    <Image src={member.avatarUrl} alt={member.name} width={56} height={56} className="h-14 w-14 rounded-2xl object-cover" unoptimized />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/10 text-sm font-bold text-teal-300">
                      {member.name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-base font-semibold text-white">{member.name}</h3>
                    <p className="mt-1 text-sm text-zinc-400">{member.position}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
