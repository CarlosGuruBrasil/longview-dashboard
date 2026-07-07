'use client';
import React, { useState, useEffect } from 'react';
import { GitMerge, RefreshCw } from 'lucide-react';
import logger from '@/lib/logger';

interface Etapa { nome: string; ordem: number; qtd: number }

const CORES: Record<number, string> = {
  1: '#3b82f6', 2: '#06b6d4', 3: '#06b6d4',
  4: '#8b5cf6', 5: '#8b5cf6', 6: '#8b5cf6',
  7: '#f59e0b', 8: '#10b981', 9: '#ef4444',
  10: '#6366f1', 11: '#64748b',
};

export default function FunilComercialView() {
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sales-vision');
      const json = await res.json();
      setEtapas(json.funil ?? []);
    } catch (e) {
      logger.error({ e }, 'Erro funil:');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const maxQtd = Math.max(...etapas.map((e) => e.qtd), 1);
  const total = etapas.reduce((s, e) => s + e.qtd, 0);

  return (
    <div className="flex-1 w-full space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Funil Comercial</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Pipeline real de leads por etapa</p>
        </div>
        <button onClick={fetchData} className="p-2 bg-[#121214] border border-[#1E1E22] text-zinc-400 hover:text-white rounded-xl transition-all" title="Atualizar">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#1C1C1E] flex items-center gap-2">
          <GitMerge size={14} className="text-sky-400" />
          <h4 className="text-sm font-semibold text-white">Etapas do Funil</h4>
          <span className="ml-auto text-[11px] text-zinc-500">{total} leads total</span>
        </div>

        {loading
          ? <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-8 animate-pulse bg-zinc-800/30 rounded" />)}</div>
          : (
            <div className="p-4 space-y-2">
              {etapas.map((etapa) => {
                const pct = Math.round((etapa.qtd / total) * 100);
                const cor = CORES[etapa.ordem] ?? '#52525b';
                return (
                  <div key={etapa.nome} className="flex items-center gap-3">
                    <span className="text-[11px] text-zinc-400 w-48 shrink-0 truncate">{etapa.nome}</span>
                    <div className="flex-1 bg-zinc-800/50 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-700"
                        style={{ width: `${Math.max((etapa.qtd / maxQtd) * 100, etapa.qtd > 0 ? 2 : 0)}%`, backgroundColor: cor }}
                      />
                    </div>
                    <span className="text-xs font-bold text-white w-10 text-right">{etapa.qtd}</span>
                    <span className="text-[10px] text-zinc-600 w-8 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
      </div>
    </div>
  );
}
