'use client';
import React, { useState, useEffect } from 'react';
import { RefreshCw, Trophy, Clock } from 'lucide-react';
import logger from '@/lib/logger';

interface Corretor {
  nome: string;
  imobiliaria: string;
  vendas: number;
  cicloMedio: number;
}

export default function CorretoresView() {
  const [data, setData] = useState<Corretor[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sales-vision');
      const json = await res.json();
      setData(json.corretores ?? []);
    } catch (e) {
      logger.error({ e }, 'Erro:');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const maxVendas = Math.max(...data.map((c) => c.vendas), 1);

  return (
    <div className="flex-1 w-full space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Corretores & Imobiliárias</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Ranking de performance por corretor</p>
        </div>
        <button onClick={fetchData} className="p-2 bg-[#121214] border border-[#1E1E22] text-zinc-400 hover:text-white rounded-xl transition-all" title="Atualizar">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#1C1C1E] flex items-center gap-2">
          <Trophy size={14} className="text-amber-400" />
          <h4 className="text-sm font-semibold text-white">Ranking por Número de Vendas</h4>
        </div>

        {loading
          ? <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 animate-pulse bg-zinc-800/30 rounded-lg" />)}</div>
          : data.length === 0
            ? <p className="text-center text-zinc-500 text-xs py-10">Sem dados de corretores</p>
            : (
              <div className="divide-y divide-[#1E1E22]">
                {data.map((c, i) => (
                  <div key={c.nome} className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                    <span className={`text-sm font-black w-6 text-center ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-zinc-300' : i === 2 ? 'text-amber-700' : 'text-zinc-600'}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{c.nome}</p>
                      <p className="text-[11px] text-zinc-500 truncate">{c.imobiliaria}</p>
                    </div>
                    <div className="flex-1 mx-4">
                      <div className="bg-zinc-800/50 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-sky-500 transition-all duration-700"
                          style={{ width: `${(c.vendas / maxVendas) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-white">{c.vendas} <span className="text-zinc-500 font-normal text-[11px]">vendas</span></p>
                      {c.cicloMedio > 0 && (
                        <p className="text-[11px] text-zinc-500 flex items-center gap-1 justify-end">
                          <Clock size={10} /> {c.cicloMedio}d médio
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
      </div>
    </div>
  );
}
