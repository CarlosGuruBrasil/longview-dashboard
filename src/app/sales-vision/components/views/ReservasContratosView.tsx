'use client';
import React, { useState, useEffect } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import logger from '@/lib/logger'

interface Venda {
  ID?: string;
  DATA?: string;
  CLIENTE?: string;
  EMAIL?: string;
  TELEFONE?: string;
  EMPREENDIMENTO?: string;
  UNIDADE?: string;
  VGV?: string | number;
  STATUS?: string;
  CORRETOR?: string;
}

export default function ReservasContratosView() {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cv/vendas?periodo=365');
      const json = await res.json();
      setVendas(json.vendas ?? []);
    } catch (e) {
      logger.error({ e }, 'Erro ao carregar vendas:');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = vendas.filter((v) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (v.CLIENTE?.toLowerCase() ?? '').includes(q)
      || (v.EMPREENDIMENTO?.toLowerCase() ?? '').includes(q)
      || (v.CORRETOR?.toLowerCase() ?? '').includes(q)
      || (v.UNIDADE?.toLowerCase() ?? '').includes(q);
  });

  const formatCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="flex-1 w-full space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-white">Reservas & Contratos</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Todas as vendas do período</p>
        </div>
        <button
          onClick={fetchData}
          className="p-2 bg-[#121214] border border-[#1E1E22] text-zinc-400 hover:text-white rounded-xl transition-all text-xs"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-[#121214] border border-[#1E1E22] rounded-xl px-3 py-2 text-xs">
        <Search size={14} className="text-zinc-500 shrink-0" />
        <input
          type="text"
          placeholder="Buscar por cliente, empreendimento, corretor ou unidade..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-white placeholder-zinc-500 focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[#1E1E22]">
        <table className="w-full text-xs">
          <thead className="bg-[#121214] border-b border-[#1E1E22]">
            <tr>
              <th className="text-left p-3 text-zinc-400 font-bold uppercase tracking-wider">Data</th>
              <th className="text-left p-3 text-zinc-400 font-bold uppercase tracking-wider">Cliente</th>
              <th className="text-left p-3 text-zinc-400 font-bold uppercase tracking-wider">Empreendimento</th>
              <th className="text-left p-3 text-zinc-400 font-bold uppercase tracking-wider">Unidade</th>
              <th className="text-right p-3 text-zinc-400 font-bold uppercase tracking-wider">VGV</th>
              <th className="text-left p-3 text-zinc-400 font-bold uppercase tracking-wider">Corretor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E1E22]">
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-zinc-500">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-zinc-500">Nenhuma venda encontrada.</td></tr>
            ) : (
              filtered.map((v, i) => (
                <tr key={v.ID ?? i} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-3 text-zinc-300">{v.DATA ? new Date(v.DATA).toLocaleDateString('pt-BR') : '-'}</td>
                  <td className="p-3 text-white font-semibold">{v.CLIENTE ?? '-'}</td>
                  <td className="p-3 text-zinc-300">{v.EMPREENDIMENTO ?? '-'}</td>
                  <td className="p-3 text-zinc-300">{v.UNIDADE ?? '-'}</td>
                  <td className="p-3 text-right text-emerald-400 font-semibold">{v.VGV ? formatCurrency(parseFloat(String(v.VGV))) : '-'}</td>
                  <td className="p-3 text-zinc-300">{v.CORRETOR ?? '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
