'use client';
import React, { useState } from 'react';
import { GitMerge } from 'lucide-react';

interface FunilEtapa {
  nome: string;
  valor: number;
  qtd: number;
  cor: string;
}

const ETAPAS: FunilEtapa[] = [
  { nome: 'Leads',             valor: 0, qtd: 0, cor: '#3b82f6' },
  { nome: 'Qualificados',      valor: 0, qtd: 0, cor: '#06b6d4' },
  { nome: 'Propostas',         valor: 0, qtd: 0, cor: '#8b5cf6' },
  { nome: 'Negociação',        valor: 0, qtd: 0, cor: '#f59e0b' },
  { nome: 'Fechados',          valor: 0, qtd: 0, cor: '#10b981' },
];

export default function FunilComercialView() {
  const [etapas] = useState<FunilEtapa[]>(ETAPAS);

  const maxValor = Math.max(...etapas.map((e) => e.valor), 1);

  return (
    <div className="flex-1 w-full space-y-6 p-4 md:p-6 lg:p-8">
      <div>
        <h1 className="text-lg font-bold text-white">Funil Comercial</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Pipeline de conversão de vendas</p>
      </div>

      {/* Funnel Visualization */}
      <div className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-6">
        <div className="flex flex-col items-center gap-2">
          {etapas.map((etapa, i) => {
            const widthPct = etapa.valor > 0 ? Math.max((etapa.valor / maxValor) * 100, 15) : 15;
            return (
              <div key={etapa.nome} className="w-full flex flex-col items-center" style={{ maxWidth: `${widthPct}%` }}>
                <div
                  className="w-full text-center py-3 px-4 rounded-lg text-xs font-bold text-white transition-all"
                  style={{ backgroundColor: etapa.cor }}
                >
                  <span className="block">{etapa.nome}</span>
                  <span className="block mt-0.5 opacity-80">
                    {etapa.qtd} oportunidades
                  </span>
                </div>
                {i < etapas.length - 1 && (
                  <div className="text-zinc-600 text-[10px] py-1">
                    {Math.round((maxValor > 0 ? (etapas[i + 1].valor / etapa.valor) * 100 : 0))}% conversão
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Data source notice */}
      <div className="bg-sky-500/5 border border-sky-500/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <GitMerge size={16} className="text-sky-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-sky-300">Funil Inteligente</p>
            <p className="text-[11px] text-zinc-400 mt-1">
              Este funil será alimentado pelo módulo de Inteligência de Vendas, cruzando dados do CV CRM, 
              Meta Ads e ConstruPoint para fornecer uma visão completa do pipeline comercial.
              <br /><br />
              Acesse o <strong>Funil Inteligente</strong> no Marketing Vision para visualização detalhada 
              com dados reais de conversão por etapa.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
