'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Building2, FileText, Image, Loader2, Package, Plus, RefreshCw } from 'lucide-react';
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

// Disponibilidade real (unidades/revendas com status "disponivel") vem sempre do
// site real via /api/site-vision/site-empreendimentos — o catalogo acima usa
// tabelas locais que podem ficar desatualizadas, entao nao confiamos nelas pra
// esse numero especifico.
type Disponibilidade = { id: number; unidades_disponiveis?: number; revendas_disponiveis?: number };

const inputClass = 'h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-zinc-100 outline-none';
const labelClass = 'block space-y-1.5';
const labelTextClass = 'text-xs font-semibold uppercase tracking-wide text-zinc-500';
const btnPrimary = 'inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-wait';
const cardClass = 'rounded-[24px] border border-white/8 bg-white/[0.03] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_48px_rgba(0,0,0,0.22)]';

const emptyEmpForm = { nome: '', endereco: '', cidade: '', estado: '', descricaoCurta: '' };

export function ProjectsCatalogClient() {
  const [data, setData] = useState<Empreendimento[]>([]);
  const [disponibilidade, setDisponibilidade] = useState<Record<number, Disponibilidade>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCadastrarEmp, setShowCadastrarEmp] = useState(false);
  const [empForm, setEmpForm] = useState(emptyEmpForm);
  const [empSaving, setEmpSaving] = useState(false);
  const [empMsg, setEmpMsg] = useState('');

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const [catalogRes, dispRes] = await Promise.all([
        fetch('/api/site-vision/projects-catalog'),
        fetch('/api/site-vision/site-empreendimentos'),
      ]);
      if (!catalogRes.ok) throw new Error(`HTTP ${catalogRes.status}`);
      const json = (await catalogRes.json()) as CatalogResponse;
      setData(json.empreendimentos);
      setError(null);

      if (dispRes.ok) {
        const dispJson = await dispRes.json();
        const map: Record<number, Disponibilidade> = {};
        for (const e of dispJson.empreendimentos ?? []) map[e.id] = e;
        setDisponibilidade(map);
      }
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

  const criarEmpreendimento = async () => {
    setEmpSaving(true);
    setEmpMsg('');
    try {
      const res = await fetch('/api/site-vision/site-empreendimentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(empForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao criar empreendimento.');
      setEmpMsg(`Empreendimento "${json.empreendimento.nome}" criado.`);
      setEmpForm(emptyEmpForm);
      await fetchCatalog();
    } catch (err) {
      setEmpMsg(err instanceof Error ? err.message : 'Erro ao criar empreendimento.');
    } finally {
      setEmpSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className={cardClass}>
        <button className={btnPrimary} onClick={() => setShowCadastrarEmp((v) => !v)}>
          <Building2 size={14} />
          Cadastrar Empreendimento
        </button>

        {showCadastrarEmp ? (
          <div className="mt-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                <span className={labelTextClass}>Nome</span>
                <input className={inputClass} value={empForm.nome} onChange={(e) => setEmpForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Campeche Beach Club" />
              </label>
              <label className={labelClass}>
                <span className={labelTextClass}>Endereço</span>
                <input className={inputClass} value={empForm.endereco} onChange={(e) => setEmpForm((f) => ({ ...f, endereco: e.target.value }))} placeholder="Av. Pequeno Príncipe" />
              </label>
              <label className={labelClass}>
                <span className={labelTextClass}>Cidade</span>
                <input className={inputClass} value={empForm.cidade} onChange={(e) => setEmpForm((f) => ({ ...f, cidade: e.target.value }))} placeholder="Florianópolis" />
              </label>
              <label className={labelClass}>
                <span className={labelTextClass}>Estado (UF)</span>
                <input className={inputClass} value={empForm.estado} onChange={(e) => setEmpForm((f) => ({ ...f, estado: e.target.value.toUpperCase().slice(0, 2) }))} placeholder="SC" maxLength={2} />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                <span className={labelTextClass}>Descrição curta (opcional)</span>
                <input className={inputClass} value={empForm.descricaoCurta} onChange={(e) => setEmpForm((f) => ({ ...f, descricaoCurta: e.target.value }))} />
              </label>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button className={btnPrimary} disabled={empSaving || !empForm.nome || !empForm.endereco || !empForm.cidade || !empForm.estado} onClick={criarEmpreendimento}>
                {empSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Criar empreendimento
              </button>
              {empMsg ? <span className="text-xs text-zinc-400">{empMsg}</span> : null}
            </div>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="p-6 text-sm text-zinc-400">Carregando empreendimentos...</div>
      ) : error || data.length === 0 ? (
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
      ) : (
        <div className="space-y-3">
          {data.map((emp) => {
            const disp = disponibilidade[emp.id];
            const unidadesDisp = disp?.unidades_disponiveis ?? 0;
            const revendasDisp = disp?.revendas_disponiveis ?? 0;
            return (
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

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${unidadesDisp > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-zinc-500'}`}>
                        {unidadesDisp} unidade{unidadesDisp === 1 ? '' : 's'} disponível{unidadesDisp === 1 ? '' : 'is'}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${revendasDisp > 0 ? 'bg-teal-500/20 text-teal-300' : 'bg-white/5 text-zinc-500'}`}>
                        {revendasDisp} revenda{revendasDisp === 1 ? '' : 's'} disponível{revendasDisp === 1 ? '' : 'is'}
                      </span>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
