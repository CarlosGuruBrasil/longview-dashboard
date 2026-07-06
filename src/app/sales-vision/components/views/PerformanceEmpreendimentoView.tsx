'use client';
import React, { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Venda {
  EMPREENDIMENTO?: string;
  VGV?: string | number;
}

export default function PerformanceEmpreendimentoView() {
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
        const name = v.EMPREENDIMENTO ?? 'Sem empreendimento';
        if (!agg[name]) agg[name] = { vgv: 0, vendas: 0 };
        agg[name].vgv += parseFloat(String(v.VGV ?? 0));
        agg[name].vendas += 1;
      });

      const sorted = Object.entries(agg)
        .map(([name, vals]) => ({ name, vgv: vals.vgv, vendas: vals.vendas }))
        .sort((a, b) => b.vgv - a.vgv);

      setData(sorted);
    } catch (e) {
      console.error('Erro:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const formatCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="flex-1 w-full space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Performance por Empreendimento</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Ranking de VGV por produto</p>
        </div>
        <button onClick={fetchData} className="p-2 bg-[#121214] border border-[#1E1E22] text-zinc-400 hover:text-white rounded-xl transition-all text-xs">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Chart */}
      <div className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-5">
        <div className="h-72">
          {!loading && data.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#3f3f46" tick={{ fill: '#f4f4f5', fontSize: 11, fontWeight: 600 }} tickLine={false} />
                <YAxis stroke="#3f3f46" tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} tickFormatter={(v) => formatCurrency(v)} />
                <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#2b2b30', color: '#fff' }} formatter={(value) => [formatCurrency(Number(value)), 'VGV'] as [string, string]} />
                <Bar dataKey="vgv" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Ranking Table */}
      <div className="overflow-x-auto rounded-xl border border-[#1E1E22]">
        <table className="w-full text-xs">
          <thead className="bg-[#121214] border-b border-[#1E1E22]">
            <tr>
              <th className="text-left p-3 text-zinc-400 font-bold uppercase tracking-wider">#</th>
              <th className="text-left p-3 text-zinc-400 font-bold uppercase tracking-wider">Empreendimento</th>
              <th className="text-right p-3 text-zinc-400 font-bold uppercase tracking-wider">VGV</th>
              <th className="text-right p-3 text-zinc-400 font-bold uppercase tracking-wider">Vendas</th>
              <th className="text-right p-3 text-zinc-400 font-bold uppercase tracking-wider">Ticket Médio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E1E22]">
            {data.map((item, i) => (
              <tr key={item.name} className="hover:bg-white/[0.02] transition-colors">
                <td className="p-3 text-zinc-500 font-mono">{i + 1}</td>
                <td className="p-3 text-white font-semibold">{item.name}</td>
                <td className="p-3 text-right text-emerald-400 font-semibold">{formatCurrency(item.vgv)}</td>
                <td className="p-3 text-right text-zinc-300">{item.vendas}</td>
                <td className="p-3 text-right text-zinc-300">{formatCurrency(item.vendas > 0 ? item.vgv / item.vendas : 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
