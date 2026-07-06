'use client';
import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Users, Clock, RefreshCw } from 'lucide-react';

interface SalesOverview {
  vgvTotal: number;
  ticketMedio: number;
  cicloMedio: number;
  totalVendas: number;
  vendasMes: number;
  vgvMes: number;
}

export default function VisaoGeralView() {
  const [data, setData] = useState<SalesOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cv/vendas?periodo=90');
      const json = await res.json();
      const vendas = json.vendas ?? [];
      const totalVendas = vendas.length;
      const vgvTotal = vendas.reduce((s: number, v: { VGV?: string | number }) => s + (parseFloat(String(v.VGV ?? 0)) || 0), 0);
      const ticketMedio = totalVendas > 0 ? vgvTotal / totalVendas : 0;

      const now = new Date();
      const mesAtual = now.getMonth();
      const anoAtual = now.getFullYear();
      const vendasMes = vendas.filter((v: { DATA?: string }) => {
        if (!v.DATA) return false;
        const d = new Date(v.DATA);
        return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
      });
      const vgvMes = vendasMes.reduce((s: number, v: { VGV?: string | number }) => s + (parseFloat(String(v.VGV ?? 0)) || 0), 0);

      setData({
        vgvTotal,
        ticketMedio,
        cicloMedio: 45,
        totalVendas,
        vendasMes: vendasMes.length,
        vgvMes,
      });
    } catch (e) {
      console.error('Erro ao carregar Sales Vision:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const formatCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const kpis = data ? [
    { label: 'VGV Total', value: formatCurrency(data.vgvTotal), icon: <DollarSign size={16} />, color: 'text-sky-300 bg-sky-500/10 border-sky-500/20' },
    { label: 'Ticket Médio', value: formatCurrency(data.ticketMedio), icon: <TrendingUp size={16} />, color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' },
    { label: 'Vendas no Mês', value: String(data.vendasMes), icon: <Users size={16} />, color: 'text-violet-300 bg-violet-500/10 border-violet-500/20' },
    { label: 'Ciclo Médio', value: `${data.cicloMedio} dias`, icon: <Clock size={16} />, color: 'text-amber-300 bg-amber-500/10 border-amber-500/20' },
  ] : [];

  return (
    <div className="flex-1 w-full space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Visão Geral</h1>
          <p className="text-xs text-zinc-500 mt-0.5">KPIs consolidados de performance comercial</p>
        </div>
        <button
          onClick={fetchData}
          className="p-2 bg-[#121214] border border-[#1E1E22] text-zinc-400 hover:text-white rounded-xl transition-all text-xs"
          title="Atualizar"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-4.5 flex flex-col justify-between h-28 hover:border-zinc-700 transition-all duration-300">
            <div className="flex justify-between items-center text-zinc-500">
              <span className="text-[10px] uppercase font-bold tracking-wider">{kpi.label}</span>
              <span className={`${kpi.color} p-1 rounded-lg border`}>{kpi.icon}</span>
            </div>
            <div className="mt-2.5">
              <h3 className="text-xl font-semibold text-white tracking-tight truncate">{kpi.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Placeholder cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-5 space-y-4">
          <div className="border-b border-[#1C1C1E] pb-3">
            <h4 className="text-sm font-semibold text-white">Últimas Vendas</h4>
            <p className="text-[11px] text-zinc-500 mt-0.5">Reservas e contratos recentes</p>
          </div>
          <p className="text-xs text-zinc-500 text-center py-8">
            {loading ? 'Carregando...' : 'Conecte-se ao módulo de Reservas & Contratos para mais detalhes.'}
          </p>
        </div>

        <div className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-5 space-y-4">
          <div className="border-b border-[#1C1C1E] pb-3">
            <h4 className="text-sm font-semibold text-white">Ranking de Empreendimentos</h4>
            <p className="text-[11px] text-zinc-500 mt-0.5">VGV por produto</p>
          </div>
          <p className="text-xs text-zinc-500 text-center py-8">
            {loading ? 'Carregando...' : 'Acesse Performance por Empreendimento para ver o ranking completo.'}
          </p>
        </div>
      </div>
    </div>
  );
}
