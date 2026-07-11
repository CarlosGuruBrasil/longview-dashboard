'use client';
import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, Clock, RefreshCw, GitMerge } from 'lucide-react';
import logger from '@/lib/logger';

interface SalesData {
  overview: { totalVendas: number; leadsConvertidos: number; cicloMedioDias: number; leadsMes: number; vendasMes: number };
  funil: { nome: string; ordem: number; qtd: number }[];
  cicloDistribuicao: { faixa: string; qtd: number }[];
}

export default function VisaoGeralView() {
  const [data, setData] = useState<SalesData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sales-vision');
      setData(await res.json());
    } catch (e) {
      logger.error({ e }, 'Erro ao carregar Sales Vision:');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const kpis = data ? [
    { label: 'Unidades Vendidas', value: String(data.overview.totalVendas), icon: <TrendingUp size={16} />, color: 'text-sky-300 bg-sky-500/10 border-sky-500/20' },
    { label: 'Leads Convertidos', value: String(data.overview.leadsConvertidos), icon: <Users size={16} />, color: 'text-violet-300 bg-violet-500/10 border-violet-500/20' },
    { label: 'Leads no Mês', value: String(data.overview.leadsMes), icon: <GitMerge size={16} />, color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' },
    { label: 'Ciclo Médio', value: `${data.overview.cicloMedioDias} dias`, icon: <Clock size={16} />, color: 'text-amber-300 bg-amber-500/10 border-amber-500/20' },
  ] : [];

  // Agrupa funil em macro-etapas (ordem da funil_etapas renumerada 2026-07-07)
  const MACRO: { label: string; ordem: number[]; cor: string }[] = [
    { label: 'Novos', ordem: [1, 2], cor: '#3b82f6' },
    { label: 'Em Atendimento', ordem: [3, 4], cor: '#06b6d4' },
    { label: 'Sem Conexão', ordem: [5], cor: '#64748b' },
    { label: 'Visita', ordem: [6, 7], cor: '#8b5cf6' },
    { label: 'Reserva', ordem: [8], cor: '#f59e0b' },
    { label: 'Vendas (leads)', ordem: [9], cor: '#10b981' },
  ];

  const funilMacro = data ? MACRO.map((m) => ({
    ...m,
    qtd: (data.funil ?? []).filter((f) => m.ordem.includes(f.ordem)).reduce((s, f) => s + f.qtd, 0),
  })) : [];

  const maxQtd = Math.max(...funilMacro.map((f) => f.qtd), 1);

  return (
    <div className="flex-1 w-full space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Visão Geral</h1>
          <p className="text-xs text-zinc-500 mt-0.5">KPIs consolidados de performance comercial</p>
        </div>
        <button onClick={fetchData} className="p-2 bg-[#121214] border border-[#1E1E22] text-zinc-400 hover:text-white rounded-xl transition-all" title="Atualizar">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-4 h-28 animate-pulse" />
            ))
          : kpis.map((kpi) => (
              <div key={kpi.label} className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-4 flex flex-col justify-between h-28 hover:border-zinc-700 transition-all">
                <div className="flex justify-between items-center text-zinc-500">
                  <span className="text-[10px] uppercase font-bold tracking-wider">{kpi.label}</span>
                  <span className={`${kpi.color} p-1 rounded-lg border`}>{kpi.icon}</span>
                </div>
                <h3 className="text-xl font-semibold text-white tracking-tight mt-2">{kpi.value}</h3>
              </div>
            ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funil macro */}
        <div className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-5 space-y-4">
          <div className="border-b border-[#1C1C1E] pb-3">
            <h4 className="text-sm font-semibold text-white">Funil Comercial</h4>
            <p className="text-[11px] text-zinc-500 mt-0.5">Distribuição atual dos leads</p>
          </div>
          {loading
            ? <div className="h-40 animate-pulse bg-zinc-800/30 rounded-lg" />
            : (
              <div className="flex flex-col gap-2">
                {funilMacro.map((etapa) => (
                  <div key={etapa.label} className="flex items-center gap-3">
                    <span className="text-[11px] text-zinc-400 w-28 shrink-0">{etapa.label}</span>
                    <div className="flex-1 bg-zinc-800/50 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-500"
                        style={{ width: `${(etapa.qtd / maxQtd) * 100}%`, backgroundColor: etapa.cor }}
                      />
                    </div>
                    <span className="text-xs font-bold text-white w-10 text-right">{etapa.qtd}</span>
                  </div>
                ))}
              </div>
            )}
        </div>

        {/* Ciclo de conversão */}
        <div className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-5 space-y-4">
          <div className="border-b border-[#1C1C1E] pb-3">
            <h4 className="text-sm font-semibold text-white">Ciclo Lead → Venda</h4>
            <p className="text-[11px] text-zinc-500 mt-0.5">Distribuição do tempo de conversão</p>
          </div>
          {loading
            ? <div className="h-40 animate-pulse bg-zinc-800/30 rounded-lg" />
            : (
              <div className="flex flex-col gap-2">
                {(data?.cicloDistribuicao ?? []).map((item) => {
                  const maxCiclo = Math.max(...(data?.cicloDistribuicao ?? []).map((d) => d.qtd), 1);
                  return (
                    <div key={item.faixa} className="flex items-center gap-3">
                      <span className="text-[11px] text-zinc-400 w-24 shrink-0">{item.faixa}</span>
                      <div className="flex-1 bg-zinc-800/50 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${(item.qtd / maxCiclo) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-white w-8 text-right">{item.qtd}</span>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
