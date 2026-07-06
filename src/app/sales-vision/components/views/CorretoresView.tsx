'use client';
import React, { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, DollarSign, Users } from 'lucide-react';
import logger from '@/lib/logger'

interface Venda {
  CORRETOR?: string;
  VGV?: string | number;
  EMPREENDIMENTO?: string;
}

export default function CorretoresView() {
  const [data, setData] = useState<{ name: string; vgv: number; vendas: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cv/vendas?periodo=365');
      const json = await res.json();
      const vendas: Venda[] = json.vendas ?? [];

      const agg: Record<string, { vgv: number; vendas: number }> = {};
      vendas.forEach((v) => {
        const name = v.CORRETOR ?? 'Sem corretor';
        if (!agg[name]) agg[name] = { vgv: 0, vendas: 0 };
        agg[name].vgv += parseFloat(String(v.VGV ?? 0));
        agg[name].vendas += 1;
      });

      const sorted = Object.entries(agg)
        .map(([name, vals]) => ({ name, vgv: vals.vgv, vendas: vals.vendas }))
        .filter((item) => item.name !== 'Sem corretor')
        .sort((a, b) => b.vgv - a.vgv);

      setData(sorted);
    } catch (e) {
      logger.error({ e }, 'Erro:');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const formatCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const totalVGV = data.reduce((s, i) => s + i.vgv, 0);
  const totalVendas = data.reduce((s, i) => s + i.vendas, 0);

  return (
    <div className="flex-1 w-full space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Corretores & Imobiliárias</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Ranking individual de performance</p>
        </div>
        <button onClick={fetchData} className="p-2 bg-[#121214] border border-[#1E1E22] text-zinc-400 hover:text-white rounded-xl transition-all text-xs">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Mini KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-4.5">
          <div className="flex items-center gap-2 text-zinc-500 mb-2">
            <Users size={14} /><span className="text-[10px] uppercase font-bold tracking-wider">Corretores</span>
          </div>
          <span className="text-xl font-semibold text-white">{data.length}</span>
        </div>
        <div className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-4.5">
          <div className="flex items-center gap-2 text-zinc-500 mb-2">
            <TrendingUp size={14} /><span className="text-[10px] uppercase font-bold tracking-wider">Total Vendas</span>
          </div>
          <span className="text-xl font-semibold text-white">{totalVendas}</span>
        </div>
        <div className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-4.5">
          <div className="flex items-center gap-2 text-zinc-500 mb-2">
            <DollarSign size={14} /><span className="text-[10px] uppercase font-bold tracking-wider">VGV Total</span>
          </div>
          <span className="text-xl font-semibold text-emerald-400">{formatCurrency(totalVGV)}</span>
        </div>
        <div className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-4.5">
          <div className="flex items-center gap-2 text-zinc-500 mb-2">
            <DollarSign size={14} /><span className="text-[10px] uppercase font-bold tracking-wider">Ticket Médio</span>
          </div>
          <span className="text-xl font-semibold text-white">{totalVendas > 0 ? formatCurrency(totalVGV / totalVendas) : '-'}</span>
        </div>
      </div>

      {/* Ranking */}
      <div className="overflow-x-auto rounded-xl border border-[#1E1E22]">
        <table className="w-full text-xs">
          <thead className="bg-[#121214] border-b border-[#1E1E22]">
            <tr>
              <th className="text-left p-3 text-zinc-400 font-bold uppercase tracking-wider">#</th>
              <th className="text-left p-3 text-zinc-400 font-bold uppercase tracking-wider">Corretor</th>
              <th className="text-right p-3 text-zinc-400 font-bold uppercase tracking-wider">VGV</th>
              <th className="text-right p-3 text-zinc-400 font-bold uppercase tracking-wider">Vendas</th>
              <th className="text-right p-3 text-zinc-400 font-bold uppercase tracking-wider">Ticket Médio</th>
              <th className="text-right p-3 text-zinc-400 font-bold uppercase tracking-wider">Participação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E1E22]">
            {data.map((item, i) => {
              const pct = totalVGV > 0 ? ((item.vgv / totalVGV) * 100).toFixed(1) : '0';
              return (
                <tr key={item.name} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-3 text-zinc-500 font-mono">{i + 1}</td>
                  <td className="p-3 text-white font-semibold">{item.name}</td>
                  <td className="p-3 text-right text-emerald-400 font-semibold">{formatCurrency(item.vgv)}</td>
                  <td className="p-3 text-right text-zinc-300">{item.vendas}</td>
                  <td className="p-3 text-right text-zinc-300">{item.vendas > 0 ? formatCurrency(item.vgv / item.vendas) : '-'}</td>
                  <td className="p-3 text-right text-zinc-400">{pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
