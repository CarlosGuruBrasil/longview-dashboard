'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, FileText, Image, Package, RefreshCw } from 'lucide-react';
import logger from '@/lib/logger';

interface Empreendimento {
  id: number;
  nome: string;
  situacao: string | null;
  tipo: string | null;
  inventario: {
    unidades: number;
    unidadesPublicadas: number;
    imagens: number;
    materiais: number;
    ebooks: number;
    revendas: number;
  };
  site: {
    publicado: boolean;
    siteProjectId: string | null;
    status: string;
    ultimaAtualizacao: string | null;
  };
}

interface CatalogResponse {
  empreendimentos: Empreendimento[];
}

export function ProjectsCatalogClient() {
  const [data, setData] = useState<Empreendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/site-vision/projects-catalog');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as CatalogResponse;
      setData(json.empreendimentos);
      setError(null);
    } catch (err) {
      logger.error({ error: err }, '[ProjectsCatalogClient] fetch failed');
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-zinc-400">Carregando empreendimentos...</div>;
  }

  if (error || data.length === 0) {
    return (
      <div className="rounded-[28px] border border-yellow-500/20 bg-yellow-500/10 p-6">
        <div className="flex gap-4">
          <AlertCircle className="h-5 w-5 text-yellow-300 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-yellow-200">{error || 'Nenhum empreendimento encontrado'}</p>
            <p className="mt-1 text-xs text-yellow-100/70">Verifique a conexão com o CRM ou tente novamente.</p>
            <button
              onClick={fetchCatalog}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-yellow-400/20 px-3 py-1.5 text-xs font-medium text-yellow-300 hover:bg-yellow-400/30"
            >
              <RefreshCw size={12} />
              Recarregar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((emp) => (
        <div
          key={emp.id}
          className="group rounded-[24px] border border-white/8 bg-white/[0.03] p-5 transition-all hover:border-teal-300/30 hover:bg-teal-500/[0.04]"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white group-hover:text-teal-300 transition-colors">
                    {emp.nome}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    {emp.situacao} • {emp.tipo}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
                <div className="rounded-lg bg-white/5 p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Unidades</p>
                  <p className="mt-1 text-base font-bold text-white">{emp.inventario.unidades}</p>
                  <p className="text-[10px] text-zinc-600">{emp.inventario.unidadesPublicadas} online</p>
                </div>

                <div className="rounded-lg bg-white/5 p-2">
                  <Image size={14} className="text-zinc-500 mb-1" />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Imagens</p>
                  <p className="mt-1 text-base font-bold text-white">{emp.inventario.imagens}</p>
                </div>

                <div className="rounded-lg bg-white/5 p-2">
                  <Package size={14} className="text-zinc-500 mb-1" />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Materiais</p>
                  <p className="mt-1 text-base font-bold text-white">{emp.inventario.materiais}</p>
                </div>

                <div className="rounded-lg bg-white/5 p-2">
                  <FileText size={14} className="text-zinc-500 mb-1" />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">E-books</p>
                  <p className="mt-1 text-base font-bold text-white">{emp.inventario.ebooks}</p>
                </div>

                <div className="rounded-lg bg-white/5 p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Revendas</p>
                  <p className="mt-1 text-base font-bold text-white">{emp.inventario.revendas}</p>
                </div>

                <div className="rounded-lg bg-white/5 p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Status</p>
                  {emp.site.publicado ? (
                    <span className="mt-1 inline-block rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] font-bold text-emerald-300">
                      Online
                    </span>
                  ) : (
                    <span className="mt-1 inline-block rounded-full bg-amber-500/20 px-2 py-1 text-[10px] font-bold text-amber-300">
                      Draft
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 text-right">
              {emp.tipo !== 'manual' ? (
                <Link
                  href={`/site-vision/empreendimentos/${emp.id}`}
                  className="text-xs text-teal-400 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  Configurar →
                </Link>
              ) : null}
              <Link
                href={`/site-vision/revendas?emp=${emp.id}`}
                className="text-xs text-zinc-400 hover:text-teal-300"
              >
                Ver revendas disponíveis →
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
