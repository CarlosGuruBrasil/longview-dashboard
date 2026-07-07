'use client'

import { useMemo } from 'react'
import { ArrowRight, Activity, TrendingUp } from 'lucide-react'
import type { Lead } from '../../types'
import { formatNumber } from '../../utils/formatters'
import { useData } from '../../context/DataContext'

interface Props {
  leads: Lead[]
}

export default function FunnelVisualization({ leads }: Props) {
  const { leadFilters, setLeadFilters } = useData()

  const funnelConsolidated = useMemo(() => {
    let novos = 0
    let atendimento = 0
    let visita = 0
    let proposta = 0
    let venda = 0

    leads.forEach(l => {
      const s = (l.situacao?.nome ?? '').toLowerCase()
      
      if (s === 'venda realizada' || s.includes('negócio ganho') || s.includes('negocio ganho') || s.includes('vendid') || s.includes('venda real')) {
        venda++
      } else if (s.includes('com proposta') || s === 'proposta' || s.includes('com reserva') || s.includes('reserva') || s.includes('simula')) {
        proposta++
      } else if (s.includes('visita') || s.includes('apresenta')) {
        visita++
      } else if (s.includes('atend') || s.includes('sdr') || s.includes('conex')) {
        atendimento++
      } else {
        novos++
      }
    })

    const cVenda = venda
    const cProposta = proposta + cVenda
    const cVisita = visita + cProposta
    const cAtend = atendimento + cVisita
    const cNovos = novos + cAtend

    const tAtend = cNovos > 0 ? (cAtend / cNovos) * 100 : 0
    const tVisita = cAtend > 0 ? (cVisita / cAtend) * 100 : 0
    const tProposta = cVisita > 0 ? (cProposta / cVisita) * 100 : 0
    const tVenda = cProposta > 0 ? (cVenda / cProposta) * 100 : 0

    const getStatus = (val: number, meta: number) => {
      if (val >= meta) return { label: 'Excelente (Meta batida)', color: 'text-green-400 border-green-500/25 bg-green-500/10' }
      if (val >= meta * 0.7) return { label: 'Bom', color: 'text-sky-400 border-sky-500/25 bg-sky-500/10' }
      if (val >= meta * 0.45) return { label: 'Regular', color: 'text-amber-400 border-amber-500/25 bg-amber-500/10' }
      return { label: 'Abaixo da Meta', color: 'text-red-400 border-red-500/25 bg-red-500/10' }
    }

    return [
      {
        name: '1. Captação (Novos Leads)',
        count: cNovos,
        pctOfTotal: 100,
        convRate: 100,
        diag: { label: 'Início do Funil', color: 'text-zinc-400 border-zinc-700 bg-zinc-800/40' },
        gradient: 'from-blue-500 to-sky-400'
      },
      {
        name: '2. Em Atendimento',
        count: cAtend,
        pctOfTotal: cNovos > 0 ? Math.round((cAtend / cNovos) * 100) : 0,
        convRate: Math.round(tAtend),
        diag: getStatus(tAtend, 85),
        gradient: 'from-indigo-500 to-purple-400'
      },
      {
        name: '3. Visita Realizada/Agendada',
        count: cVisita,
        pctOfTotal: cNovos > 0 ? Math.round((cVisita / cNovos) * 100) : 0,
        convRate: Math.round(tVisita),
        diag: getStatus(tVisita, 45),
        gradient: 'from-pink-500 to-rose-400'
      },
      {
        name: '4. Com Proposta/Reserva',
        count: cProposta,
        pctOfTotal: cNovos > 0 ? Math.round((cProposta / cNovos) * 100) : 0,
        convRate: Math.round(tProposta),
        diag: getStatus(tProposta, 20),
        gradient: 'from-amber-500 to-orange-400'
      },
      {
        name: '5. Venda Fechada',
        count: cVenda,
        pctOfTotal: cNovos > 0 ? Math.round((cVenda / cNovos) * 100) : 0,
        convRate: Math.round(tVenda),
        diag: getStatus(tVenda, 35),
        gradient: 'from-emerald-500 to-teal-400'
      },
    ]
  }, [leads])

  return (
    <div className="flex flex-col gap-6 py-1">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Activity size={16} className="text-orange-500" /> Funil Comercial Consolidado
          </h3>
          <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
            Pipeline
          </span>
        </div>
        <span className="text-xs text-zinc-400">
          Total de <strong>{formatNumber(leads.length)}</strong> leads ativos no período
        </span>
      </div>

      {/* Visualização de Funil Premium com Barras Uniformes */}
      <div className="flex flex-col gap-3.5 w-full">
        {funnelConsolidated.length === 0 || leads.length === 0 ? (
          <p className="text-zinc-500 text-center text-xs py-12">Nenhum lead encontrado para os filtros selecionados.</p>
        ) : (
          funnelConsolidated.map((step, idx) => {
            return (
              <div
                key={step.name}
                onClick={() => {
                  const baseFilters = { ...leadFilters }
                  if (step.name.includes('Atendimento')) baseFilters.situacao = 'Em Atendimento'
                  else if (step.name.includes('Visita')) baseFilters.situacao = 'Visita Realizada'
                  else if (step.name.includes('Proposta')) baseFilters.situacao = 'Com Proposta'
                  else if (step.name.includes('Venda')) baseFilters.situacao = 'Venda Realizada'
                  else delete baseFilters.situacao
                  setLeadFilters(baseFilters)
                }}
                className="group flex flex-col gap-3 w-full bg-white/[0.01] hover:bg-white/[0.02] border border-white/5 hover:border-white/10 p-4 rounded-xl cursor-pointer transition-all duration-300 shadow-md relative"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  {/* Nome do Estágio */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${step.gradient} shadow-lg shrink-0`} />
                    <span className="text-[13px] font-bold text-zinc-200 group-hover:text-white transition-colors truncate">
                      {step.name}
                    </span>
                  </div>

                  {/* Volume e Percentual do Total */}
                  <div className="flex items-center gap-3 justify-between sm:justify-end text-xs">
                    <span className="font-bold text-zinc-100 font-mono text-[13px]">
                      {formatNumber(step.count)} leads
                    </span>
                    <span className="text-[11px] text-zinc-500 font-medium">
                      ({step.pctOfTotal}% do início)
                    </span>
                  </div>
                </div>

                {/* Linha Inferior com Barra de Progresso e Indicadores */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Barra de Progresso Horizontal Uniforme */}
                  <div className="flex-1 h-3 rounded-full bg-zinc-900 border border-white/5 overflow-hidden relative">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${step.gradient} transition-all duration-500`}
                      style={{ width: `${step.pctOfTotal}%` }}
                    />
                  </div>

                  {/* Conversão e Diagnóstico */}
                  <div className="flex items-center gap-3 justify-between sm:justify-end shrink-0 min-w-[190px]">
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                      {idx === 0 ? (
                        <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Ponto de Partida</span>
                      ) : (
                        <>
                          <TrendingUp size={12} className="text-zinc-500" />
                          <span>Conv: <strong className="text-zinc-200">{step.convRate}%</strong></span>
                        </>
                      )}
                    </div>

                    {idx > 0 && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${step.diag.color}`}>
                        {step.diag.label}
                      </span>
                    )}

                    <ArrowRight size={12} className="text-zinc-500 group-hover:text-white transition-colors translate-x-0 group-hover:translate-x-1 duration-300 hidden sm:block" />
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
