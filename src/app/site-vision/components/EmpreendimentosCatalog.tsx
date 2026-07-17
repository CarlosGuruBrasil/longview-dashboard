'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Building2, FileImage, Layers3, MapPin, Sparkles } from 'lucide-react';
import { useSiteVisionPortfolio } from './useSiteVisionPortfolio';

function statusLabel(status: 'draft' | 'published' | 'archived' | null) {
  if (status === 'published') return 'Publicado';
  if (status === 'archived') return 'Arquivado';
  return 'Em preparo';
}

function statusTone(status: 'draft' | 'published' | 'archived' | null) {
  if (status === 'published') return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300';
  if (status === 'archived') return 'border-zinc-400/20 bg-zinc-500/10 text-zinc-300';
  return 'border-amber-400/20 bg-amber-500/10 text-amber-200';
}

export function EmpreendimentosCatalog() {
  const { data, loading, error, reload } = useSiteVisionPortfolio();

  if (loading) {
    return <div className="p-6 text-sm text-zinc-400">Carregando empreendimentos...</div>;
  }

  if (!data || error) {
    return (
      <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">
        <div>{error || 'Não foi possível carregar os empreendimentos.'}</div>
        <button onClick={reload} className="mt-4 rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-2 text-xs font-semibold text-red-100">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[34px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.18),transparent_36%),linear-gradient(180deg,rgba(10,14,15,0.96),rgba(9,9,11,0.98))] p-6 shadow-[0_28px_120px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.04)] md:p-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full border border-teal-400/15 bg-teal-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-teal-300">
              Empreendimentos
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-[2.1rem]">
              Entre no empreendimento e opere tudo a partir dele.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400 md:text-[15px]">
              Conteúdo do site, galeria, vídeo, materiais, tabelas, unidades, revendas e publicação ficam centralizados no painel individual de cada empreendimento.
            </p>
          </div>
          <div className="text-xs text-zinc-500">
            {data.crmPortfolio.length} empreendimentos no CRM • {data.sitePortfolio.length} espelhos editoriais no site
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        {data.crmPortfolio.map((item) => {
          const siteEntry = data.sitePortfolio.find((entry) => entry.crmProjectId === item.id) ?? null;
          const cover = siteEntry?.heroImageUrl || '';
          return (
            <Link
              key={item.id}
              href={`/site-vision/empreendimentos/${item.id}`}
              className="group overflow-hidden rounded-[30px] border border-white/8 bg-white/[0.03] text-left transition-colors hover:border-teal-400/20 hover:bg-white/[0.05]"
            >
              <div className="relative h-60 w-full bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.18),transparent_35%),linear-gradient(180deg,#111315,#0b0c0e)]">
                {cover ? (
                  <Image src={cover} alt={item.nome} fill unoptimized className="object-cover opacity-80 transition-transform duration-500 group-hover:scale-[1.02]" />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/45 to-transparent" />
                <div className={`absolute left-5 top-5 inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${statusTone(siteEntry?.status ?? null)}`}>
                  {statusLabel(siteEntry?.status ?? null)}
                </div>
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <p className="text-2xl font-semibold text-white">{item.nome}</p>
                  <p className="mt-2 text-sm text-zinc-300">
                    {[item.tipo, item.situacao].filter(Boolean).join(' • ') || 'Empreendimento do portfólio'}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 p-5">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500"><MapPin size={13} />Local</p>
                    <p className="mt-2 text-sm font-semibold text-white">{[siteEntry?.bairro, siteEntry?.cidade].filter(Boolean).join(' • ') || 'Definir local no espelho do site'}</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500"><FileImage size={13} />Galeria</p>
                    <p className="mt-2 text-sm font-semibold text-white">{siteEntry?.mediaCount ?? 0} assets editoriais</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500"><Sparkles size={13} />Publicação</p>
                    <p className="mt-2 text-sm font-semibold text-white">{siteEntry?.destaque ? 'Destaque ativo' : 'Sem destaque'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                    <span className="inline-flex items-center gap-2"><Building2 size={13} />ID CRM {item.id}</span>
                    <span className="inline-flex items-center gap-2"><Layers3 size={13} />{siteEntry?.slug || 'Sem slug editorial'}</span>
                  </div>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-teal-300">
                    Abrir empreendimento
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
